package com.socialtush.modules.social.controller;

import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.entity.FollowRequest;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.social.repository.FollowRequestRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/social")
@RequiredArgsConstructor
public class FollowController {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final FollowRepository followRepository;
    private final FollowRequestRepository followRequestRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    @PostMapping("/follow/{username}")
    public ResponseEntity<?> followUser(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        if (currentUser.getId().equals(targetUser.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "No puedes seguirte a ti mismo"));
        }

        // Check if already following
        if (followRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), targetUser.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ya sigues a este usuario"));
        }

        Profile targetProfile = profileRepository.findById(targetUser.getId()).orElse(null);
        boolean isPrivate = targetProfile != null && targetProfile.isPrivate();

        if (isPrivate) {
            // Check if there is an existing pending request
            boolean requestExists = followRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUser.getId(), targetUser.getId(), "PENDING");
            if (requestExists) {
                return ResponseEntity.ok(Map.of("status", "PENDING", "message", "Solicitud de seguimiento ya enviada"));
            }

            // Save new Follow Request
            FollowRequest request = FollowRequest.builder()
                    .sender(currentUser)
                    .receiver(targetUser)
                    .status("PENDING")
                    .build();
            request = followRequestRepository.save(request);

            // Trigger Follow Request Notification
            notificationService.createNotification(targetUser, currentUser, "FOLLOW_REQUEST", request.getId());

            return ResponseEntity.ok(Map.of("status", "PENDING", "message", "Solicitud de seguimiento enviada a cuenta privada"));
        } else {
            // Directly follow
            Follow follow = Follow.builder()
                    .follower(currentUser)
                    .following(targetUser)
                    .build();
            followRepository.save(follow);

            // Trigger Follow Notification
            notificationService.createNotification(targetUser, currentUser, "FOLLOW", currentUser.getId());

            return ResponseEntity.ok(Map.of("status", "FOLLOWING", "message", "Ahora sigues a este usuario"));
        }
    }

    @PostMapping("/unfollow/{username}")
    public ResponseEntity<?> unfollowUser(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        // Delete follow if exists
        followRepository.findByFollowerIdAndFollowingId(currentUser.getId(), targetUser.getId()).ifPresent(followRepository::delete);
        
        // Delete pending request if exists
        followRequestRepository.findBySenderIdAndReceiverId(currentUser.getId(), targetUser.getId()).ifPresent(followRequestRepository::delete);

        return ResponseEntity.ok(Map.of("status", "NONE", "message", "Has dejado de seguir a este usuario"));
    }

    @GetMapping("/requests")
    public ResponseEntity<?> getPendingRequests(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        List<FollowRequest> requests = followRequestRepository.findByReceiverAndStatus(currentUser, "PENDING");
        List<FollowRequestDto> dtos = requests.stream().map(req -> {
            Profile senderProfile = profileRepository.findById(req.getSender().getId()).orElse(null);
            return FollowRequestDto.builder()
                    .requestId(req.getId())
                    .senderId(req.getSender().getId())
                    .username(req.getSender().getUsername())
                    .displayName(senderProfile != null ? senderProfile.getDisplayName() : req.getSender().getUsername())
                    .avatarUrl(senderProfile != null ? senderProfile.getAvatarUrl() : "")
                    .createdAt(req.getCreatedAt().toString())
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/requests/{id}/accept")
    @Transactional
    public ResponseEntity<?> acceptRequest(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        FollowRequest request = followRequestRepository.findById(id).orElse(null);
        if (request == null || !request.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Solicitud no encontrada"));
        }

        request.setStatus("ACCEPTED");
        followRequestRepository.save(request);

        // Establish the follow relation
        if (!followRepository.existsByFollowerIdAndFollowingId(request.getSender().getId(), currentUser.getId())) {
            Follow follow = Follow.builder()
                    .follower(request.getSender())
                    .following(currentUser)
                    .build();
            followRepository.save(follow);
        }

        // Clean up follow request database
        followRequestRepository.delete(request);
        notificationRepository.deleteByReceiverAndNotificationTypeAndTargetId(currentUser, "FOLLOW_REQUEST", id);

        // Trigger Follow Alert
        notificationService.createNotification(request.getSender(), currentUser, "FOLLOW", currentUser.getId());

        return ResponseEntity.ok(Map.of("message", "Solicitud aceptada. Ahora te sigue"));
    }

    @PostMapping("/requests/{id}/reject")
    @Transactional
    public ResponseEntity<?> rejectRequest(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        FollowRequest request = followRequestRepository.findById(id).orElse(null);
        if (request == null || !request.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Solicitud no encontrada"));
        }

        followRequestRepository.delete(request);
        notificationRepository.deleteByReceiverAndNotificationTypeAndTargetId(currentUser, "FOLLOW_REQUEST", id);

        return ResponseEntity.ok(Map.of("message", "Solicitud rechazada y eliminada"));
    }

    @GetMapping("/{username}/followers")
    public ResponseEntity<?> getFollowers(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        Profile targetProfile = profileRepository.findById(targetUser.getId()).orElse(null);
        boolean isSelf = currentUser != null && currentUser.getId().equals(targetUser.getId());
        boolean isFollowing = currentUser != null && followRepository.existsByFollowerAndFollowing(currentUser, targetUser);

        if (targetProfile != null && targetProfile.isPrivate() && !isSelf && !isFollowing) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Este perfil es privado"));
        }

        List<Follow> followers = followRepository.findByFollowing(targetUser);
        List<SocialUserDto> dtos = followers.stream().map(f -> {
            Profile p = profileRepository.findById(f.getFollower().getId()).orElse(null);
            return SocialUserDto.builder()
                    .userId(f.getFollower().getId())
                    .username(f.getFollower().getUsername())
                    .displayName(p != null ? p.getDisplayName() : f.getFollower().getUsername())
                    .avatarUrl(p != null ? p.getAvatarUrl() : "")
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{username}/following")
    public ResponseEntity<?> getFollowing(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        Profile targetProfile = profileRepository.findById(targetUser.getId()).orElse(null);
        boolean isSelf = currentUser != null && currentUser.getId().equals(targetUser.getId());
        boolean isFollowing = currentUser != null && followRepository.existsByFollowerAndFollowing(currentUser, targetUser);

        if (targetProfile != null && targetProfile.isPrivate() && !isSelf && !isFollowing) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Este perfil es privado"));
        }

        List<Follow> followings = followRepository.findByFollower(targetUser);
        List<SocialUserDto> dtos = followings.stream().map(f -> {
            Profile p = profileRepository.findById(f.getFollowing().getId()).orElse(null);
            return SocialUserDto.builder()
                    .userId(f.getFollowing().getId())
                    .username(f.getFollowing().getUsername())
                    .displayName(p != null ? p.getDisplayName() : f.getFollowing().getUsername())
                    .avatarUrl(p != null ? p.getAvatarUrl() : "")
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @Data
    @Builder
    public static class FollowRequestDto {
        private UUID requestId;
        private UUID senderId;
        private String username;
        private String displayName;
        private String avatarUrl;
        private String createdAt;
    }

    @Data
    @Builder
    public static class SocialUserDto {
        private UUID userId;
        private String username;
        private String displayName;
        private String avatarUrl;
    }
}
