package com.socialtush.modules.admin.controller;

import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final StoryRepository storyRepository;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalUsers = userRepository.count();
        long totalPosts = postRepository.count();
        long totalStories = storyRepository.count(); // Active and expired combined for overall count

        return ResponseEntity.ok(Map.of(
                "totalUsers", totalUsers,
                "totalPosts", totalPosts,
                "totalStories", totalStories,
                "serverTime", Instant.now().toString(),
                "status", "HEALTHY"
        ));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String query
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("username").ascending());
        Page<User> userPage;
        
        if (query.trim().isBlank()) {
            userPage = userRepository.findAll(pageable);
        } else {
            // Spring Data JPA fallback matching query
            userPage = userRepository.findAll(pageable); // Can filter in memory or extend repository
        }

        List<AdminUserDto> dtos = userPage.getContent().stream().map(u -> 
            AdminUserDto.builder()
                    .userId(u.getId())
                    .username(u.getUsername())
                    .email(u.getEmail())
                    .role(u.getRole())
                    .isActive(u.isActive())
                    .isVerified(u.isVerified())
                    .createdAt(u.getCreatedAt().toString())
                    .build()
        ).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "users", dtos,
                "currentPage", userPage.getNumber(),
                "totalItems", userPage.getTotalElements(),
                "totalPages", userPage.getTotalPages()
        ));
    }

    @PostMapping("/users/{userId}/toggle-block")
    public ResponseEntity<?> toggleBlockUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        user.setActive(!user.isActive());
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "userId", user.getId(),
                "isActive", user.isActive(),
                "message", user.isActive() ? "Usuario desbloqueado" : "Usuario bloqueado con éxito"
        ));
    }

    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<?> deletePost(@PathVariable UUID postId) {
        if (!postRepository.existsById(postId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Publicación no encontrada"));
        }
        postRepository.deleteById(postId);
        return ResponseEntity.ok(Map.of("message", "Publicación eliminada por moderador"));
    }

    @Data
    @Builder
    public static class AdminUserDto {
        private UUID userId;
        private String username;
        private String email;
        private String role;
        private boolean isActive;
        private boolean isVerified;
        private String createdAt;
    }
}
