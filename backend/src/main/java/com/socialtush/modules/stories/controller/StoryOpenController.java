package com.socialtush.modules.stories.controller;

import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.stories.repository.StoryViewRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stories")
@RequiredArgsConstructor
public class StoryOpenController {
    private final StoryRepository storyRepository;
    private final StoryViewRepository storyViewRepository;
    private final FollowRepository followRepository;
    private final ProfileRepository profileRepository;

    @GetMapping("/resolve")
    public ResponseEntity<?> resolve(@RequestParam(required = false) String mediaUrl,
                                     @RequestParam(required = false) String textContent,
                                     @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Story story = null;
        if (mediaUrl != null && !mediaUrl.isBlank()) {
            story = storyRepository.findFirstByMediaUrlAndExpiresAtAfter(mediaUrl, Instant.now()).orElse(null);
        }
        if (story == null && textContent != null && !textContent.isBlank()) {
            story = storyRepository.findFirstByTextContentAndExpiresAtAfter(textContent.trim(), Instant.now()).orElse(null);
        }
        if (story == null || !canView(story, currentUser)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Momento no disponible"));
        }
        return ResponseEntity.ok(Map.of("storyId", story.getId()));
    }

    @GetMapping("/{id}/open")
    public ResponseEntity<?> open(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Story target = storyRepository.findById(id).orElse(null);
        if (target == null || target.getExpiresAt() == null || !target.getExpiresAt().isAfter(Instant.now()) || !canView(target, currentUser)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Momento no disponible"));
        }

        User owner = target.getUser();
        Profile profile = profileRepository.findById(owner.getId()).orElse(null);
        List<Story> active = storyRepository.findByUserAndExpiresAtAfterOrderByCreatedAtAsc(owner, Instant.now());
        List<Map<String, Object>> stories = active.stream().map(story -> toDto(story, currentUser)).toList();

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("userId", owner.getId());
        group.put("username", owner.getUsername());
        group.put("displayName", profile != null ? profile.getDisplayName() : owner.getUsername());
        group.put("avatarUrl", profile != null ? profile.getAvatarUrl() : "");
        group.put("hasUnseenStories", true);
        group.put("stories", stories);
        return ResponseEntity.ok(group);
    }

    private boolean canView(Story story, User currentUser) {
        if (story.getUser().getId().equals(currentUser.getId())) return true;
        return followRepository.existsByFollowerAndFollowing(currentUser, story.getUser());
    }

    private Map<String, Object> toDto(Story story, User currentUser) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("storyId", story.getId());
        dto.put("mediaType", story.getMediaType());
        dto.put("mediaUrl", story.getMediaUrl());
        dto.put("textContent", story.getTextContent());
        dto.put("backgroundColor", story.getBackgroundColor());
        dto.put("musicTitle", story.getMusicTitle());
        dto.put("overlayData", story.getOverlayData());
        dto.put("createdAt", story.getCreatedAt().toString());
        dto.put("expiresAt", story.getExpiresAt().toString());
        dto.put("viewedByMe", story.getUser().getId().equals(currentUser.getId()) || storyViewRepository.existsByStoryIdAndViewerId(story.getId(), currentUser.getId()));
        return dto;
    }
}
