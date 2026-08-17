package com.socialtush.modules.circles.controller;

import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.entity.CircleMember;
import com.socialtush.modules.circles.service.CircleService;
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
@RequestMapping("/api/v1/circles")
@RequiredArgsConstructor
public class CircleController {

    private final CircleService circleService;

    @GetMapping
    public ResponseEntity<List<CircleDto>> getAllCircles(@AuthenticationPrincipal User currentUser) {
        List<Circle> circles = circleService.getAllPublicCircles();
        List<CircleDto> dtos = circles.stream().map(c -> CircleDto.builder()
                .id(c.getId())
                .name(c.getName())
                .slug(c.getSlug())
                .description(c.getDescription())
                .avatarUrl(c.getAvatarUrl())
                .coverUrl(c.getCoverUrl())
                .visibility(c.getVisibility())
                .type(c.getType())
                .city(c.getCity())
                .country(c.getCountry())
                .language(c.getLanguage())
                .membersCount(c.getMembersCount())
                .activeNowCount(c.getActiveNowCount())
                .isMember(circleService.isMember(c.getId(), currentUser))
                .build()).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{slug}")
    public ResponseEntity<?> getCircleBySlug(@PathVariable String slug, @AuthenticationPrincipal User currentUser) {
        Circle c = circleService.getCircleBySlug(slug.toLowerCase().trim());
        if (c == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Círculo no encontrado"));
        }

        CircleDto dto = CircleDto.builder()
                .id(c.getId())
                .name(c.getName())
                .slug(c.getSlug())
                .description(c.getDescription())
                .avatarUrl(c.getAvatarUrl())
                .coverUrl(c.getCoverUrl())
                .visibility(c.getVisibility())
                .type(c.getType())
                .city(c.getCity())
                .country(c.getCountry())
                .language(c.getLanguage())
                .membersCount(c.getMembersCount())
                .activeNowCount(c.getActiveNowCount())
                .isMember(circleService.isMember(c.getId(), currentUser))
                .build();
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/mine")
    public ResponseEntity<?> getMyCircles(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        List<CircleMember> members = circleService.getUserCircles(currentUser);
        List<CircleDto> dtos = members.stream().map(m -> {
            Circle c = m.getCircle();
            return CircleDto.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .slug(c.getSlug())
                    .description(c.getDescription())
                    .avatarUrl(c.getAvatarUrl())
                    .coverUrl(c.getCoverUrl())
                    .visibility(c.getVisibility())
                    .type(c.getType())
                    .membersCount(c.getMembersCount())
                    .activeNowCount(c.getActiveNowCount())
                    .isMember(true)
                    .role(m.getRole())
                    .build();
        }).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
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
        return ResponseEntity.ok(Map.of("message", "Has salido del círculo con éxito", "joined", false));
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
