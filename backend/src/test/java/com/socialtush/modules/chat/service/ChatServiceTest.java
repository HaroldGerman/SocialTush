package com.socialtush.modules.chat.service;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageReaction;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.chat.repository.MessageAttachmentRepository;
import com.socialtush.modules.chat.repository.MessageReactionRepository;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {
    @Mock ConversationRepository conversations;
    @Mock ConversationParticipantRepository participants;
    @Mock MessageRepository messages;
    @Mock MessageAttachmentRepository attachments;
    @Mock MessageReactionRepository reactions;
    @Mock UserRepository users;
    @Mock NotificationService notifications;
    @Mock NotificationRepository notificationRepository;
    @Mock StorageService storage;

    private ChatService service;
    private User sender;
    private User recipient;

    @BeforeEach
    void setUp() {
        service = new ChatService(conversations, participants, messages, attachments, reactions, users, notifications, notificationRepository, storage);
        sender = user("sender");
        recipient = user("recipient");
    }

    @Test
    void firstMessageCreatesConversationParticipantsAndMessageAtomically() {
        when(users.findByUsernameIgnoreCase("recipient")).thenReturn(Optional.of(recipient));
        when(conversations.findPrivateConversations(sender, recipient)).thenReturn(List.of());
        mockPersistence();

        ChatService.SendResult result = service.sendDirectMessage(sender, "recipient", "Hola", "TEXT", null);

        assertThat(result.message().getContent()).isEqualTo("Hola");
        verify(conversations, atLeast(1)).save(any(Conversation.class));
        verify(participants, times(2)).save(any(ConversationParticipant.class));
        verify(messages).save(any(Message.class));
    }

    @Test
    void storyReplyCreatesConversationAndPreservesStoryReference() {
        UUID storyId = UUID.randomUUID();
        when(users.findByUsernameIgnoreCase("recipient")).thenReturn(Optional.of(recipient));
        when(conversations.findPrivateConversations(sender, recipient)).thenReturn(List.of());
        mockPersistence();

        ChatService.SendResult result = service.sendDirectMessage(
                sender, "recipient", "Qué buena historia", "STORY_REPLY", storyId);

        assertThat(result.message().getMessageType()).isEqualTo("STORY_REPLY");
        assertThat(result.message().getStoryPreviewId()).isEqualTo(storyId);
        assertThat(result.conversation().isGroup()).isFalse();
        verify(participants, times(2)).save(any(ConversationParticipant.class));
        verify(messages).save(any(Message.class));
    }

    @Test
    void imageMessageStoresAttachmentMetadata() {
        Conversation existing = conversation();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.existsByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(true);
        when(participants.findByConversationId(existing.getId())).thenReturn(List.of());
        when(storage.uploadFile(anyString(), any(byte[].class), eq("image/jpeg"))).thenReturn("https://cdn/chat/image.jpg");
        mockMessageSave();
        when(attachments.save(any())).thenAnswer(inv -> {
            var attachment = inv.<com.socialtush.modules.chat.entity.MessageAttachment>getArgument(0);
            attachment.setId(UUID.randomUUID());
            return attachment;
        });
        var file = new MockMultipartFile("file", "foto.jpg", "image/jpeg", new byte[]{1, 2, 3});

        Message result = service.sendMediaMessage(sender, existing.getId(), "Mira", file, null);

        assertThat(result.getMessageType()).isEqualTo("IMAGE");
        assertThat(result.getAttachments()).singleElement().satisfies(attachment -> {
            assertThat(attachment.getFileUrl()).isEqualTo("https://cdn/chat/image.jpg");
            assertThat(attachment.getFileName()).isEqualTo("foto.jpg");
            assertThat(attachment.getFileSize()).isEqualTo(3L);
        });
    }

    @Test
    void audioMessageStoresDuration() {
        Conversation existing = conversation();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.existsByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(true);
        when(participants.findByConversationId(existing.getId())).thenReturn(List.of());
        when(storage.uploadFile(anyString(), any(byte[].class), eq("audio/webm"))).thenReturn("https://cdn/chat/audio.webm");
        mockMessageSave();
        when(attachments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Message result = service.sendMediaMessage(sender, existing.getId(), "",
                new MockMultipartFile("file", "voz.webm", "audio/webm", new byte[]{1}), 7);

        assertThat(result.getMessageType()).isEqualTo("AUDIO");
        assertThat(result.getAttachments().get(0).getDurationSeconds()).isEqualTo(7);
    }

    @Test
    void outsiderCannotUploadToConversation() {
        Conversation existing = conversation();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.existsByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(false);

        assertThatThrownBy(() -> service.sendMediaMessage(sender, existing.getId(), "",
                new MockMultipartFile("file", "foto.png", "image/png", new byte[]{1}), null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        verifyNoInteractions(storage, attachments);
    }

    @Test
    void directMediaCreatesConversationOnlyWhenUploadSucceeds() {
        when(users.findByUsernameIgnoreCase("recipient")).thenReturn(Optional.of(recipient));
        when(conversations.findPrivateConversations(sender, recipient)).thenReturn(List.of());
        mockPersistence();
        when(storage.uploadFile(anyString(), any(byte[].class), eq("image/png"))).thenReturn("https://cdn/chat/foto.png");
        when(attachments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ChatService.SendResult result = service.sendDirectMediaMessage(sender, "recipient", "",
                new MockMultipartFile("file", "foto.png", "image/png", new byte[]{1}), null);

        assertThat(result.conversation().getId()).isNotNull();
        assertThat(result.message().getAttachments()).hasSize(1);
        verify(participants, times(2)).save(any(ConversationParticipant.class));
    }

    @Test
    void failedUploadDoesNotPersistMessageOrAttachment() {
        Conversation existing = conversation();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.existsByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(true);
        when(storage.uploadFile(anyString(), any(byte[].class), anyString())).thenThrow(new RuntimeException("R2 down"));

        assertThatThrownBy(() -> service.sendMediaMessage(sender, existing.getId(), "",
                new MockMultipartFile("file", "foto.jpg", "image/jpeg", new byte[]{1}), null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("500");
        verifyNoInteractions(messages, attachments);
    }

    @Test
    void secondMessageReusesExistingConversation() {
        Conversation existing = conversation();
        when(users.findByUsernameIgnoreCase("recipient")).thenReturn(Optional.of(recipient));
        when(conversations.findPrivateConversations(sender, recipient)).thenReturn(List.of(existing));
        mockMessageSave();
        when(participants.findByConversationId(existing.getId())).thenReturn(List.of());

        ChatService.SendResult result = service.sendDirectMessage(sender, "recipient", "Otra vez", "TEXT", null);

        assertThat(result.conversation()).isSameAs(existing);
        verify(participants, never()).save(argThat(p -> p.getConversation() == existing));
        verify(messages).save(any(Message.class));
    }

    @Test
    void pinAndNicknamePersistOnlyOnCurrentParticipant() {
        Conversation conversation = conversation();
        ConversationParticipant own = ConversationParticipant.builder().conversation(conversation).user(sender).build();
        when(participants.findByConversationIdAndUserId(conversation.getId(), sender.getId())).thenReturn(Optional.of(own));
        when(participants.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.setPinned(sender, conversation.getId(), true);
        service.setNickname(sender, conversation.getId(), "Vale");

        assertThat(own.isPinned()).isTrue();
        assertThat(own.getPinnedAt()).isNotNull();
        assertThat(own.getNickname()).isEqualTo("Vale");
    }

    @Test
    void conversationPreferencesValidateThemeAndPersistMute() {
        Conversation conversation = conversation();
        ConversationParticipant own = ConversationParticipant.builder().conversation(conversation).user(sender).build();
        when(participants.findByConversationIdAndUserId(conversation.getId(), sender.getId())).thenReturn(Optional.of(own));
        when(participants.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        Instant until = Instant.now().plusSeconds(3600);

        service.setPreferences(sender, conversation.getId(), true, until, "OCEAN");

        assertThat(own.isNotificationsMuted()).isTrue();
        assertThat(own.getMutedUntil()).isEqualTo(until);
        assertThat(own.getChatTheme()).isEqualTo("OCEAN");
        assertThatThrownBy(() -> service.setPreferences(sender, conversation.getId(), null, null, "FAKE"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
    }

    @Test
    void reactionIsCreatedReplacedAndRemovedForParticipant() {
        Conversation conversation = conversation();
        Message message = Message.builder().id(UUID.randomUUID()).conversation(conversation).sender(recipient).content("Hola").messageType("TEXT").build();
        when(messages.findById(message.getId())).thenReturn(Optional.of(message));
        when(participants.findByConversationIdAndUserId(conversation.getId(), sender.getId()))
                .thenReturn(Optional.of(ConversationParticipant.builder().conversation(conversation).user(sender).build()));
        when(reactions.findByMessageIdAndUserId(message.getId(), sender.getId())).thenReturn(Optional.empty());
        when(reactions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        MessageReaction created = service.setReaction(sender, message.getId(), "❤️");
        assertThat(created.getEmoji()).isEqualTo("❤️");
        assertThatThrownBy(() -> service.setReaction(sender, message.getId(), "random"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        service.removeReaction(sender, message.getId());
    }

    @Test
    void outsiderCannotReactOrChangeConversationPreferences() {
        Conversation conversation = conversation();
        Message message = Message.builder().id(UUID.randomUUID()).conversation(conversation).sender(recipient).content("Hola").messageType("TEXT").build();
        when(messages.findById(message.getId())).thenReturn(Optional.of(message));
        when(participants.findByConversationIdAndUserId(conversation.getId(), sender.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setReaction(sender, message.getId(), "👍"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        assertThatThrownBy(() -> service.setPinned(sender, conversation.getId(), true))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
    }

    @Test
    void clearingConversationOnlyHidesItForCurrentParticipant() {
        Conversation existing = conversation();
        ConversationParticipant senderPart = participant(existing, sender);
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.findByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(Optional.of(senderPart));
        when(messages.countByConversationId(existing.getId())).thenReturn(3L);

        service.clearConversation(sender, existing.getId());

        assertThat(senderPart.getClearedAt()).isNotNull();
        assertThat(senderPart.getHiddenAt()).isNotNull();
        verify(conversations, never()).delete(any());
    }

    @Test
    void newMessageReactivatesHiddenParticipantButKeepsHistoryCutoff() {
        Conversation existing = conversation();
        Instant cutoff = Instant.now().minusSeconds(60);
        ConversationParticipant hidden = participant(existing, recipient);
        hidden.setClearedAt(cutoff);
        hidden.setHiddenAt(cutoff);
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.existsByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(true);
        when(participants.findByConversationId(existing.getId())).thenReturn(List.of(participant(existing, sender), hidden));
        mockMessageSave();

        service.sendMessage(sender, existing.getId(), "Nuevo", "TEXT", null);

        assertThat(hidden.getHiddenAt()).isNull();
        assertThat(hidden.getClearedAt()).isEqualTo(cutoff);
        verify(notifications).createNotification(recipient, sender, "MESSAGE", existing.getId());
    }

    @Test
    void outsiderCannotDeleteConversation() {
        Conversation existing = conversation();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.findByConversationIdAndUserId(existing.getId(), sender.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.clearConversation(sender, existing.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
    }

    @Test
    void markingReadPersistsLatestVisibleMessageAndClearsMessageNotifications() {
        Conversation existing = conversation();
        ConversationParticipant recipientPart = participant(existing, recipient);
        Message latest = Message.builder().id(UUID.randomUUID()).conversation(existing).sender(sender)
                .content("m2").createdAt(Instant.now()).build();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.findByConversationIdAndUserId(existing.getId(), recipient.getId()))
                .thenReturn(Optional.of(recipientPart));
        when(messages.findFirstByConversationIdOrderByCreatedAtDesc(existing.getId())).thenReturn(Optional.of(latest));

        ChatService.ReadResult result = service.markConversationAsRead(recipient, existing.getId());

        assertThat(result.lastReadMessageId()).isEqualTo(latest.getId());
        assertThat(recipientPart.getLastReadMessageId()).isEqualTo(latest.getId());
        verify(participants).save(recipientPart);
        verify(notificationRepository).markConversationMessagesAsRead(recipient, existing.getId());
    }

    @Test
    void outsiderCannotMarkConversationRead() {
        Conversation existing = conversation();
        when(conversations.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(participants.findByConversationIdAndUserId(existing.getId(), recipient.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markConversationAsRead(recipient, existing.getId()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        verifyNoInteractions(notificationRepository);
    }

    @Test
    void rejectsSelfChat() {
        when(users.findByUsernameIgnoreCase("sender")).thenReturn(Optional.of(sender));
        assertThatThrownBy(() -> service.sendDirectMessage(sender, "sender", "Hola", "TEXT", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        verifyNoInteractions(messages);
    }

    @Test
    void rejectsMissingRecipient() {
        when(users.findByUsernameIgnoreCase("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.sendDirectMessage(sender, "missing", "Hola", "TEXT", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        verifyNoInteractions(messages);
    }

    @Test
    void rejectsBlankMessageBeforeCreatingConversation() {
        when(users.findByUsernameIgnoreCase("recipient")).thenReturn(Optional.of(recipient));
        assertThatThrownBy(() -> service.sendDirectMessage(sender, "recipient", "  ", "TEXT", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        verify(conversations, never()).save(any());
        verifyNoInteractions(messages);
    }

    private void mockPersistence() {
        when(conversations.save(any())).thenAnswer(inv -> {
            Conversation c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        mockMessageSave();
        when(participants.findByConversationId(any())).thenReturn(List.of());
    }

    private void mockMessageSave() {
        when(messages.save(any())).thenAnswer(inv -> {
            Message m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            m.setCreatedAt(Instant.now());
            return m;
        });
    }

    private Conversation conversation() {
        return Conversation.builder().id(UUID.randomUUID()).isGroup(false).createdBy(sender).updatedAt(Instant.now()).build();
    }

    private ConversationParticipant participant(Conversation c, User user) {
        return ConversationParticipant.builder().conversation(c).user(user).role("MEMBER").build();
    }

    private User user(String username) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        return user;
    }
}
