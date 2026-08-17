package com.socialtush.modules.chat.controller;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
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
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(ChatMessagePayload payload) {
        Conversation conversation = conversationRepository.findById(UUID.fromString(payload.getConversationId())).orElse(null);
        User sender = userRepository.findByUsername(payload.getSenderUsername()).orElse(null);

        if (conversation == null || sender == null) return;

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
                .createdAt(message.getCreatedAt().toString())
                .build();

        // 4. Broadcast message to all subscribers of this conversation topic
        messagingTemplate.convertAndSend("/topic/conversation." + payload.getConversationId(), dto);
    }

    @MessageMapping("/chat.typing")
    public void sendTyping(ChatTypingPayload payload) {
        // Propagate typing state dynamically to the room
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
    public static class ChatTypingPayload {
        private String conversationId;
        private String username;
        private boolean isTyping;
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
