package com.socialtush.modules.likes.controller;

import com.socialtush.modules.likes.entity.Like;
import com.socialtush.modules.likes.repository.LikeRepository;
import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/likes")
@RequiredArgsConstructor
public class LikeController {

    private final LikeRepository likeRepository;
    private final PostRepository postRepository;
    private final NotificationService notificationService;

    @PostMapping("/{targetId}")
    public ResponseEntity<?> toggleLike(
            @PathVariable UUID targetId,
            @RequestParam(value = "type", defaultValue = "POST") String targetType,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        String typeUpper = targetType.toUpperCase().trim();
        if (!"POST".equals(typeUpper) && !"COMMENT".equals(typeUpper)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tipo de target inválido. Use POST o COMMENT"));
        }

        Optional<Like> existingLike = likeRepository.findByUserAndTargetIdAndTargetType(currentUser, targetId, typeUpper);
        boolean liked;
        if (existingLike.isPresent()) {
            likeRepository.delete(existingLike.get());
            liked = false;
        } else {
            Like like = Like.builder()
                    .user(currentUser)
                    .targetId(targetId)
                    .targetType(typeUpper)
                    .build();
            likeRepository.save(like);
            liked = true;

            // Trigger Notification
            if ("POST".equals(typeUpper)) {
                postRepository.findById(targetId).ifPresent(post -> {
                    notificationService.createNotification(post.getUser(), currentUser, "LIKE_POST", targetId);
                });
            }
        }

        long count = likeRepository.countByTargetIdAndTargetType(targetId, typeUpper);

        return ResponseEntity.ok(Map.of(
                "liked", liked,
                "count", count,
                "message", liked ? "Me gusta registrado" : "Me gusta retirado"
        ));
    }

    @PostMapping("/toggle")
    public ResponseEntity<?> toggleLikeBody(
            @RequestBody LikeToggleRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        if (request == null || request.getTargetId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "targetId es requerido"));
        }
        String type = request.getTargetType() != null ? request.getTargetType() : "POST";
        return toggleLike(request.getTargetId(), type, currentUser);
    }

    @Data
    public static class LikeToggleRequest {
        private UUID targetId;
        private String targetType;
    }
}
