package com.socialtush.modules.notifications.controller;

import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WebPushControllerIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired WebPushSubscriptionRepository repository;

    @Test
    void authenticatedUserCanUpsertOwnSubscriptionWithoutDuplicates() throws Exception {
        User user = user("push_owner", "push-owner@example.com");
        String json = subscriptionJson("https://push.example.test/a");
        var auth = authentication(new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList()));

        mockMvc.perform(post("/api/v1/push/web/subscriptions").with(auth)
                        .contentType("application/json").content(json))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/push/web/subscriptions").with(auth)
                        .contentType("application/json").content(json))
                .andExpect(status().isOk());

        assertEquals(1, repository.count());
        assertEquals(user.getId(), repository.findByEndpoint("https://push.example.test/a").orElseThrow().getUser().getId());
    }

    @Test
    void userCannotDeleteAnotherUsersSubscription() throws Exception {
        User owner = user("push_owner_2", "push-owner-2@example.com");
        User stranger = user("push_stranger", "push-stranger@example.com");
        var ownerAuth = authentication(new UsernamePasswordAuthenticationToken(owner, null, Collections.emptyList()));
        var strangerAuth = authentication(new UsernamePasswordAuthenticationToken(stranger, null, Collections.emptyList()));
        String json = subscriptionJson("https://push.example.test/private");

        mockMvc.perform(post("/api/v1/push/web/subscriptions").with(ownerAuth)
                .contentType("application/json").content(json)).andExpect(status().isOk());
        mockMvc.perform(delete("/api/v1/push/web/subscriptions").with(strangerAuth)
                .contentType("application/json")
                .content("{\"endpoint\":\"https://push.example.test/private\"}"))
                .andExpect(status().isNotFound());

        assertTrue(repository.findByEndpoint("https://push.example.test/private").isPresent());
    }

    private User user(String username, String email) {
        return userRepository.save(User.builder().username(username).email(email).passwordHash("x").build());
    }

    private String subscriptionJson(String endpoint) {
        return "{\"endpoint\":\"" + endpoint + "\",\"keys\":{\"p256dh\":\"public-key\",\"auth\":\"auth-key\"}}";
    }
}
