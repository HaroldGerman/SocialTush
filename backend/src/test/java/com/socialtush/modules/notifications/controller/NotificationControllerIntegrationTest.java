package com.socialtush.modules.notifications.controller;

import com.socialtush.modules.notifications.entity.Notification;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class NotificationControllerIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired EntityManager entityManager;

    @Test
    void markReadPersistsAndKeepsNotificationInHistory() throws Exception {
        User receiver = userRepository.save(User.builder()
                .username("notification_receiver")
                .email("notification-receiver@example.com")
                .passwordHash("x")
                .build());
        User sender = userRepository.save(User.builder()
                .username("notification_sender")
                .email("notification-sender@example.com")
                .passwordHash("x")
                .build());
        Notification notification = notificationRepository.save(Notification.builder()
                .receiver(receiver)
                .sender(sender)
                .notificationType("FOLLOW")
                .targetId(sender.getId())
                .isRead(false)
                .build());

        var auth = authentication(new UsernamePasswordAuthenticationToken(receiver, null, Collections.emptyList()));
        mockMvc.perform(patch("/api/v1/notifications/" + notification.getId() + "/read").with(auth))
                .andExpect(status().isOk());

        entityManager.flush();
        entityManager.clear();
        assertTrue(notificationRepository.findById(notification.getId()).orElseThrow().isRead());

        mockMvc.perform(get("/api/v1/notifications").with(auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].notificationId").value(notification.getId().toString()))
                .andExpect(jsonPath("$[0].isRead").value(true));
    }
}
