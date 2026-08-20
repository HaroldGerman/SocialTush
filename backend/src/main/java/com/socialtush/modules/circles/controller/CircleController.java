package com.socialtush.modules.circles.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.entity.CircleMember;
import com.socialtush.modules.circles.service.CircleService;
import com.socialtush.modules.posts.controller.PostController.PostDto;
import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.posts.service.PostService;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/circles")
@RequiredArgsConstructor
public class CircleController {

    private final CircleService circleService;
    private final PostRepository postRepository;
    private final PostService postService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<CircleDto>> getAllCircles(@AuthenticationPrincipal User currentUser) {
        List<Circle> circles = circleService.getAllPublicCircles();
        List<CircleDto> dtos = circles.stream().map(c -> toDto(c, currentUser, null)).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{slug}")
    public ResponseEntity<?> getCircleBySlug(@PathVariable String slug, @AuthenticationPrincipal User currentUser) {
        Circle circle = circleService.getVisibleCircle(slug, currentUser);
        return ResponseEntity.ok(toDto(circle, currentUser, null));
    }

    @GetMapping("/{slug}/posts")
    public ResponseEntity<?> getCirclePosts(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        Circle circle = circleService.getVisibleCircle(slug, currentUser);
        Pageable pageable = PageRequest.of(page, Math.min(Math.max(size, 1), 100));
        Page<Post> posts = postRepository.findByCircleIdOrderByCreatedAtDesc(circle.getId(), pageable);
        List<PostDto> dtos = posts.getContent().stream().map(post -> postService.convertToDto(post, currentUser)).toList();
        return ResponseEntity.ok(Map.of(
                "posts", dtos,
                "currentPage", posts.getNumber(),
                "totalItems", posts.getTotalElements(),
                "totalPages", posts.getTotalPages(),
                "isLast", posts.isLast()
        ));
    }

    @GetMapping("/mine")
    public ResponseEntity<?> getMyCircles(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        List<CircleMember> members = circleService.getUserCircles(currentUser);
        List<CircleDto> dtos = members.stream().map(m -> toDto(m.getCircle(), currentUser, m.getRole())).toList();
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/user/{username}")
    public ResponseEntity<?> getUserCircles(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        User target = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (target == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        boolean isSelf = currentUser != null && currentUser.getId().equals(target.getId());
        List<CircleDto> circles = circleService.getVisibleUserCircles(target, currentUser).stream()
                .map(member -> toDto(member.getCircle(), currentUser, isSelf ? member.getRole() : null))
                .toList();
        return ResponseEntity.ok(circles);
    }

    @PostMapping
    public ResponseEntity<?> createCircle(@RequestBody CreateCircleDto request, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        if (request.getName() == null || request.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El nombre del círculo es obligatorio"));
        }

        Circle circle = circleService.createCircle(
                request.getName(),
                request.getDescription(),
                request.getVisibility(),
                request.getType(),
                request.getCity(),
                request.getCountry(),
                currentUser
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Círculo creado con éxito",
                "id", circle.getId(),
                "slug", circle.getSlug()
        ));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<?> joinCircle(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        boolean success = circleService.joinCircle(id, currentUser);
        if (!success) {
            return ResponseEntity.badRequest().body(Map.of("message", "No se pudo unir al círculo"));
        }
        return ResponseEntity.ok(Map.of("message", "Te has unido al círculo con éxito", "joined", true));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<?> leaveCircle(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        boolean success = circleService.leaveCircle(id, currentUser);
        if (!success) {
            return ResponseEntity.badRequest().body(Map.of("message", "No se pudo salir del círculo"));
        }
        return ResponseEntity.ok(Map.of("message", "Has salido del círculo con éxito", "joined", false));
    }

    private CircleDto toDto(Circle circle, User currentUser, String role) {
        return CircleDto.builder()
                .id(circle.getId()).name(circle.getName()).slug(circle.getSlug())
                .description(circle.getDescription()).avatarUrl(circle.getAvatarUrl()).coverUrl(circle.getCoverUrl())
                .visibility(circle.getVisibility()).type(circle.getType()).city(circle.getCity()).country(circle.getCountry())
                .language(circle.getLanguage()).membersCount(circle.getMembersCount()).activeNowCount(circle.getActiveNowCount())
                .isMember(circleService.isMember(circle.getId(), currentUser)).role(role).build();
    }

    @Data
    @Builder
    public static class CircleDto {
        private UUID id;
        private String name;
        private String slug;
        private String description;
        private String avatarUrl;
        private String coverUrl;
        private String visibility;
        private String type;
        private String city;
        private String country;
        private String language;
        private int membersCount;
        private int activeNowCount;
        @JsonProperty("isMember")
        private boolean isMember;
        private String role;
    }

    @Data
    public static class CreateCircleDto {
        private String name;
        private String description;
        private String visibility;
        private String type;
        private String city;
        private String country;
    }
}
