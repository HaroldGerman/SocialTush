package com.socialtush.modules.comments.controller;

import com.socialtush.modules.comments.entity.Comment;
import com.socialtush.modules.comments.repository.CommentRepository;
import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.posts.service.PostService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final ProfileRepository profileRepository;
    private final NotificationService notificationService;
    private final PostService postService;

    @GetMapping("/{postId}")
    public ResponseEntity<?> getPostComments(@PathVariable UUID postId, @AuthenticationPrincipal User currentUser) {
        Post post = postRepository.findById(postId).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Publicación no encontrada"));
        if (!postService.canViewPost(post, currentUser)) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No tienes acceso a esta publicación"));
        List<Comment> comments = commentRepository.findByPostIdAndParentIsNullOrderByCreatedAtAsc(postId);
        List<CommentDto> dtos = comments.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/{postId}")
    public ResponseEntity<?> createComment(
            @PathVariable UUID postId,
            @RequestBody CommentRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        if (request.getContent() == null || request.getContent().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El contenido del comentario no puede estar vacío"));
        }

        Post post = postRepository.findById(postId).orElse(null);
        if (post == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Publicación no encontrada"));
        }
        if (!postService.canViewPost(post, currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No tienes acceso a esta publicación"));
        }

        Comment parent = null;
        if (request.getParentId() != null) {
            parent = commentRepository.findById(request.getParentId()).orElse(null);
        }

        Comment comment = Comment.builder()
                .post(post)
                .user(currentUser)
                .parent(parent)
                .content(request.getContent().trim())
                .build();

        comment = commentRepository.save(comment);

        // Trigger Notifications
        notificationService.createNotification(post.getUser(), currentUser, "COMMENT", post.getId());
        if (parent != null) {
            notificationService.createNotification(parent.getUser(), currentUser, "COMMENT_REPLY", parent.getId());
        }

        return ResponseEntity.ok(convertToDto(comment));
    }

    @GetMapping("/replies/{commentId}")
    public ResponseEntity<?> getCommentReplies(@PathVariable UUID commentId) {
        List<Comment> replies = commentRepository.findByParentIdOrderByCreatedAtAsc(commentId);
        List<CommentDto> dtos = replies.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    private CommentDto convertToDto(Comment comment) {
        Profile profile = profileRepository.findById(comment.getUser().getId()).orElse(null);
        return CommentDto.builder()
                .commentId(comment.getId())
                .content(comment.getContent())
                .userId(comment.getUser().getId())
                .username(comment.getUser().getUsername())
                .displayName(profile != null ? profile.getDisplayName() : comment.getUser().getUsername())
                .avatarUrl(profile != null ? profile.getAvatarUrl() : "")
                .parentId(comment.getParent() != null ? comment.getParent().getId() : null)
                .createdAt(comment.getCreatedAt().toString())
                .build();
    }

    @Data
    public static class CommentRequest {
        private String content;
        private UUID parentId;
    }

    @Data
    @Builder
    public static class CommentDto {
        private UUID commentId;
        private String content;
        private UUID userId;
        private String username;
        private String displayName;
        private String avatarUrl;
        private UUID parentId;
        private String createdAt;
    }
}
