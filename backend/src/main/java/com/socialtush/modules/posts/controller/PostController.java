package com.socialtush.modules.posts.controller;

import com.socialtush.modules.comments.repository.CommentRepository;
import com.socialtush.modules.likes.repository.LikeRepository;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.entity.PostMedia;
import com.socialtush.modules.posts.entity.SavedPost;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.posts.repository.SavedPostRepository;
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
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

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

        if ((caption == null || caption.isBlank()) && (files == null || files.length == 0)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Se requiere al menos texto o archivo multimedia"));
        }

        // 1. Create Post
        Post post = Post.builder()
                .user(currentUser)
                .caption(caption)
                .location(location)
                .musicTitle(musicTitle)
                .isShortVideo(isShortVideo)
                .build();
        post = postRepository.save(post);

        // 2. Upload Files and Create PostMedia (if files provided)
        List<PostMedia> mediaList = new ArrayList<>();
        if (files != null && files.length > 0) {
            for (int i = 0; i < files.length; i++) {
                MultipartFile file = files[i];
                try {
                    String originalFilename = file.getOriginalFilename();
                    String ext = originalFilename != null && originalFilename.contains(".")
                            ? originalFilename.substring(originalFilename.lastIndexOf("."))
                            : ".jpg";
                    String randomFilename = UUID.randomUUID().toString() + ext;

                    // Upload
                    String fileUrl = storageService.uploadFile(randomFilename, file.getBytes(), file.getContentType());

                    PostMedia media = PostMedia.builder()
                            .post(post)
                            .mediaType(file.getContentType() != null && file.getContentType().startsWith("video") ? "VIDEO" : "IMAGE")
                            .originalUrl(fileUrl)
                            .mediumUrl(fileUrl)
                            .thumbnailUrl(fileUrl)
                            .displayOrder(i)
                            .build();

                    mediaList.add(media);
                } catch (Exception e) {
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("message", "Error al procesar archivo: " + e.getMessage()));
                }
            }
        }
        post.setMediaList(mediaList);
        post = postRepository.save(post);

        return ResponseEntity.ok(convertToDto(post, currentUser));
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

        // Get followed users
        List<User> followings = followRepository.findByFollower(currentUser).stream()
                .map(Follow::getFollowing)
                .collect(Collectors.toList());

        Page<Post> postPage;
        if (followings.isEmpty()) {
            // Fallback: show standard recent public posts
            postPage = postRepository.findAll(pageable);
        } else {
            postPage = postRepository.findFeedPosts(followings, currentUser, pageable);
            if (postPage.isEmpty()) {
                postPage = postRepository.findAll(pageable);
            }
        }

        List<PostDto> dtos = postPage.getContent().stream()
                .map(p -> convertToDto(p, currentUser))
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
                .map(p -> convertToDto(p, currentUser))
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

        // Verify privacy boundaries
        Profile targetProfile = profileRepository.findById(targetUser.getId()).orElse(null);
        boolean isSelf = currentUser != null && currentUser.getId().equals(targetUser.getId());
        boolean isFollowing = currentUser != null && followRepository.existsByFollowerAndFollowing(currentUser, targetUser);

        if (targetProfile != null && targetProfile.isPrivate() && !isSelf && !isFollowing) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Esta cuenta es privada"));
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Post> postPage = postRepository.findByUserOrderByCreatedAtDesc(targetUser, pageable);

        List<PostDto> dtos = postPage.getContent().stream()
                .map(p -> convertToDto(p, currentUser))
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
                .map(post -> convertToDto(post, currentUser))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "posts", dtos,
                "currentPage", reelsPage.getNumber(),
                "totalItems", reelsPage.getTotalElements(),
                "totalPages", reelsPage.getTotalPages(),
                "isLast", reelsPage.isLast()
        ));
    }

    private PostDto convertToDto(Post post, User currentUser) {
        Profile profile = profileRepository.findById(post.getUser().getId()).orElse(null);
        
        long likesCount = likeRepository.countByTargetIdAndTargetType(post.getId(), "POST");
        long commentsCount = commentRepository.countByPostId(post.getId());
        
        boolean hasLiked = currentUser != null && likeRepository.existsByUserAndTargetIdAndTargetType(currentUser, post.getId(), "POST");
        boolean isSaved = currentUser != null && savedPostRepository.existsByUserAndPostId(currentUser, post.getId());

        List<String> mediaUrls = post.getMediaList().stream()
                .map(PostMedia::getOriginalUrl)
                .collect(Collectors.toList());

        return PostDto.builder()
                .postId(post.getId())
                .userId(post.getUser().getId())
                .username(post.getUser().getUsername())
                .displayName(profile != null ? profile.getDisplayName() : post.getUser().getUsername())
                .avatarUrl(profile != null ? profile.getAvatarUrl() : "")
                .caption(post.getCaption())
                .location(post.getLocation())
                .musicTitle(post.getMusicTitle())
                .mediaUrls(mediaUrls)
                .likesCount(likesCount)
                .commentsCount(commentsCount)
                .hasLiked(hasLiked)
                .isSaved(isSaved)
                .createdAt(post.getCreatedAt() != null ? post.getCreatedAt().toString() : java.time.Instant.now().toString())
                .build();
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
