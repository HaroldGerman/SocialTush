package com.socialtush.modules.profiles.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.Data;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProfileControllerIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired PostRepository postRepository;
    @Autowired FollowRepository followRepository;
    @Autowired EntityManager entityManager;
    @Autowired ObjectMapper objectMapper;
    @MockBean StorageService storageService;

    private User owner;
    private User viewer;
    private Profile profile;
    private Post post;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder().username("privacy_owner").email("privacy-owner@example.com").passwordHash("x").build());
        viewer = userRepository.save(User.builder().username("privacy_viewer").email("privacy-viewer@example.com").passwordHash("x").build());
        profile = profileRepository.save(Profile.builder().user(owner).displayName("Owner").bio("").isPrivate(false).build());
        profileRepository.save(Profile.builder().user(viewer).displayName("Viewer").bio("").isPrivate(false).build());
        post = postRepository.save(Post.builder().user(owner).caption("Privado").build());
    }

    @Test
    void legacyPrimitiveBooleanWasExposedToJacksonAsPrivate() {
        var names = objectMapper.getDeserializationConfig().introspect(objectMapper.constructType(LegacyProfileUpdateDto.class))
                .findProperties().stream().map(property -> property.getName()).toList();
        assertTrue(names.contains("private"));
        assertFalse(names.contains("isPrivate"));
    }

    @Test
    void jsonUpdatePersistsFalseToTrueAndGetReturnsIt() throws Exception {
        putProfile("{\"displayName\":\"Test\",\"bio\":\"\",\"isPrivate\":true}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPrivate").value(true));
        flushAndClear();
        assertTrue(profileRepository.findById(owner.getId()).orElseThrow().isPrivate());
        mockMvc.perform(get("/api/v1/profiles/privacy_owner").with(authRequest(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPrivate").value(true));
    }

    @Test
    void jsonUpdatePersistsTrueToFalse() throws Exception {
        profile.setPrivate(true); profileRepository.save(profile); flushAndClear();
        putProfile("{\"isPrivate\":false}").andExpect(status().isOk()).andExpect(jsonPath("$.isPrivate").value(false));
        flushAndClear();
        assertFalse(profileRepository.findById(owner.getId()).orElseThrow().isPrivate());
    }

    @Test
    void partialJsonUpdateDoesNotMakePrivateProfilePublic() throws Exception {
        profile.setPrivate(true); profileRepository.save(profile); flushAndClear();
        putProfile("{\"displayName\":\"Nuevo nombre\",\"bio\":\"Nueva bio\"}").andExpect(status().isOk());
        flushAndClear();
        assertTrue(profileRepository.findById(owner.getId()).orElseThrow().isPrivate());
    }

    @Test
    void multipartPrivacyUpdateStillWorks() throws Exception {
        mockMvc.perform(multipart("/api/v1/profiles/me").param("isPrivate", "true")
                        .with(request -> { request.setMethod("PATCH"); return request; }).with(authRequest(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isPrivate").value(true));
        flushAndClear();
        assertTrue(profileRepository.findById(owner.getId()).orElseThrow().isPrivate());
    }

    @Test
    void privatePostsAreForbiddenToNonFollowerAndVisibleToApprovedFollower() throws Exception {
        profile.setPrivate(true); profileRepository.save(profile); flushAndClear();
        mockMvc.perform(get("/api/v1/profiles/privacy_owner").with(authRequest(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPrivate").value(true))
                .andExpect(jsonPath("$.canViewContent").value(false))
                .andExpect(jsonPath("$.relationshipStatus").value("NONE"))
                .andExpect(jsonPath("$.postCount").value(1));
        mockMvc.perform(get("/api/v1/posts/user/privacy_owner").with(authRequest(viewer))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/posts/" + post.getId()).with(authRequest(viewer))).andExpect(status().isForbidden());

        User managedViewer = userRepository.findById(viewer.getId()).orElseThrow();
        User managedOwner = userRepository.findById(owner.getId()).orElseThrow();
        followRepository.save(Follow.builder().follower(managedViewer).following(managedOwner).build());
        flushAndClear();
        mockMvc.perform(get("/api/v1/profiles/privacy_owner").with(authRequest(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canViewContent").value(true))
                .andExpect(jsonPath("$.relationshipStatus").value("FOLLOWING"))
                .andExpect(jsonPath("$.postCount").value(1));
        mockMvc.perform(get("/api/v1/posts/user/privacy_owner").with(authRequest(viewer))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/posts/" + post.getId()).with(authRequest(viewer))).andExpect(status().isOk());
    }

    @Test
    void publicProfileExposesRealPostCountAndContentAccess() throws Exception {
        postRepository.save(Post.builder().user(owner).caption("Segundo momento").build());
        flushAndClear();

        mockMvc.perform(get("/api/v1/profiles/privacy_owner").with(authRequest(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPrivate").value(false))
                .andExpect(jsonPath("$.canViewContent").value(true))
                .andExpect(jsonPath("$.relationshipStatus").value("NONE"))
                .andExpect(jsonPath("$.postCount").value(2));
    }

    private org.springframework.test.web.servlet.ResultActions putProfile(String json) throws Exception {
        return mockMvc.perform(put("/api/v1/profiles/me").with(authRequest(owner)).contentType(MediaType.APPLICATION_JSON).content(json));
    }
    private org.springframework.test.web.servlet.request.RequestPostProcessor authRequest(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList()));
    }
    private void flushAndClear() { entityManager.flush(); entityManager.clear(); }

    @Data
    static class LegacyProfileUpdateDto { private boolean isPrivate; }
}
