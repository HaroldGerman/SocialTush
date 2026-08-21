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
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat/conversations/{conversationId}")
@RequiredArgsConstructor
public class ChatReplyController {
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final ProfileRepository profileRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/replies")
    @Transactional
    public ResponseEntity<?> reply(@PathVariable UUID conversationId,
                                   @RequestBody ReplyRequest request,
                                   @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        if (request == null || request.parentMessageId == null) return ResponseEntity.badRequest().body(Map.of("message", "Selecciona el mensaje al que quieres responder"));
        String content = request.content == null ? "" : request.content.trim();
        if (content.isBlank()) return ResponseEntity.badRequest().body(Map.of("message", "Escribe una respuesta"));
        if (content.length() > 10000) return ResponseEntity.badRequest().body(Map.of("message", "El mensaje es demasiado largo"));

        Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Conversación no encontrada"));
        if (!participantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No participas en esta conversación"));
        }
        Message parent = messageRepository.findById(request.parentMessageId).orElse(null);
        if (parent == null || parent.getConversation() == null || !conversationId.equals(parent.getConversation().getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "El mensaje original ya no está disponible"));
        }

        Message message = messageRepository.saveAndFlush(Message.builder()
                .conversation(conversation)
                .sender(currentUser)
                .parent(parent)
                .content(content)
                .messageType("TEXT")
                .build());
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        for (ConversationParticipant participant : participantRepository.findByConversationId(conversationId)) {
            if (participant.getHiddenAt() != null) {
                participant.setHiddenAt(null);
                participantRepository.save(participant);
            }
            if (!participant.getUser().getId().equals(currentUser.getId())) {
                notificationService.createNotification(participant.getUser(), currentUser, "MESSAGE", conversationId, content);
            }
        }

        Map<String, Object> payload = messagePayload(message, parent);
        messagingTemplate.convertAndSend("/topic/conversation." + conversationId, payload);
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/reply-context")
    @Transactional(readOnly = true)
    public ResponseEntity<?> context(@PathVariable UUID conversationId, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        if (!participantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No participas en esta conversación"));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Message message : messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)) {
            if (message.getParent() == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("messageId", message.getId());
            item.put("replyTo", parentPreview(message.getParent()));
            result.add(item);
        }
        int from = Math.max(0, result.size() - 200);
        return ResponseEntity.ok(result.subList(from, result.size()));
    }

    private Map<String, Object> messagePayload(Message message, Message parent) {
        Profile profile = profileRepository.findById(message.getSender().getId()).orElse(null);
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("messageId", message.getId());
        dto.put("senderId", message.getSender().getId());
        dto.put("senderUsername", message.getSender().getUsername());
        dto.put("senderDisplayName", profile != null ? profile.getDisplayName() : message.getSender().getUsername());
        dto.put("senderAvatarUrl", profile != null && profile.getAvatarUrl() != null ? profile.getAvatarUrl() : "");
        dto.put("content", message.getContent());
        dto.put("messageType", message.getMessageType());
        dto.put("createdAt", message.getCreatedAt() != null ? message.getCreatedAt().toString() : Instant.now().toString());
        dto.put("attachments", List.of());
        dto.put("reactions", List.of());
        dto.put("readByRecipient", false);
        dto.put("readReceiptVisible", false);
        dto.put("replyTo", parentPreview(parent));
        return dto;
    }

    private Map<String, Object> parentPreview(Message parent) {
        Profile profile = parent.getSender() == null ? null : profileRepository.findById(parent.getSender().getId()).orElse(null);
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("messageId", parent.getId());
        preview.put("senderUsername", parent.getSender() != null ? parent.getSender().getUsername() : "");
        preview.put("senderDisplayName", parent.getSender() == null ? "Mensaje" : profile != null ? profile.getDisplayName() : parent.getSender().getUsername());
        String text = parent.getContent() == null ? "" : parent.getContent().trim();
        if (text.isBlank()) text = switch (parent.getMessageType() == null ? "" : parent.getMessageType().toUpperCase()) {
            case "IMAGE" -> "📷 Foto";
            case "VIDEO" -> "🎬 Video";
            case "AUDIO" -> "🎤 Nota de voz";
            case "STORY_REPLY", "STORY_REACTION" -> "Momento";
            default -> "Mensaje";
        };
        preview.put("content", text.substring(0, Math.min(text.length(), 220)));
        preview.put("messageType", parent.getMessageType() == null ? "TEXT" : parent.getMessageType());
        return preview;
    }

    @Data
    public static class ReplyRequest {
        private UUID parentMessageId;
        private String content;
    }
}
