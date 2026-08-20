package com.socialtush.modules.chat.controller;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.security.Principal;
import java.util.List;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final NotificationService notificationService;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(ChatMessagePayload payload, Principal principal) {
        if (principal == null || payload == null || payload.getConversationId() == null) return;
        Conversation conversation = conversationRepository.findById(UUID.fromString(payload.getConversationId())).orElse(null);
        User sender = userRepository.findByUsernameIgnoreCase(principal.getName()).orElse(null);

        if (conversation == null || sender == null || !participantRepository.existsByConversationIdAndUserId(conversation.getId(), sender.getId())) return;

        // 1. Create and Save Message
        Message message = Message.builder()
                .conversation(conversation)
                .sender(sender)
                .content(payload.getContent())
                .messageType(payload.getMessageType() != null ? payload.getMessageType() : "TEXT")
                .build();
        message = messageRepository.save(message);

        // 2. Update conversation timestamp
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        // 3. Build DTO
        Profile profile = profileRepository.findById(sender.getId()).orElse(null);
        MessageDto dto = MessageDto.builder()
                .messageId(message.getId())
                .conversationId(conversation.getId())
                .senderId(sender.getId())
                .senderUsername(sender.getUsername())
                .senderDisplayName(profile != null ? profile.getDisplayName() : sender.getUsername())
                .senderAvatarUrl(profile != null ? profile.getAvatarUrl() : "")
                .content(message.getContent())
                .messageType(message.getMessageType())
                .createdAt(message.getCreatedAt() != null ? message.getCreatedAt().toString() : Instant.now().toString())
                .build();

        // 4. Broadcast message to all subscribers of this conversation topic
        messagingTemplate.convertAndSend("/topic/conversation." + payload.getConversationId(), dto);

        // 5. Notify each participant (except sender) via real-time notifications
        List<ConversationParticipant> participants = participantRepository.findByConversationId(conversation.getId());
        for (ConversationParticipant part : participants) {
            if (!part.getUser().getId().equals(sender.getId())) {
                notificationService.createNotification(
                        part.getUser(),
                        sender,
                        "MESSAGE",
                        conversation.getId()
                );
            }
        }
    }

    @MessageMapping("/chat.typing")
    public void handleTyping(TypingPayload payload, Principal principal) {
        if (principal == null || payload == null || payload.getConversationId() == null) return;
        User sender = userRepository.findByUsernameIgnoreCase(principal.getName()).orElse(null);
        if (sender == null || !participantRepository.existsByConversationIdAndUserId(UUID.fromString(payload.getConversationId()), sender.getId())) return;
        payload.setSenderUsername(sender.getUsername());
        messagingTemplate.convertAndSend("/topic/conversation." + payload.getConversationId() + ".typing", payload);
    }

    @Data
    public static class ChatMessagePayload {
        private String conversationId;
        private String senderUsername;
        private String content;
        private String messageType;
    }

    @Data
    public static class TypingPayload {
        private String conversationId;
        private String senderUsername;
        private String content;
    }

    @Data
    @Builder
    public static class MessageDto {
        private UUID messageId;
        private UUID conversationId;
        private UUID senderId;
        private String senderUsername;
        private String senderDisplayName;
        private String senderAvatarUrl;
        private String content;
        private String messageType;
        private String createdAt;
    }
}
