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
