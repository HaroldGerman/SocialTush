package com.socialtush.modules.profiles.controller;

import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.social.repository.FollowRequestRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/profiles")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final FollowRepository followRepository;
    private final FollowRequestRepository followRequestRepository;
    private final PostRepository postRepository;
    private final StorageService storageService;

    @GetMapping("/{username}")
    public ResponseEntity<?> getProfile(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        Profile profile = profileRepository.findById(targetUser.getId()).orElse(null);
        if (profile == null) {
            profile = Profile.builder()
                    .user(targetUser)
                    .displayName(targetUser.getUsername())
                    .bio("")
                    .isPrivate(false)
                    .build();
            profile = profileRepository.save(profile);
        }

        boolean isSelf = currentUser != null && currentUser.getId().equals(targetUser.getId());
        boolean isFollowing = currentUser != null && followRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), targetUser.getId());
        boolean isPending = currentUser != null && !isSelf && !isFollowing
                && followRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUser.getId(), targetUser.getId(), "PENDING");
        boolean canViewContent = !profile.isPrivate() || isSelf || isFollowing;
        String relationshipStatus = isFollowing ? "FOLLOWING" : isPending ? "PENDING" : "NONE";

        long followersCount = followRepository.countByFollowing(targetUser);
        long followingCount = followRepository.countByFollower(targetUser);
        long postCount = postRepository.countByUser(targetUser);

        ProfileDto dto = ProfileDto.builder()
                .userId(targetUser.getId())
                .username(targetUser.getUsername())
                .displayName(profile.getDisplayName())
                .bio(profile.getBio())
                .avatarUrl(profile.getAvatarUrl())
                .isPrivate(profile.isPrivate())
                .isSelf(isSelf)
                .isFollowing(isFollowing)
                .canViewContent(canViewContent)
                .relationshipStatus(relationshipStatus)
                .postCount(postCount)
                .followersCount(followersCount)
                .followingCount(followingCount)
                .whoCanMessage(profile.getWhoCanMessage())
                .whoCanComment(profile.getWhoCanComment())
                .readReceiptsEnabled(profile.isReadReceiptsEnabled())
                .build();

        return ResponseEntity.ok(dto);
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateDto request, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));
        }

        if (request.getDisplayName() != null && !request.getDisplayName().isBlank()) {
            profile.setDisplayName(request.getDisplayName().trim());
        }
        if (request.getBio() != null) {
            profile.setBio(request.getBio());
        }
        if (request.getAvatarUrl() != null) {
            profile.setAvatarUrl(request.getAvatarUrl());
        }
        if (request.getIsPrivate() != null) {
            profile.setPrivate(request.getIsPrivate());
        }

        if (request.getWhoCanMessage() != null) {
            profile.setWhoCanMessage(request.getWhoCanMessage());
        }
        if (request.getWhoCanComment() != null) {
            profile.setWhoCanComment(request.getWhoCanComment());
        }
        profile.setReadReceiptsEnabled(request.isReadReceiptsEnabled());

        profileRepository.save(profile);

        return ResponseEntity.ok(Map.of(
                "message", "Perfil actualizado con éxito",
                "displayName", profile.getDisplayName(),
                "bio", profile.getBio() != null ? profile.getBio() : "",
                "avatarUrl", profile.getAvatarUrl() != null ? profile.getAvatarUrl() : "",
                "isPrivate", profile.isPrivate()
        ));
    }

    @PatchMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateProfileMultipart(
            @RequestParam(value = "displayName", required = false) String displayName,
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "isPrivate", required = false) Boolean isPrivate,
            @RequestParam(value = "avatar", required = false) MultipartFile avatarFile,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));
        }

        if (displayName != null && !displayName.isBlank()) {
            profile.setDisplayName(displayName.trim());
        }
        if (bio != null) {
            profile.setBio(bio.trim());
        }
        if (isPrivate != null) {
            profile.setPrivate(isPrivate);
        }

        if (avatarFile != null && !avatarFile.isEmpty()) {
            String contentType = avatarFile.getContentType();
            if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/jpg") && !contentType.equals("image/png") && !contentType.equals("image/webp"))) {
                return ResponseEntity.badRequest().body(Map.of("message", "Formato de imagen no soportado. Usa JPEG, PNG o WEBP."));
            }

            String originalFilename = avatarFile.getOriginalFilename();
            String ext = originalFilename != null && originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : ".jpg";
            String randomFilename = "avatar_" + UUID.randomUUID().toString() + ext;

            try {
                String oldAvatarUrl = profile.getAvatarUrl();
                String newAvatarUrl = storageService.uploadFile(randomFilename, avatarFile.getBytes(), contentType);
                profile.setAvatarUrl(newAvatarUrl);

                if (oldAvatarUrl != null && !oldAvatarUrl.isBlank()) {
                    String oldKey = extractFileKey(oldAvatarUrl);
                    if (oldKey != null && oldKey.startsWith("avatar_")) {
                        storageService.deleteFile(oldKey);
                        log.info("Deleted old avatar [{}] from R2", oldKey);
                    }
                }
            } catch (Exception e) {
                log.error("Error uploading avatar to R2: {}", e.getMessage(), e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Error al subir la foto de perfil: " + e.getMessage()));
            }
        }

        profileRepository.save(profile);

        return ResponseEntity.ok(Map.of(
                "message", "Perfil actualizado con éxito",
                "displayName", profile.getDisplayName(),
                "bio", profile.getBio() != null ? profile.getBio() : "",
                "avatarUrl", profile.getAvatarUrl() != null ? profile.getAvatarUrl() : "",
                "isPrivate", profile.isPrivate()
        ));
    }

    private static String extractFileKey(String url) {
        if (url == null || url.isBlank()) return null;
        int lastSlash = url.lastIndexOf('/');
        if (lastSlash >= 0 && lastSlash < url.length() - 1) {
            return url.substring(lastSlash + 1);
        }
        return url;
    }

    @PostMapping("/onboarding")
    public ResponseEntity<?> saveOnboarding(@RequestBody OnboardingDto request, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Profile profile = profileRepository.findById(currentUser.getId()).orElseGet(() -> {
            Profile newProf = Profile.builder()
                    .user(currentUser)
                    .displayName(currentUser.getUsername())
                    .bio("")
                    .build();
            return profileRepository.save(newProf);
        });

        if (request.getInterests() != null && !request.getInterests().isEmpty()) {
            profile.setInterests(String.join(",", request.getInterests()));
        }
        profile.setOnboardingCompleted(true);
        profileRepository.save(profile);

        return ResponseEntity.ok(Map.of(
                "message", "Onboarding completado exitosamente",
                "onboardingCompleted", true
        ));
    }

    @Data
    @Builder
    public static class ProfileDto {
        private UUID userId;
        private String username;
        private String displayName;
        private String bio;
        private String avatarUrl;
        private String interests;
        private boolean onboardingCompleted;

        @JsonProperty("isPrivate")
        private boolean isPrivate;

        @JsonProperty("isSelf")
        private boolean isSelf;

        @JsonProperty("isFollowing")
        private boolean isFollowing;

        private boolean canViewContent;
        private String relationshipStatus;
        private long postCount;

        private long followersCount;
        private long followingCount;
        private String whoCanMessage;
        private String whoCanComment;
        private boolean readReceiptsEnabled;
    }

    @Data
    public static class ProfileUpdateDto {
        private String displayName;
        private String bio;
        private String avatarUrl;
        @JsonProperty("isPrivate")
        private Boolean isPrivate;
        private String whoCanMessage;
        private String whoCanComment;
        private boolean readReceiptsEnabled = true;
    }

    @Data
    public static class OnboardingDto {
        private java.util.List<String> interests;
        private java.util.List<String> circles;
        private String socialGoal;
    }
}
