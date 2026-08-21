package com.socialtush.modules.comments.controller;

import com.socialtush.modules.comments.entity.Comment;
import com.socialtush.modules.comments.entity.CommentResonance;
import com.socialtush.modules.comments.repository.CommentRepository;
import com.socialtush.modules.comments.repository.CommentResonanceRepository;
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
    private final CommentResonanceRepository commentResonanceRepository;
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
                .map(comment -> convertToDto(comment, currentUser))
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
            if (parent == null || !parent.getPost().getId().equals(postId)) {
                return ResponseEntity.badRequest().body(Map.of("message", "El eco al que intentas responder no pertenece a esta publicación"));
            }
        }

        Comment comment = Comment.builder()
                .post(post)
                .user(currentUser)
                .parent(parent)
                .content(request.getContent().trim())
                .build();

        comment = commentRepository.save(comment);

        notificationService.createNotification(post.getUser(), currentUser, "COMMENT", post.getId());
        if (parent != null && !parent.getUser().getId().equals(currentUser.getId())) {
            notificationService.createNotification(parent.getUser(), currentUser, "COMMENT_REPLY", parent.getId());
        }

        return ResponseEntity.ok(convertToDto(comment, currentUser));
    }

    @GetMapping("/replies/{commentId}")
    public ResponseEntity<?> getCommentReplies(@PathVariable UUID commentId, @AuthenticationPrincipal User currentUser) {
        Comment parent = commentRepository.findById(commentId).orElse(null);
        if (parent == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Eco no encontrado"));
        if (!postService.canViewPost(parent.getPost(), currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No tienes acceso a esta publicación"));
        }
        List<Comment> replies = commentRepository.findByParentIdOrderByCreatedAtAsc(commentId);
        List<CommentDto> dtos = replies.stream()
                .map(comment -> convertToDto(comment, currentUser))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/{commentId}/resonate")
    public ResponseEntity<?> toggleResonance(@PathVariable UUID commentId, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        Comment comment = commentRepository.findById(commentId).orElse(null);
        if (comment == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Eco no encontrado"));
        if (!postService.canViewPost(comment.getPost(), currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No tienes acceso a esta publicación"));
        }

        boolean resonated;
        if (commentResonanceRepository.existsByCommentIdAndUserId(commentId, currentUser.getId())) {
            commentResonanceRepository.deleteByCommentIdAndUserId(commentId, currentUser.getId());
            resonated = false;
        } else {
            commentResonanceRepository.save(CommentResonance.builder()
                    .comment(comment)
                    .user(currentUser)
                    .build());
            resonated = true;
        }

        long count = commentResonanceRepository.countByCommentId(commentId);
        return ResponseEntity.ok(Map.of("resonated", resonated, "count", count));
    }

    private CommentDto convertToDto(Comment comment, User currentUser) {
        Profile profile = profileRepository.findById(comment.getUser().getId()).orElse(null);
        long resonanceCount = commentResonanceRepository.countByCommentId(comment.getId());
        boolean resonatedByMe = currentUser != null && commentResonanceRepository.existsByCommentIdAndUserId(comment.getId(), currentUser.getId());
        return CommentDto.builder()
                .commentId(comment.getId())
                .content(comment.getContent())
                .userId(comment.getUser().getId())
                .username(comment.getUser().getUsername())
                .displayName(profile != null ? profile.getDisplayName() : comment.getUser().getUsername())
                .avatarUrl(profile != null ? profile.getAvatarUrl() : "")
                .parentId(comment.getParent() != null ? comment.getParent().getId() : null)
                .resonanceCount(resonanceCount)
                .resonatedByMe(resonatedByMe)
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
        private long resonanceCount;
        private boolean resonatedByMe;
        private String createdAt;
    }
}
