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
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional(rollbackFor = Exception.class)
    public SendResult sendDirectMessage(User sender, String username, String content, String messageType, UUID storyPreviewId) {
        requireAuthenticated(sender);
        String normalized = username == null ? "" : username.trim();
        User recipient = userRepository.findByUsernameIgnoreCase(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destinatario no encontrado"));
        if (sender.getId().equals(recipient.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes chatear contigo mismo");
        }
        validateContent(content);

        List<Conversation> existing = conversationRepository.findPrivateConversations(sender, recipient);
        Conversation conversation;
        if (existing.isEmpty()) {
            conversation = conversationRepository.save(Conversation.builder().isGroup(false).createdBy(sender).build());
            participantRepository.save(ConversationParticipant.builder().conversation(conversation).user(sender).role("MEMBER").build());
            participantRepository.save(ConversationParticipant.builder().conversation(conversation).user(recipient).role("MEMBER").build());
        } else {
            conversation = existing.get(0);
        }
        Message message = persistMessage(conversation, sender, content, messageType, storyPreviewId);
        return new SendResult(conversation, message);
    }

    @Transactional(rollbackFor = Exception.class)
    public Message sendMessage(User sender, UUID conversationId, String content, String messageType, UUID storyPreviewId) {
        requireAuthenticated(sender);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada"));
        if (!participantRepository.existsByConversationIdAndUserId(conversationId, sender.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No eres miembro de esta conversación");
        }
        validateContent(content);
        return persistMessage(conversation, sender, content, messageType, storyPreviewId);
    }

    private Message persistMessage(Conversation conversation, User sender, String content, String messageType, UUID storyPreviewId) {
        Message message = messageRepository.save(Message.builder()
                .conversation(conversation).sender(sender).content(content.trim())
                .messageType(messageType == null || messageType.isBlank() ? "TEXT" : messageType)
                .storyPreviewId(storyPreviewId).build());
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        for (ConversationParticipant participant : participantRepository.findByConversationId(conversation.getId())) {
            if (participant.getHiddenAt() != null) {
                participant.setHiddenAt(null);
                participantRepository.save(participant);
            }
            if (!participant.getUser().getId().equals(sender.getId())) {
                notificationService.createNotification(participant.getUser(), sender, "MESSAGE", conversation.getId());
            }
        }
        return message;
    }

    @Transactional
    public void clearConversation(User currentUser, UUID conversationId) {
        requireAuthenticated(currentUser);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada"));
        ConversationParticipant participant = participantRepository.findByConversationIdAndUserId(conversationId, currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "No eres miembro de esta conversación"));
        if (!conversation.isGroup() && messageRepository.countByConversationId(conversationId) == 0) {
            conversationRepository.delete(conversation);
            return;
        }
        Instant now = Instant.now();
        participant.setClearedAt(now);
        participant.setHiddenAt(now);
        participantRepository.save(participant);
    }

    private void requireAuthenticated(User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
    }

    private void validateContent(String content) {
        if (content == null || content.trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El mensaje no puede estar vacío");
        }
    }

    public record SendResult(Conversation conversation, Message message) {}
}
