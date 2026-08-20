package com.socialtush.modules.stories.controller;

import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.stories.entity.StoryReaction;
import com.socialtush.modules.stories.entity.StoryView;
import com.socialtush.modules.stories.repository.StoryReactionRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/stories")
@RequiredArgsConstructor
public class StoryController {

    private final StoryRepository storyRepository;
    private final FollowRepository followRepository;
    private final ProfileRepository profileRepository;
    private final StorageService storageService;
    private final com.socialtush.modules.stories.service.StoryService storyService;
    private final StoryReactionRepository storyReactionRepository;

    @Value("${app.storage.public-url:}")
    private String storagePublicUrl;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createStory(
            @RequestParam(value = "mediaType", defaultValue = "TEXT") String mediaType,
            @RequestParam(value = "textContent", required = false) String textContent,
            @RequestParam(value = "backgroundColor", required = false) String backgroundColor,
            @RequestParam(value = "musicTitle", required = false) String musicTitle,
            @RequestParam(value = "isBestFriends", defaultValue = "false") boolean isBestFriends,
            @RequestParam(value = "overlayData", required = false) String overlayData,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        String fileUrl = null;
        String mType = mediaType.toUpperCase().trim();

        if (file != null && !file.isEmpty()) {
            try {
                String originalFilename = file.getOriginalFilename();
                String ext = originalFilename != null && originalFilename.contains(".")
                        ? originalFilename.substring(originalFilename.lastIndexOf("."))
                        : ".jpg";
                String randomFilename = UUID.randomUUID().toString() + ext;

                fileUrl = storageService.uploadFile(randomFilename, file.getBytes(), file.getContentType());
                mType = file.getContentType() != null && file.getContentType().startsWith("video") ? "VIDEO" : "IMAGE";
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "Error al procesar archivo: " + e.getMessage()));
            }
        }

        Story story = Story.builder()
                .user(currentUser)
                .mediaType(mType)
                .mediaUrl(fileUrl)
                .textContent(textContent)
                .backgroundColor(backgroundColor)
                .musicTitle(musicTitle)
                .isBestFriends(isBestFriends)
                .overlayData(overlayData)
                .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                .build();

        story = storyRepository.save(story);

        return ResponseEntity.ok(convertToDto(story));
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveStories(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        // Get followed users
        List<User> followings = followRepository.findByFollower(currentUser).stream()
                .map(Follow::getFollowing)
                .collect(Collectors.toList());

        List<Story> activeStories = followings.isEmpty()
                ? storyRepository.findByUserAndExpiresAtAfterOrderByCreatedAtAsc(currentUser, Instant.now())
                : storyRepository.findActiveStories(followings, currentUser, Instant.now());

        // Group stories by User
        Map<User, List<Story>> grouped = activeStories.stream()
                .collect(Collectors.groupingBy(Story::getUser));

        List<GroupedStoryDto> responseDtos = new ArrayList<>();

        for (Map.Entry<User, List<Story>> entry : grouped.entrySet()) {
            User user = entry.getKey();
            List<Story> stories = entry.getValue();

            Profile profile = profileRepository.findById(user.getId()).orElse(null);

            List<StoryDto> storyDtos = stories.stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());

            responseDtos.add(GroupedStoryDto.builder()
                    .userId(user.getId())
                    .username(user.getUsername())
                    .displayName(profile != null ? profile.getDisplayName() : user.getUsername())
                    .avatarUrl(profile != null ? profile.getAvatarUrl() : "")
                    .stories(storyDtos)
                    .build());
        }

        // Sort so that the current user's stories appear first, then recent ones
        responseDtos.sort((a, b) -> {
            if (a.getUserId().equals(currentUser.getId())) return -1;
            if (b.getUserId().equals(currentUser.getId())) return 1;
            return 0;
        });

        return ResponseEntity.ok(responseDtos);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Story story = storyRepository.findById(id).orElse(null);
        if (story == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Historia no encontrada"));
        }
        if (!story.getUser().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No puedes eliminar la historia de otro usuario"));
        }

        String storageKey = ownedStorageKey(story.getMediaUrl());
        if (storageKey != null) {
            storageService.deleteFile(storageKey);
        }
        storyRepository.delete(story);
        return ResponseEntity.noContent().build();
    }

    private String ownedStorageKey(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.isBlank() || storagePublicUrl == null || storagePublicUrl.isBlank()) return null;
        String prefix = storagePublicUrl.replaceAll("/+$", "") + "/";
        if (!mediaUrl.startsWith(prefix)) return null;
        String key = mediaUrl.substring(prefix.length());
        return key.isBlank() || key.contains("..") ? null : key;
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<?> recordView(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        storyService.recordView(id, currentUser);
        return ResponseEntity.ok(Map.of("message", "Vista registrada"));
    }

    @PostMapping("/{id}/reaction")
    public ResponseEntity<?> recordReaction(
            @PathVariable UUID id,
            @RequestParam(value = "reactionType", required = false) String reactionTypeParam,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        String type = "HEART";
        if (reactionTypeParam != null && !reactionTypeParam.isBlank()) {
            type = reactionTypeParam;
        } else if (body != null && body.get("reactionType") != null) {
            type = body.get("reactionType").toString();
        }
        if (!storyService.recordReaction(id, currentUser, type)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Momento no disponible"));
        }
        return ResponseEntity.ok(Map.of("message", "Resonancia registrada"));
    }

    @GetMapping("/{id}/viewers")
    public ResponseEntity<?> getStoryViewers(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        try {
            List<StoryView> storyViews = storyService.getStoryViewers(id, currentUser);
            List<StoryReaction> storyReactions = storyReactionRepository.findByStoryId(id);

            Map<UUID, StoryView> viewByUserId = storyViews.stream().collect(Collectors.toMap(
                    view -> view.getViewer().getId(), Function.identity(), (first, ignored) -> first, LinkedHashMap::new));
            Map<UUID, StoryReaction> resonanceByUserId = storyReactions.stream().collect(Collectors.toMap(
                    reaction -> reaction.getUser().getId(), Function.identity(), (first, second) -> second, LinkedHashMap::new));

            LinkedHashSet<UUID> viewerIds = new LinkedHashSet<>(viewByUserId.keySet());
            viewerIds.addAll(resonanceByUserId.keySet());

            Map<UUID, Profile> profileByUserId = profileRepository.findAllById(viewerIds).stream()
                    .collect(Collectors.toMap(Profile::getUserId, Function.identity()));

            List<Map<String, Object>> viewers = viewerIds.stream().map(userId -> {
                StoryView view = viewByUserId.get(userId);
                StoryReaction resonance = resonanceByUserId.get(userId);
                User viewer = view != null ? view.getViewer() : resonance.getUser();
                Profile viewerProfile = profileByUserId.get(userId);

                Map<String, Object> dto = new LinkedHashMap<>();
                dto.put("userId", userId);
                dto.put("username", viewer.getUsername());
                dto.put("displayName", viewerProfile != null ? viewerProfile.getDisplayName() : viewer.getUsername());
                dto.put("avatarUrl", viewerProfile != null ? viewerProfile.getAvatarUrl() : null);
                dto.put("viewedAt", view != null ? view.getViewedAt() : resonance.getCreatedAt());
                dto.put("resonance", resonance != null ? resonanceEmoji(resonance.getReactionType()) : null);
                return dto;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(viewers);
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        }
    }

    private String resonanceEmoji(String value) {
        if (value == null || value.isBlank()) return null;
        return switch (value.toUpperCase()) {
            case "HEART", "LIKE" -> "❤️";
            case "LAUGH" -> "😂";
            case "WOW" -> "😮";
            case "SAD" -> "😢";
            case "FIRE" -> "🔥";
            case "THUMBS_UP" -> "👍";
            default -> value;
        };
    }

    private StoryDto convertToDto(Story story) {
        return StoryDto.builder()
                .storyId(story.getId())
                .mediaType(story.getMediaType())
                .mediaUrl(story.getMediaUrl())
                .textContent(story.getTextContent())
                .backgroundColor(story.getBackgroundColor())
                .musicTitle(story.getMusicTitle())
                .isBestFriends(story.isBestFriends())
                .overlayData(story.getOverlayData())
                .createdAt(story.getCreatedAt().toString())
                .expiresAt(story.getExpiresAt().toString())
                .build();
    }

    @Data
    @Builder
    public static class StoryDto {
        private UUID storyId;
        private String mediaType;
        private String mediaUrl;
        private String textContent;
        private String backgroundColor;
        private String musicTitle;
        private boolean isBestFriends;
        private String overlayData;
        private String createdAt;
        private String expiresAt;
    }

    @Data
    @Builder
    public static class GroupedStoryDto {
        private UUID userId;
        private String username;
        private String displayName;
        private String avatarUrl;
        private List<StoryDto> stories;
    }
}
