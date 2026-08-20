package com.socialtush.modules.posts.controller;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.entity.CircleMember;
import com.socialtush.modules.circles.repository.CircleRepository;
import com.socialtush.modules.circles.repository.CircleMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PostControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProfileRepository profileRepository;

    @Autowired
    private FollowRepository followRepository;

    @Autowired
    private CircleRepository circleRepository;

    @Autowired
    private CircleMemberRepository circleMemberRepository;

    @MockBean
    private StorageService storageService;

    private User testUser;
    private User otherUser;

    @BeforeEach
    void setUp() {
        testUser = userRepository.save(User.builder()
                .username("post_author")
                .email("author@socialtush.com")
                .passwordHash("pass")
                .role("USER")
                .build());

        profileRepository.save(Profile.builder()
                .user(testUser)
                .displayName("Post Author")
                .build());

        otherUser = userRepository.save(User.builder()
                .username("other_user")
                .email("other@socialtush.com")
                .passwordHash("pass")
                .role("USER")
                .build());

        profileRepository.save(Profile.builder()
                .user(otherUser)
                .displayName("Other User")
                .build());

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(testUser, null, Collections.emptyList())
        );
    }

    @Test
    void getFeed_returnsOk() throws Exception {
        postRepository.save(Post.builder()
                .user(testUser)
                .caption("¡Hola SocialTush!")
                .build());

        mockMvc.perform(get("/api/v1/posts/feed"))
                .andExpect(status().isOk());
    }

    @Test
    void emptyFeedRemainsEmpty() throws Exception {
        mockMvc.perform(get("/api/v1/posts/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0))
                .andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    void createPost_createsPostSuccessfully() throws Exception {
        mockMvc.perform(multipart("/api/v1/posts")
                        .param("caption", "Mi primer post en SocialTush"))
                .andExpect(status().is2xxSuccessful())
                .andExpect(jsonPath("$.caption").value("Mi primer post en SocialTush"));
        org.junit.jupiter.api.Assertions.assertNull(postRepository.findAll().get(0).getCircle());
    }

    @Test
    void memberCanPublishInCircleAndNonMemberCannot() throws Exception {
        Circle circle = circle("post-circle", "PUBLIC", testUser);
        circleMemberRepository.save(CircleMember.builder().circle(circle).user(testUser).role("OWNER").build());

        mockMvc.perform(multipart("/api/v1/posts")
                        .param("caption", "Dentro del círculo")
                        .param("circleId", circle.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.circleId").value(circle.getId().toString()));

        mockMvc.perform(multipart("/api/v1/posts")
                        .param("caption", "No permitido")
                        .param("circleId", circle.getId().toString())
                        .with(authentication(new UsernamePasswordAuthenticationToken(otherUser, null, Collections.emptyList()))))
                .andExpect(status().isForbidden());

        mockMvc.perform(multipart("/api/v1/posts")
                        .param("caption", "No existe")
                        .param("circleId", java.util.UUID.randomUUID().toString())
                        .with(authentication(new UsernamePasswordAuthenticationToken(otherUser, null, Collections.emptyList()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void circleMediaUsesExistingPostUploadPipeline() throws Exception {
        Circle circle = circle("circle-media", "PUBLIC", testUser);
        circleMemberRepository.save(CircleMember.builder().circle(circle).user(testUser).role("OWNER").build());
        when(storageService.uploadFile(anyString(), any(byte[].class), eq("video/mp4")))
                .thenReturn("https://cdn.example/circle-video.mp4");

        mockMvc.perform(multipart("/api/v1/posts")
                        .file(new MockMultipartFile("files", "clip.mp4", "video/mp4", new byte[]{1, 2, 3}))
                        .param("circleId", circle.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mediaUrls[0]").value("https://cdn.example/circle-video.mp4"))
                .andExpect(jsonPath("$.mediaTypes[0]").value("VIDEO"));
    }

    @Test
    void reelRequiresVideoAndExposesMediaType() throws Exception {
        mockMvc.perform(multipart("/api/v1/posts")
                        .param("caption", "No basta texto")
                        .param("isShortVideo", "true"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(multipart("/api/v1/posts")
                        .file(new MockMultipartFile("files", "cover.jpg", "image/jpeg", new byte[]{1}))
                        .param("isShortVideo", "true"))
                .andExpect(status().isBadRequest());

        when(storageService.uploadFile(anyString(), any(byte[].class), eq("video/mp4")))
                .thenReturn("https://cdn.example/reel.mp4");
        mockMvc.perform(multipart("/api/v1/posts")
                        .file(new MockMultipartFile("files", "reel.mp4", "video/mp4", new byte[]{1, 2}))
                        .param("isShortVideo", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mediaTypes[0]").value("VIDEO"));
    }

    @Test
    void privateCirclePostsAreFilteredUntilViewerBecomesMember() throws Exception {
        Circle publicCircle = circle("public-posts", "PUBLIC", otherUser);
        Circle privateCircle = circle("private-posts", "PRIVATE", otherUser);
        circleMemberRepository.save(CircleMember.builder().circle(publicCircle).user(otherUser).build());
        circleMemberRepository.save(CircleMember.builder().circle(privateCircle).user(otherUser).build());
        followRepository.save(Follow.builder().follower(testUser).following(otherUser).build());

        postRepository.save(Post.builder().user(otherUser).circle(publicCircle).caption("visible-public").build());
        Post hidden = postRepository.save(Post.builder().user(otherUser).circle(privateCircle).caption("hidden-private").build());

        mockMvc.perform(get("/api/v1/posts/feed")).andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1)).andExpect(jsonPath("$.posts[0].caption").value("visible-public"));
        mockMvc.perform(get("/api/v1/posts/explore")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/v1/posts/user/other_user")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(post("/api/v1/posts/" + hidden.getId() + "/save")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/comments/" + hidden.getId())).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/likes/" + hidden.getId())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/posts/" + hidden.getId())).andExpect(status().isForbidden());

        circleMemberRepository.save(CircleMember.builder().circle(privateCircle).user(testUser).build());
        mockMvc.perform(get("/api/v1/posts/feed")).andExpect(jsonPath("$.posts.length()").value(2));
        mockMvc.perform(get("/api/v1/posts/explore")).andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/api/v1/posts/user/other_user")).andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/api/v1/posts/" + hidden.getId())).andExpect(status().isOk());
    }

    @Test
    void deletingOwnCirclePostUsesExistingDeleteFlow() throws Exception {
        Circle circle = circle("delete-circle-post", "PUBLIC", testUser);
        Post post = postRepository.save(Post.builder().user(testUser).circle(circle).caption("Eliminar").build());
        mockMvc.perform(delete("/api/v1/posts/" + post.getId())).andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertFalse(postRepository.existsById(post.getId()));
    }

    private Circle circle(String slug, String visibility, User owner) {
        return circleRepository.save(Circle.builder().name(slug).slug(slug).description(slug)
                .visibility(visibility).type("GENERAL").owner(owner).membersCount(1).activeNowCount(0).build());
    }

    @Test
    void deletePost_ownPost_returnsNoContent() throws Exception {
        Post post = postRepository.save(Post.builder()
                .user(testUser)
                .caption("Post a eliminar")
                .build());

        mockMvc.perform(delete("/api/v1/posts/" + post.getId()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deletePost_otherUserPost_returnsForbidden() throws Exception {
        Post otherPost = postRepository.save(Post.builder()
                .user(otherUser)
                .caption("Post ajeno")
                .build());

        mockMvc.perform(delete("/api/v1/posts/" + otherPost.getId()))
                .andExpect(status().isForbidden());
    }

    @Test
    void feed_returnsOnlyOwnAndFollowedPosts() throws Exception {
        // Save post for other user (not followed yet)
        postRepository.save(Post.builder()
                .user(otherUser)
                .caption("Post de otro usuario")
                .build());

        // A's own post
        Post ownPost = postRepository.save(Post.builder()
                .user(testUser)
                .caption("Mi post propio")
                .build());

        // Feed should contain A's post, but NOT B's post
        mockMvc.perform(get("/api/v1/posts/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1))
                .andExpect(jsonPath("$.posts[0].caption").value("Mi post propio"));

        // Now A follows B
        followRepository.save(Follow.builder()
                .follower(testUser)
                .following(otherUser)
                .build());

        // Feed should now contain BOTH A's post and B's post
        mockMvc.perform(get("/api/v1/posts/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(2));

        // Now A unfollows B
        followRepository.deleteAll(); // removes follow relation

        // Feed should go back to containing only A's own post
        mockMvc.perform(get("/api/v1/posts/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1))
                .andExpect(jsonPath("$.posts[0].caption").value("Mi post propio"));
    }

    @Test
    void chat_openingDoesNotCreateAndMessagesReuseConversation() throws Exception {
        String requestBody = "{\"recipientUsername\": \"other_user\", \"isGroup\": false}";

        mockMvc.perform(post("/api/v1/chat/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/chat/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        String messageBody = "{\"content\": \"Hola\", \"messageType\": \"TEXT\"}";
        String response1 = mockMvc.perform(post("/api/v1/chat/direct/other_user/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(messageBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").exists())
                .andReturn().getResponse().getContentAsString();

        String response2 = mockMvc.perform(post("/api/v1/chat/direct/OTHER_USER/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(messageBody))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        org.json.JSONObject obj1 = new org.json.JSONObject(response1);
        org.json.JSONObject obj2 = new org.json.JSONObject(response2);
        org.junit.jupiter.api.Assertions.assertEquals(
                obj1.getString("conversationId"), 
                obj2.getString("conversationId")
        );
    }

    @Test
    void draftMediaCreatesConversationAndHistoryReturnsAttachment() throws Exception {
        when(storageService.uploadFile(anyString(), any(byte[].class), eq("image/jpeg")))
                .thenReturn("https://cdn.example/chat/photo.jpg");
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3});

        String response = mockMvc.perform(multipart("/api/v1/chat/direct/other_user/messages/media")
                        .file(file).param("content", "Foto real"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message.attachments[0].fileType").value("IMAGE"))
                .andExpect(jsonPath("$.message.attachments[0].fileUrl").value("https://cdn.example/chat/photo.jpg"))
                .andReturn().getResponse().getContentAsString();

        String conversationId = new org.json.JSONObject(response).getString("conversationId");
        mockMvc.perform(get("/api/v1/chat/conversations/" + conversationId + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].attachments[0].fileName").value("photo.jpg"));
    }

}
