package com.socialtush.modules.search.controller;

import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.repository.CircleRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final ProfileRepository profileRepository;
    private final CircleRepository circleRepository;

    @GetMapping
    public ResponseEntity<?> search(@RequestParam(value = "query", defaultValue = "") String query) {
        String cleanQuery = query != null ? query.trim() : "";
        if (cleanQuery.isEmpty()) {
            return ResponseEntity.ok(SearchResponseDto.builder()
                    .users(List.of())
                    .circles(List.of())
                    .build());
        }

        List<Profile> matchingProfiles = profileRepository
                .findByDisplayNameContainingIgnoreCaseOrUserUsernameContainingIgnoreCase(cleanQuery, cleanQuery);

        List<UserSearchResultDto> userDtos = matchingProfiles.stream().map(p -> UserSearchResultDto.builder()
                .userId(p.getUser().getId().toString())
                .username(p.getUser().getUsername())
                .displayName(p.getDisplayName())
                .avatarUrl(p.getAvatarUrl() != null ? p.getAvatarUrl() : "")
                .bio(p.getBio() != null ? p.getBio() : "")
                .build()).collect(Collectors.toList());

        List<Circle> matchingCircles = circleRepository
                .findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(cleanQuery, cleanQuery);

        List<CircleSearchResultDto> circleDtos = matchingCircles.stream().map(c -> CircleSearchResultDto.builder()
                .name(c.getName())
                .slug(c.getSlug())
                .description(c.getDescription())
                .avatarUrl(c.getAvatarUrl() != null ? c.getAvatarUrl() : "")
                .membersCount(c.getMembersCount())
                .build()).collect(Collectors.toList());

        return ResponseEntity.ok(SearchResponseDto.builder()
                .users(userDtos)
                .circles(circleDtos)
                .build());
    }

    @Data
    @Builder
    public static class SearchResponseDto {
        private List<UserSearchResultDto> users;
        private List<CircleSearchResultDto> circles;
    }

    @Data
    @Builder
    public static class UserSearchResultDto {
        private String userId;
        private String username;
        private String displayName;
        private String avatarUrl;
        private String bio;
    }

    @Data
    @Builder
    public static class CircleSearchResultDto {
        private String name;
        private String slug;
        private String description;
        private String avatarUrl;
        private int membersCount;
    }
}
