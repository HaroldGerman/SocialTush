package com.socialtush.modules.chat.service;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

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
    @Mock UserRepository users;
    @Mock NotificationService notifications;

    private ChatService service;
    private User sender;
    private User recipient;

    @BeforeEach
    void setUp() {
        service = new ChatService(conversations, participants, messages, users, notifications);
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
