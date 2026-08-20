package com.socialtush.modules.chat.controller;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageAttachment;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.chat.service.ChatService;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {
    @Mock ConversationRepository conversations;
    @Mock ConversationParticipantRepository participants;
    @Mock MessageRepository messages;
    @Mock UserRepository users;
    @Mock ProfileRepository profiles;
    @Mock NotificationRepository notifications;
    @Mock ChatService chatService;
    @Mock SimpMessagingTemplate messaging;

    @Test
    void getMessagesReturnsAttachmentMetadata() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("sender");
        UUID conversationId = UUID.randomUUID();
        Conversation conversation = Conversation.builder().id(conversationId).isGroup(false).createdBy(user).build();
        Message message = Message.builder().id(UUID.randomUUID()).conversation(conversation).sender(user)
                .content("").messageType("IMAGE").createdAt(Instant.now()).build();
        message.getAttachments().add(MessageAttachment.builder().id(UUID.randomUUID()).message(message)
                .fileUrl("https://cdn/chat/photo.jpg").fileType("IMAGE").fileName("photo.jpg")
                .fileSize(123L).build());
        when(participants.findByConversationIdAndUserId(conversationId, user.getId()))
                .thenReturn(Optional.of(ConversationParticipant.builder().conversation(conversation).user(user).build()));
        when(messages.findByConversationIdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(new PageImpl<>(List.of(message)));
        ChatController controller = new ChatController(conversations, participants, messages, users, profiles, notifications, chatService, messaging);

        ResponseEntity<?> response = controller.getMessages(conversationId, 0, 30, user);

        @SuppressWarnings("unchecked")
        List<ChatController.MessageResponseDto> body = (List<ChatController.MessageResponseDto>) response.getBody();
        assertThat(body).singleElement().satisfies(dto -> assertThat(dto.getAttachments()).singleElement().satisfies(attachment -> {
            assertThat(attachment.getFileType()).isEqualTo("IMAGE");
            assertThat(attachment.getFileUrl()).isEqualTo("https://cdn/chat/photo.jpg");
            assertThat(attachment.getFileSize()).isEqualTo(123L);
        }));
    }
}
