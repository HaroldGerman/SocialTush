package com.socialtush.modules.chat.controller;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageAttachment;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.chat.repository.MessageReactionRepository;
import com.socialtush.modules.chat.service.ChatService;
import com.socialtush.modules.chat.service.PresenceService;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.profiles.entity.Profile;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {
    @Mock ConversationRepository conversations;
    @Mock ConversationParticipantRepository participants;
    @Mock MessageRepository messages;
    @Mock MessageReactionRepository reactions;
    @Mock UserRepository users;
    @Mock ProfileRepository profiles;
    @Mock NotificationRepository notifications;
    @Mock ChatService chatService;
    @Mock PresenceService presenceService;
    @Mock SimpMessagingTemplate messaging;
    @Mock StoryRepository stories;

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
        ChatController controller = new ChatController(conversations, participants, messages, reactions, users, profiles, notifications, chatService, presenceService, messaging, stories);

        ResponseEntity<?> response = controller.getMessages(conversationId, 0, 30, user);

        @SuppressWarnings("unchecked")
        List<ChatController.MessageResponseDto> body = (List<ChatController.MessageResponseDto>) response.getBody();
        assertThat(body).singleElement().satisfies(dto -> assertThat(dto.getAttachments()).singleElement().satisfies(attachment -> {
            assertThat(attachment.getFileType()).isEqualTo("IMAGE");
            assertThat(attachment.getFileUrl()).isEqualTo("https://cdn/chat/photo.jpg");
            assertThat(attachment.getFileSize()).isEqualTo(123L);
        }));
    }

    @Test
    void receiptsCoverOnlyMessagesAtOrBeforeRecipientsLastReadMessage() {
        User sender = user("sender");
        User recipient = user("recipient");
        UUID conversationId = UUID.randomUUID();
        Conversation conversation = Conversation.builder().id(conversationId).isGroup(false).createdBy(sender).build();
        Instant base = Instant.parse("2026-01-01T10:00:00Z");
        Message m1 = message(conversation, sender, "m1", base);
        Message m2 = message(conversation, sender, "m2", base.plusSeconds(1));
        Message m3 = message(conversation, sender, "m3", base.plusSeconds(2));
        ConversationParticipant senderPart = ConversationParticipant.builder().conversation(conversation).user(sender).build();
        ConversationParticipant recipientPart = ConversationParticipant.builder().conversation(conversation).user(recipient)
                .lastReadMessageId(m2.getId()).build();
        Profile recipientProfile = new Profile();
        recipientProfile.setReadReceiptsEnabled(true);
        when(participants.findByConversationIdAndUserId(conversationId, sender.getId())).thenReturn(Optional.of(senderPart));
        when(participants.findByConversationId(conversationId)).thenReturn(List.of(senderPart, recipientPart));
        when(messages.findById(m2.getId())).thenReturn(Optional.of(m2));
        when(profiles.findById(recipient.getId())).thenReturn(Optional.of(recipientProfile));
        when(messages.findByConversationIdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(new PageImpl<>(List.of(m3, m2, m1)));
        ChatController controller = new ChatController(conversations, participants, messages, reactions, users, profiles, notifications, chatService, presenceService, messaging, stories);

        @SuppressWarnings("unchecked")
        List<ChatController.MessageResponseDto> body = (List<ChatController.MessageResponseDto>)
                controller.getMessages(conversationId, 0, 30, sender).getBody();

        assertThat(body).extracting(ChatController.MessageResponseDto::getReadByRecipient)
                .containsExactly(true, true, false);
        assertThat(body).extracting(ChatController.MessageResponseDto::getReadReceiptVisible)
                .containsOnly(true);
    }

    @Test
    void disabledReadReceiptsAreNeitherExposedNorBroadcast() {
        User reader = user("reader");
        UUID conversationId = UUID.randomUUID();
        Profile profile = new Profile();
        profile.setReadReceiptsEnabled(false);
        when(chatService.markConversationAsRead(reader, conversationId))
                .thenReturn(new ChatService.ReadResult(conversationId, UUID.randomUUID(), Instant.now()));
        when(profiles.findById(reader.getId())).thenReturn(Optional.of(profile));
        when(conversations.findById(conversationId))
                .thenReturn(Optional.of(Conversation.builder().id(conversationId).isGroup(false).createdBy(reader).build()));
        ChatController controller = new ChatController(conversations, participants, messages, reactions, users, profiles, notifications, chatService, presenceService, messaging, stories);

        ResponseEntity<?> response = controller.markConversationAsRead(conversationId, reader);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(messaging, never()).convertAndSend(any(String.class), any(Object.class));
    }

    private User user(String username) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        return user;
    }

    private Message message(Conversation conversation, User sender, String content, Instant createdAt) {
        return Message.builder().id(UUID.randomUUID()).conversation(conversation).sender(sender)
                .content(content).messageType("TEXT").createdAt(createdAt).build();
    }
}
