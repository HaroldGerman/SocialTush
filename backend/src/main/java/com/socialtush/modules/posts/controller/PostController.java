package com.socialtush.modules.posts.controller;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.entity.SavedPost;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.posts.repository.SavedPostRepository;
import com.socialtush.modules.posts.service.PostService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.repository.FollowRepository;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostRepository postRepository;
    private final SavedPostRepository savedPostRepository;
    private final FollowRepository followRepository;
    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final PostService postService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createPost(
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam(value = "location", required = false) String location,
            @RequestParam(value = "musicTitle", required = false) String musicTitle,
            @RequestParam(value = "isShortVideo", defaultValue = "false") boolean isShortVideo,
            @RequestParam(value = "files", required = false) MultipartFile[] files,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        PostDto dto = postService.createPost(caption, location, musicTitle, isShortVideo, files, currentUser);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/feed")
    public ResponseEntity<?> getFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        List<User> followings = followRepository.findByFollower(currentUser).stream()
                .map(Follow::getFollowing)
                .collect(Collectors.toList());

        Page<Post> postPage;
        if (followings.isEmpty()) {
            postPage = postRepository.findAll(pageable);
        } else {
            postPage = postRepository.findFeedPosts(followings, currentUser, pageable);
            if (postPage.isEmpty()) {
                postPage = postRepository.findAll(pageable);
            }
        }

        List<PostDto> dtos = postPage.getContent().stream()
                .map(p -> postService.convertToDto(p, currentUser))
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("posts", dtos);
        response.put("currentPage", postPage.getNumber());
        response.put("totalItems", postPage.getTotalElements());
        response.put("totalPages", postPage.getTotalPages());
        response.put("isLast", postPage.isLast());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/explore")
    public ResponseEntity<?> getExplore(
            @RequestParam(defaultValue = "false") boolean reelsOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> postPage = postRepository.findExplorePosts(reelsOnly, pageable);

        List<PostDto> dtos = postPage.getContent().stream()
                .map(p -> postService.convertToDto(p, currentUser))
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/user/{username}")
    public ResponseEntity<?> getUserPosts(
            @PathVariable String username,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (targetUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        }

        Profile targetProfile = profileRepository.findById(targetUser.getId()).orElse(null);
        boolean isSelf = currentUser != null && currentUser.getId().equals(targetUser.getId());
        boolean isFollowing = currentUser != null && followRepository.existsByFollowerAndFollowing(currentUser, targetUser);

        if (targetProfile != null && targetProfile.isPrivate() && !isSelf && !isFollowing) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Esta cuenta es privada"));
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Post> postPage = postRepository.findByUserOrderByCreatedAtDesc(targetUser, pageable);

        List<PostDto> dtos = postPage.getContent().stream()
                .map(p -> postService.convertToDto(p, currentUser))
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/{postId}/save")
    public ResponseEntity<?> savePost(@PathVariable UUID postId, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Post post = postRepository.findById(postId).orElse(null);
        if (post == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Publicación no encontrada"));
        }

        Optional<SavedPost> savedOpt = savedPostRepository.findByUserAndPostId(currentUser, postId);
        if (savedOpt.isPresent()) {
            savedPostRepository.delete(savedOpt.get());
            return ResponseEntity.ok(Map.of("saved", false, "message", "Publicación eliminada de guardados"));
        } else {
            SavedPost savedPost = SavedPost.builder()
                    .user(currentUser)
                    .post(post)
                    .build();
            savedPostRepository.save(savedPost);
            return ResponseEntity.ok(Map.of("saved", true, "message", "Publicación guardada con éxito"));
        }
    }

    @GetMapping("/reels")
    public ResponseEntity<?> getReels(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Post> reelsPage = postRepository.findExplorePosts(true, pageable);

        List<PostDto> dtos = reelsPage.getContent().stream()
                .map(post -> postService.convertToDto(post, currentUser))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "posts", dtos,
                "currentPage", reelsPage.getNumber(),
                "totalItems", reelsPage.getTotalElements(),
                "totalPages", reelsPage.getTotalPages(),
                "isLast", reelsPage.isLast()
        ));
    }

    @Data
    @Builder
    public static class PostDto {
        private UUID postId;
        private UUID userId;
        private String username;
        private String displayName;
        private String avatarUrl;
        private String caption;
        private String location;
        private String musicTitle;
        private List<String> mediaUrls;
        private long likesCount;
        private long commentsCount;
        private boolean hasLiked;
        @JsonProperty("isSaved")
        private boolean isSaved;
        private String createdAt;
    }
}
