package com.socialtush.modules.chat.controller;

import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.service.ChatService;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ChatReadReceiptIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ChatService chatService;
    @Autowired UserRepository users;
    @Autowired ProfileRepository profiles;
    @Autowired ConversationParticipantRepository participants;
    @Autowired NotificationRepository notifications;
    @Autowired EntityManager entityManager;

    private User sender;
    private User recipient;
    private User outsider;

    @BeforeEach
    void setUp() {
        sender = user("receipt_sender");
        recipient = user("receipt_recipient");
        outsider = user("receipt_outsider");
    }

    @Test
    void readStatePersistsAndAFutureMessageReturnsToSentAndUnread() throws Exception {
        ChatService.SendResult first = chatService.sendDirectMessage(sender, recipient.getUsername(), "m1", "TEXT", null);
        ChatService.SendResult second = chatService.sendDirectMessage(sender, recipient.getUsername(), "m2", "TEXT", null);
        var conversationId = first.conversation().getId();

        mockMvc.perform(get("/api/v1/chat/conversations").with(authentication(auth(recipient))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].unreadCount").value(2));
        mockMvc.perform(get("/api/v1/chat/conversations/{id}/messages", conversationId)
                        .with(authentication(auth(sender))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readByRecipient").value(false))
                .andExpect(jsonPath("$[1].readByRecipient").value(false));

        mockMvc.perform(patch("/api/v1/chat/conversations/{id}/read", conversationId)
                        .with(authentication(auth(recipient))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastReadMessageId").value(second.message().getId().toString()));

        entityManager.flush();
        entityManager.clear();
        User reloadedRecipient = users.findById(recipient.getId()).orElseThrow();
        ConversationParticipant reloadedParticipant = participants
                .findByConversationIdAndUserId(conversationId, recipient.getId()).orElseThrow();
        assertThat(reloadedParticipant.getLastReadMessageId()).isEqualTo(second.message().getId());
        assertThat(notifications.findByReceiverOrderByCreatedAtDesc(reloadedRecipient))
                .filteredOn(notification -> "MESSAGE".equals(notification.getNotificationType()))
                .allMatch(notification -> notification.isRead());

        mockMvc.perform(get("/api/v1/chat/conversations").with(authentication(auth(reloadedRecipient))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].unreadCount").value(0));
        mockMvc.perform(get("/api/v1/chat/conversations/{id}/messages", conversationId)
                        .with(authentication(auth(users.findById(sender.getId()).orElseThrow()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readByRecipient").value(true))
                .andExpect(jsonPath("$[1].readByRecipient").value(true));

        User reloadedSender = users.findById(sender.getId()).orElseThrow();
        chatService.sendMessage(reloadedSender, conversationId, "m3", "TEXT", null);
        entityManager.flush();
        entityManager.clear();
        reloadedSender = users.findById(sender.getId()).orElseThrow();
        reloadedRecipient = users.findById(recipient.getId()).orElseThrow();
        mockMvc.perform(get("/api/v1/chat/conversations/{id}/messages", conversationId)
                        .with(authentication(auth(reloadedSender))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readByRecipient").value(true))
                .andExpect(jsonPath("$[1].readByRecipient").value(true))
                .andExpect(jsonPath("$[2].readByRecipient").value(false));
        mockMvc.perform(get("/api/v1/chat/conversations").with(authentication(auth(reloadedRecipient))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].unreadCount").value(1));
    }

    @Test
    void disabledReceiptsRemainPrivateAndOutsiderCannotMarkRead() throws Exception {
        ChatService.SendResult sent = chatService.sendDirectMessage(sender, recipient.getUsername(), "privado", "TEXT", null);
        Profile recipientProfile = profiles.findById(recipient.getId()).orElseThrow();
        recipientProfile.setReadReceiptsEnabled(false);
        profiles.saveAndFlush(recipientProfile);

        mockMvc.perform(patch("/api/v1/chat/conversations/{id}/read", sent.conversation().getId())
                        .with(authentication(auth(recipient))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/chat/conversations/{id}/messages", sent.conversation().getId())
                        .with(authentication(auth(sender))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readReceiptVisible").value(false))
                .andExpect(jsonPath("$[0].readByRecipient").value(false));

        mockMvc.perform(patch("/api/v1/chat/conversations/{id}/read", sent.conversation().getId())
                        .with(authentication(auth(outsider))))
                .andExpect(status().isForbidden());
    }

    private User user(String username) {
        User user = users.save(User.builder().username(username).email(username + "@test.local")
                .passwordHash("hash").role("USER").build());
        profiles.save(Profile.builder().user(user).displayName(username).readReceiptsEnabled(true).build());
        return user;
    }

    private UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList());
    }
}
