package com.socialtush.modules.posts.controller;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
    void chat_creatingConversationTwice_returnsSameConversation() throws Exception {
        String requestBody = "{\"recipientUsername\": \"other_user\", \"isGroup\": false}";

        // First call to create conversation
        String response1 = mockMvc.perform(post("/api/v1/chat/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").exists())
                .andReturn().getResponse().getContentAsString();

        // Second call to create conversation with same recipient
        String response2 = mockMvc.perform(post("/api/v1/chat/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").exists())
                .andReturn().getResponse().getContentAsString();

        // Check both responses returned same ID
        org.json.JSONObject obj1 = new org.json.JSONObject(response1);
        org.json.JSONObject obj2 = new org.json.JSONObject(response2);
        org.junit.jupiter.api.Assertions.assertEquals(
                obj1.getString("conversationId"), 
                obj2.getString("conversationId")
        );
    }
}
