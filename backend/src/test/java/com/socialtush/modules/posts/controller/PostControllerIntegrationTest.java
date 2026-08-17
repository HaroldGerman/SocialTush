package com.socialtush.modules.posts.controller;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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

    private User testUser;

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
}
