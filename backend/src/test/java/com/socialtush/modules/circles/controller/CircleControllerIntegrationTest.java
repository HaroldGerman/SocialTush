package com.socialtush.modules.circles.controller;

import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.entity.CircleMember;
import com.socialtush.modules.circles.repository.CircleMemberRepository;
import com.socialtush.modules.circles.repository.CircleRepository;
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

import java.time.Instant;
import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CircleControllerIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired CircleRepository circleRepository;
    @Autowired CircleMemberRepository memberRepository;
    @Autowired PostRepository postRepository;
    @Autowired UserRepository userRepository;
    @Autowired ProfileRepository profileRepository;

    private User member;
    private User outsider;
    private Circle publicCircle;
    private Circle privateCircle;

    @BeforeEach
    void setup() {
        member = user("circle_member");
        outsider = user("circle_outsider");
        publicCircle = circle("circle-public", "PUBLIC");
        privateCircle = circle("circle-private", "PRIVATE");
        memberRepository.save(CircleMember.builder().circle(publicCircle).user(member).role("OWNER").build());
        memberRepository.save(CircleMember.builder().circle(privateCircle).user(member).role("OWNER").build());
        authenticate(member);
    }

    @Test
    void publicDetailAndPostsAreAccessibleAndIsolatedOrderedAndPaged() throws Exception {
        Circle otherCircle = circle("circle-other", "PUBLIC");
        postRepository.save(Post.builder().user(member).circle(publicCircle).caption("older").createdAt(Instant.parse("2026-01-01T00:00:00Z")).build());
        postRepository.save(Post.builder().user(member).circle(publicCircle).caption("newest").createdAt(Instant.parse("2026-02-01T00:00:00Z")).build());
        postRepository.save(Post.builder().user(member).circle(otherCircle).caption("wrong-circle").createdAt(Instant.parse("2026-03-01T00:00:00Z")).build());

        mockMvc.perform(get("/api/v1/circles/circle-public").with(auth(outsider)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activeNowCount").value(0))
                .andExpect(jsonPath("$.isMember").value(false));
        mockMvc.perform(get("/api/v1/circles/circle-public/posts?page=0&size=1").with(auth(outsider)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1))
                .andExpect(jsonPath("$.posts[0].caption").value("newest"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/v1/circles/circle-public/posts?page=1&size=1").with(auth(outsider)))
                .andExpect(jsonPath("$.posts[0].caption").value("older"));
    }

    @Test
    void privateDetailAndPostsRejectOutsiderButAllowMember() throws Exception {
        postRepository.save(Post.builder().user(member).circle(privateCircle).caption("private-content").build());
        mockMvc.perform(get("/api/v1/circles/circle-private").with(auth(outsider))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/circles/circle-private/posts").with(auth(outsider))).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/circles/circle-private").with(auth(member))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/circles/circle-private/posts").with(auth(member)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.posts[0].caption").value("private-content"));
    }

    @Test
    void userCirclesExposeOwnPrivateMembershipButOnlyPublicForOthers() throws Exception {
        mockMvc.perform(get("/api/v1/circles/user/circle_member").with(auth(member)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(get("/api/v1/circles/user/circle_member").with(auth(outsider)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].slug").value("circle-public"));
    }

    private User user(String username) {
        User user = userRepository.save(User.builder().username(username).email(username + "@test.dev")
                .passwordHash("pass").role("USER").build());
        profileRepository.save(Profile.builder().user(user).displayName(username).build());
        return user;
    }

    private Circle circle(String slug, String visibility) {
        return circleRepository.save(Circle.builder().name(slug).slug(slug).description(slug)
                .visibility(visibility).type("GENERAL").owner(member).membersCount(1).activeNowCount(0).build());
    }

    private void authenticate(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList()));
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor auth(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList()));
    }
}
