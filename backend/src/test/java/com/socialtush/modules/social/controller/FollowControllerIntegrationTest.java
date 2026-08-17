package com.socialtush.modules.social.controller;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class FollowControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProfileRepository profileRepository;

    private User harold;
    private User kathely;

    @BeforeEach
    void setUp() {
        harold = userRepository.save(User.builder()
                .username("harold_test")
                .email("harold@socialtush.com")
                .passwordHash("pass")
                .role("USER")
                .build());

        profileRepository.save(Profile.builder()
                .user(harold)
                .displayName("Harold")
                .build());

        kathely = userRepository.save(User.builder()
                .username("kathely_test")
                .email("kathely@socialtush.com")
                .passwordHash("pass")
                .role("USER")
                .build());

        profileRepository.save(Profile.builder()
                .user(kathely)
                .displayName("Kathely")
                .build());
    }

    @Test
    void followUser_createsFollowRelationship() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(harold, null, Collections.emptyList())
        );

        mockMvc.perform(post("/api/v1/social/follow/kathely_test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }
}
