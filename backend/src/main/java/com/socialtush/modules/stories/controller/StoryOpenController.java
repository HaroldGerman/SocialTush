package com.socialtush.modules.stories.controller;

import com.socialtush.modules.chat.repository.MessageRepository;
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

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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
    private final MessageRepository messageRepository;

    @GetMapping("/resolve")
    public ResponseEntity<?> resolve(@RequestParam(required = false) String mediaUrl,
                                     @RequestParam(required = false) String textContent,
                                     @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Instant now = Instant.now();
        Story story = null;

        if (mediaUrl != null && !mediaUrl.isBlank()) {
            story = storyRepository.findFirstByMediaUrlAndExpiresAtAfter(mediaUrl, now).orElse(null);
            if (story == null) {
                String wanted = normalizeMedia(mediaUrl);
                story = storyRepository.findByExpiresAtAfterOrderByCreatedAtAsc(now).stream()
                        .filter(candidate -> canView(candidate, currentUser))
                        .filter(candidate -> mediaMatches(wanted, normalizeMedia(candidate.getMediaUrl())))
                        .reduce((first, second) -> second)
                        .orElse(null);
            }
        }

        if (story == null && textContent != null && !textContent.isBlank()) {
            String wantedText = textContent.trim();
            story = storyRepository.findFirstByTextContentAndExpiresAtAfter(wantedText, now).orElse(null);
            if (story == null) {
                story = storyRepository.findByExpiresAtAfterOrderByCreatedAtAsc(now).stream()
                        .filter(candidate -> canView(candidate, currentUser))
                        .filter(candidate -> candidate.getTextContent() != null && candidate.getTextContent().trim().equals(wantedText))
                        .reduce((first, second) -> second)
                        .orElse(null);
            }
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

    private String normalizeMedia(String value) {
        if (value == null || value.isBlank()) return "";
        String raw = value.trim();
        try {
            URI uri = URI.create(raw);
            String path = uri.getPath();
            if (path != null && !path.isBlank()) return path.replaceAll("/+$", "").toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {}
        int query = raw.indexOf('?');
        if (query >= 0) raw = raw.substring(0, query);
        int hash = raw.indexOf('#');
        if (hash >= 0) raw = raw.substring(0, hash);
        return raw.replaceAll("/+$", "").toLowerCase(Locale.ROOT);
    }

    private boolean mediaMatches(String first, String second) {
        if (first == null || second == null || first.isBlank() || second.isBlank()) return false;
        if (first.equals(second)) return true;
        String firstName = first.substring(first.lastIndexOf('/') + 1);
        String secondName = second.substring(second.lastIndexOf('/') + 1);
        return !firstName.isBlank() && firstName.equals(secondName);
    }

    private boolean canView(Story story, User currentUser) {
        if (story.getUser().getId().equals(currentUser.getId())) return true;
        if (followRepository.existsByFollowerAndFollowing(currentUser, story.getUser())) return true;
        return messageRepository.countStoryReferencesForParticipant(story.getId(), currentUser.getId()) > 0;
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
