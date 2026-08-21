package com.socialtush.modules.profiles.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
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
        if (targetUser == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));

        Profile profile = profileRepository.findById(targetUser.getId()).orElse(null);
        if (profile == null) {
            profile = Profile.builder().user(targetUser).displayName(targetUser.getUsername()).bio("").isPrivate(false).build();
            profile = profileRepository.save(profile);
        }

        boolean isSelf = currentUser != null && currentUser.getId().equals(targetUser.getId());
        boolean isFollowing = currentUser != null && followRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), targetUser.getId());
        boolean isPending = currentUser != null && !isSelf && !isFollowing
                && followRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUser.getId(), targetUser.getId(), "PENDING");
        boolean canViewContent = !profile.isPrivate() || isSelf || isFollowing;

        ProfileDto dto = ProfileDto.builder()
                .userId(targetUser.getId())
                .username(targetUser.getUsername())
                .displayName(profile.getDisplayName())
                .bio(profile.getBio())
                .avatarUrl(profile.getAvatarUrl())
                .coverUrl(profile.getCoverUrl())
                .interests(profile.getInterests())
                .onboardingCompleted(profile.isOnboardingCompleted())
                .isPrivate(profile.isPrivate())
                .isSelf(isSelf)
                .isFollowing(isFollowing)
                .canViewContent(canViewContent)
                .relationshipStatus(isFollowing ? "FOLLOWING" : isPending ? "PENDING" : "NONE")
                .postCount(postRepository.countByUser(targetUser))
                .followersCount(followRepository.countByFollowing(targetUser))
                .followingCount(followRepository.countByFollower(targetUser))
                .whoCanMessage(profile.getWhoCanMessage())
                .whoCanComment(profile.getWhoCanComment())
                .readReceiptsEnabled(profile.isReadReceiptsEnabled())
                .build();
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateDto request, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));

        if (request.getDisplayName() != null && !request.getDisplayName().isBlank()) profile.setDisplayName(request.getDisplayName().trim());
        if (request.getBio() != null) profile.setBio(request.getBio());
        if (request.getAvatarUrl() != null) profile.setAvatarUrl(request.getAvatarUrl());
        if (request.getCoverUrl() != null) profile.setCoverUrl(request.getCoverUrl());
        if (request.getIsPrivate() != null) profile.setPrivate(request.getIsPrivate());
        if (request.getWhoCanMessage() != null) profile.setWhoCanMessage(request.getWhoCanMessage());
        if (request.getWhoCanComment() != null) profile.setWhoCanComment(request.getWhoCanComment());
        profile.setReadReceiptsEnabled(request.isReadReceiptsEnabled());
        profileRepository.save(profile);
        return ResponseEntity.ok(profileResponse(profile));
    }

    @PatchMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateProfileMultipart(
            @RequestParam(value = "displayName", required = false) String displayName,
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "isPrivate", required = false) Boolean isPrivate,
            @RequestParam(value = "avatar", required = false) MultipartFile avatarFile,
            @RequestParam(value = "cover", required = false) MultipartFile coverFile,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));

        if (displayName != null && !displayName.isBlank()) profile.setDisplayName(displayName.trim());
        if (bio != null) profile.setBio(bio.trim());
        if (isPrivate != null) profile.setPrivate(isPrivate);

        try {
            if (avatarFile != null && !avatarFile.isEmpty()) {
                validateImage(avatarFile, 10 * 1024 * 1024L, "foto de perfil");
                String oldUrl = profile.getAvatarUrl();
                String newUrl = uploadProfileImage(avatarFile, "avatar_");
                profile.setAvatarUrl(newUrl);
                deleteOwnedImage(oldUrl, "avatar_");
            }
            if (coverFile != null && !coverFile.isEmpty()) {
                validateImage(coverFile, 16 * 1024 * 1024L, "portada");
                String oldUrl = profile.getCoverUrl();
                String newUrl = uploadProfileImage(coverFile, "cover_");
                profile.setCoverUrl(newUrl);
                deleteOwnedImage(oldUrl, "cover_");
            }
        } catch (IllegalArgumentException invalid) {
            return ResponseEntity.badRequest().body(Map.of("message", invalid.getMessage()));
        } catch (Exception e) {
            log.error("Error uploading profile media: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "No se pudo guardar la imagen del espacio"));
        }

        profileRepository.save(profile);
        return ResponseEntity.ok(profileResponse(profile));
    }

    @DeleteMapping("/me/cover")
    public ResponseEntity<?> deleteCover(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));
        deleteOwnedImage(profile.getCoverUrl(), "cover_");
        profile.setCoverUrl(null);
        profileRepository.save(profile);
        return ResponseEntity.ok(Map.of("message", "Portada eliminada", "coverUrl", ""));
    }

    private void validateImage(MultipartFile file, long maxBytes, String label) {
        String type = file.getContentType();
        boolean validType = type != null && (type.equals("image/jpeg") || type.equals("image/jpg") || type.equals("image/png") || type.equals("image/webp"));
        if (!validType) throw new IllegalArgumentException("Formato no soportado para la " + label + ". Usa JPEG, PNG o WEBP.");
        if (file.getSize() > maxBytes) throw new IllegalArgumentException("La " + label + " supera el tamaño máximo permitido.");
    }

    private String uploadProfileImage(MultipartFile file, String prefix) throws Exception {
        String original = file.getOriginalFilename();
        String ext = original != null && original.contains(".") ? original.substring(original.lastIndexOf('.')).toLowerCase() : ".jpg";
        if (!ext.matches("\\.(jpg|jpeg|png|webp)")) ext = ".jpg";
        String key = prefix + UUID.randomUUID() + ext;
        return storageService.uploadFile(key, file.getBytes(), file.getContentType());
    }

    private void deleteOwnedImage(String url, String expectedPrefix) {
        if (url == null || url.isBlank()) return;
        String key = extractFileKey(url);
        if (key == null || !key.startsWith(expectedPrefix)) return;
        try { storageService.deleteFile(key); }
        catch (Exception ex) { log.warn("Could not delete previous profile image [{}]: {}", key, ex.getMessage()); }
    }

    private static String extractFileKey(String url) {
        if (url == null || url.isBlank()) return null;
        int lastSlash = url.lastIndexOf('/');
        return lastSlash >= 0 && lastSlash < url.length() - 1 ? url.substring(lastSlash + 1) : url;
    }

    private Map<String, Object> profileResponse(Profile profile) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("message", "Perfil actualizado con éxito");
        response.put("displayName", profile.getDisplayName());
        response.put("bio", profile.getBio() != null ? profile.getBio() : "");
        response.put("avatarUrl", profile.getAvatarUrl() != null ? profile.getAvatarUrl() : "");
        response.put("coverUrl", profile.getCoverUrl() != null ? profile.getCoverUrl() : "");
        response.put("isPrivate", profile.isPrivate());
        return response;
    }

    @PostMapping("/onboarding")
    public ResponseEntity<?> saveOnboarding(@RequestBody OnboardingDto request, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Profile profile = profileRepository.findById(currentUser.getId()).orElseGet(() -> profileRepository.save(
                Profile.builder().user(currentUser).displayName(currentUser.getUsername()).bio("").build()));
        if (request.getInterests() != null && !request.getInterests().isEmpty()) profile.setInterests(String.join(",", request.getInterests()));
        profile.setOnboardingCompleted(true);
        profileRepository.save(profile);
        return ResponseEntity.ok(Map.of("message", "Onboarding completado exitosamente", "onboardingCompleted", true));
    }

    @Data
    @Builder
    public static class ProfileDto {
        private UUID userId;
        private String username;
        private String displayName;
        private String bio;
        private String avatarUrl;
        private String coverUrl;
        private String interests;
        private boolean onboardingCompleted;
        @JsonProperty("isPrivate") private boolean isPrivate;
        @JsonProperty("isSelf") private boolean isSelf;
        @JsonProperty("isFollowing") private boolean isFollowing;
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
        private String coverUrl;
        @JsonProperty("isPrivate") private Boolean isPrivate;
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
