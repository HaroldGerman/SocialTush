package com.socialtush.modules.posts.service;

import com.socialtush.modules.comments.repository.CommentRepository;
import com.socialtush.modules.likes.repository.LikeRepository;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.posts.controller.PostController.PostDto;
import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.entity.PostMedia;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.posts.repository.SavedPostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final ProfileRepository profileRepository;
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final SavedPostRepository savedPostRepository;
    private final StorageService storageService;

    @Transactional(rollbackFor = Exception.class)
    public PostDto createPost(String caption, String location, String musicTitle, boolean isShortVideo, MultipartFile[] files, User currentUser) {
        if ((caption == null || caption.isBlank()) && (files == null || files.length == 0)) {
            throw new IllegalArgumentException("Se requiere al menos texto o archivo multimedia");
        }

        // 1. Build initial Post
        Post post = Post.builder()
                .user(currentUser)
                .caption(caption != null ? caption.trim() : "")
                .location(location)
                .musicTitle(musicTitle)
                .isShortVideo(isShortVideo)
                .build();
        post = postRepository.save(post);

        // 2. Upload files and create PostMedia inside the same transaction
        List<PostMedia> mediaList = new ArrayList<>();
        List<String> uploadedFilenames = new ArrayList<>();

        if (files != null && files.length > 0) {
            for (int i = 0; i < files.length; i++) {
                MultipartFile file = files[i];
                if (file == null || file.isEmpty()) continue;

                String originalFilename = file.getOriginalFilename();
                String ext = originalFilename != null && originalFilename.contains(".")
                        ? originalFilename.substring(originalFilename.lastIndexOf("."))
                        : ".jpg";
                String randomFilename = UUID.randomUUID().toString() + ext;

                try {
                    // Upload file to S3/MinIO
                    String fileUrl = storageService.uploadFile(randomFilename, file.getBytes(), file.getContentType());
                    uploadedFilenames.add(randomFilename);

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
                    // Compensating action: clean up any files already uploaded to S3 in this batch
                    for (String uploadedFilename : uploadedFilenames) {
                        try {
                            storageService.deleteFile(uploadedFilename);
                        } catch (Exception ex) {
                            log.error("Failed compensating deletion for file [{}]: {}", uploadedFilename, ex.getMessage());
                        }
                    }
                    log.error("Failed uploading media file [{}] for post. Triggering transaction rollback: {}", originalFilename, e.getMessage());
                    throw new RuntimeException("Error al procesar y guardar la imagen: " + e.getMessage(), e);
                }
            }
        }

        if (!mediaList.isEmpty()) {
            post.setMediaList(mediaList);
            post = postRepository.save(post);
        }

        return convertToDto(post, currentUser);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deletePost(UUID postId, User currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new NoSuchElementException("Publicación no encontrada"));

        if (!post.getUser().getId().equals(currentUser.getId())) {
            throw new SecurityException("No tienes permiso para eliminar esta publicación");
        }

        // Delete physical R2/S3 files for all associated media items
        if (post.getMediaList() != null && !post.getMediaList().isEmpty()) {
            for (PostMedia media : post.getMediaList()) {
                String key = extractFileKey(media.getOriginalUrl());
                if (key != null && !key.isBlank()) {
                    try {
                        storageService.deleteFile(key);
                        log.info("Deleted media file [{}] from R2 for post [{}]", key, postId);
                    } catch (Exception e) {
                        log.error("Failed to delete media file [{}] from R2 for post [{}]: {}", key, postId, e.getMessage());
                    }
                }
            }
        }

        postRepository.delete(post);
        log.info("Post [{}] deleted successfully by user [{}]", postId, currentUser.getUsername());
    }

    public static String extractFileKey(String url) {
        if (url == null || url.isBlank()) return null;
        int lastSlash = url.lastIndexOf('/');
        if (lastSlash >= 0 && lastSlash < url.length() - 1) {
            return url.substring(lastSlash + 1);
        }
        return url;
    }

    public PostDto convertToDto(Post post, User currentUser) {
        Profile profile = profileRepository.findById(post.getUser().getId()).orElse(null);

        long likesCount = likeRepository.countByTargetIdAndTargetType(post.getId(), "POST");
        long commentsCount = commentRepository.countByPostId(post.getId());

        boolean hasLiked = currentUser != null && likeRepository.existsByUserAndTargetIdAndTargetType(currentUser, post.getId(), "POST");
        boolean isSaved = currentUser != null && savedPostRepository.existsByUserAndPostId(currentUser, post.getId());

        List<String> mediaUrls = post.getMediaList() != null ? post.getMediaList().stream()
                .map(PostMedia::getOriginalUrl)
                .collect(Collectors.toList()) : List.of();

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
}
