package com.socialtush.modules.chat.controller;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.time.Instant;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageAttachment;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.chat.service.ChatService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.socialtush.modules.notifications.repository.NotificationRepository;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final NotificationRepository notificationRepository;
    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/conversations")
    public ResponseEntity<?> getConversations(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        List<Conversation> conversations = conversationRepository.findUserConversations(currentUser);
        Map<UUID, Conversation> uniquePrivate = new java.util.LinkedHashMap<>();
        List<Conversation> filteredConversations = new java.util.ArrayList<>();

        for (Conversation c : conversations) {
            if (c.isGroup()) {
                filteredConversations.add(c);
            } else {
                Optional<ConversationParticipant> otherParticipant = c.getParticipants().stream()
                        .filter(p -> !p.getUser().getId().equals(currentUser.getId()))
                        .findFirst();
                if (otherParticipant.isPresent()) {
                    UUID otherUserId = otherParticipant.get().getUser().getId();
                    if (!uniquePrivate.containsKey(otherUserId)) {
                        uniquePrivate.put(otherUserId, c);
                        filteredConversations.add(c);
                    }
                } else {
                    filteredConversations.add(c);
                }
            }
        }

        List<ConversationDto> dtos = filteredConversations.stream().map(c -> {
            String name = c.getName();
            String avatarUrl = c.getAvatarUrl();
            UUID otherUserId = null;
            String otherUsername = null;

            // For private 1to1 chats, set name/avatar based on the other participant
            if (!c.isGroup()) {
                Optional<ConversationParticipant> otherParticipant = c.getParticipants().stream()
                        .filter(p -> !p.getUser().getId().equals(currentUser.getId()))
                        .findFirst();

                if (otherParticipant.isPresent()) {
                    User otherUser = otherParticipant.get().getUser();
                    otherUserId = otherUser.getId();
                    otherUsername = otherUser.getUsername();
                    Profile otherProfile = profileRepository.findById(otherUser.getId()).orElse(null);
                    name = otherProfile != null ? otherProfile.getDisplayName() : otherUser.getUsername();
                    avatarUrl = otherProfile != null ? otherProfile.getAvatarUrl() : "";
                }
            }

            Optional<Message> latestMessage = messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(c.getId());
            String latestText = latestMessage.map(this::messagePreview).orElse("No hay mensajes");
            String latestTime = latestMessage.map(m -> m.getCreatedAt().toString()).orElse(c.getUpdatedAt().toString());
            String latestSender = latestMessage.map(m -> m.getSender() != null ? m.getSender().getUsername() : "").orElse("");
            long unreadCount = notificationRepository.countByReceiverAndNotificationTypeAndTargetIdAndIsReadFalse(currentUser, "MESSAGE", c.getId());

            return ConversationDto.builder()
                    .conversationId(c.getId())
                    .name(name)
                    .avatarUrl(avatarUrl)
                    .isGroup(c.isGroup())
                    .latestMessage(latestText)
                    .latestMessageSenderUsername(latestSender)
                    .unreadCount((int) unreadCount)
                    .updatedAt(latestTime)
                    .otherUserId(otherUserId)
                    .otherUsername(otherUsername)
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/conversations")
    public ResponseEntity<?> createConversation(
            @RequestBody CreateConversationRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        if (request.isGroup()) {
            if (request.getName() == null || request.getName().trim().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "El nombre del grupo es obligatorio"));
            }

            // Create Group Conversation
            Conversation unsavedGroup = Conversation.builder()
                    .name(request.getName().trim())
                    .isGroup(true)
                    .createdBy(currentUser)
                    .build();
            final Conversation conversation = conversationRepository.save(unsavedGroup);

            // Add Creator
            ConversationParticipant creatorPart = ConversationParticipant.builder()
                    .conversation(conversation)
                    .user(currentUser)
                    .role("ADMIN")
                    .build();
            participantRepository.save(creatorPart);

            // Add Participants
            if (request.getParticipantUsernames() != null) {
                for (String username : request.getParticipantUsernames()) {
                    userRepository.findByUsername(username.toLowerCase().trim()).ifPresent(user -> {
                        if (!user.getId().equals(currentUser.getId())) {
                            ConversationParticipant part = ConversationParticipant.builder()
                                    .conversation(conversation)
                                    .user(user)
                                    .role("MEMBER")
                                    .build();
                            participantRepository.save(part);
                        }
                    });
                }
            }

            return ResponseEntity.ok(Map.of(
                    "conversationId", conversation.getId(),
                    "name", conversation.getName(),
                    "isGroup", true,
                    "message", "Grupo creado con éxito"
            ));
        } else {
            // Private 1to1 Conversation
            if (request.getRecipientUsername() == null || request.getRecipientUsername().trim().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "El nombre de usuario destinatario es obligatorio"));
            }

            User recipient = userRepository.findByUsername(request.getRecipientUsername().toLowerCase().trim()).orElse(null);
            if (recipient == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Destinatario no encontrado"));
            }

            if (currentUser.getId().equals(recipient.getId())) {
                return ResponseEntity.badRequest().body(Map.of("message", "No puedes chatear contigo mismo"));
            }

            // Check if 1to1 chat already exists
            List<Conversation> existingList = conversationRepository.findPrivateConversations(currentUser, recipient);
            if (!existingList.isEmpty()) {
                Conversation existing = existingList.get(0);
                return ResponseEntity.ok(Map.of(
                        "conversationId", existing.getId(),
                        "isGroup", false,
                        "message", "Chat ya existente recuperado"
                ));
            }

            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "message", "La conversación se crea al enviar el primer mensaje"
            ));
        }
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<?> getMessages(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Optional<ConversationParticipant> participant = participantRepository.findByConversationIdAndUserId(conversationId, currentUser.getId());
        if (participant.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No eres miembro de esta conversación"));
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Message> messagePage = participant.get().getClearedAt() == null
                ? messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable)
                : messageRepository.findByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(conversationId, participant.get().getClearedAt(), pageable);

        ReceiptContext receiptContext = receiptContext(conversationId, currentUser);
        List<MessageResponseDto> dtos = messagePage.getContent().stream()
                .map(message -> toMessageDto(message, currentUser, receiptContext))
                .collect(Collectors.toList());

        // Reverse to return messages in chronological order
        Collections.reverse(dtos);

        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<?> sendMessage(
            @PathVariable UUID conversationId,
            @RequestBody CreateMessageRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        if (request == null) return ResponseEntity.badRequest().body(Map.of("message", "El mensaje no puede estar vacío"));
        Message message = chatService.sendMessage(currentUser, conversationId,
                request.getContent(), request.getMessageType(), request.getStoryPreviewId());
        MessageResponseDto dto = toMessageDto(message, currentUser);
        broadcastMessage(conversationId, dto);
        return ResponseEntity.ok(dto);
    }

    @RequestMapping(value = "/conversations/{conversationId}/read", method = {RequestMethod.POST, RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<?> markConversationAsRead(
            @PathVariable UUID conversationId,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        ChatService.ReadResult result = chatService.markConversationAsRead(currentUser, conversationId);
        Profile readerProfile = profileRepository.findById(currentUser.getId()).orElse(null);
        ReadReceiptDto receipt = ReadReceiptDto.builder()
                .type("READ_RECEIPT")
                .conversationId(result.conversationId())
                .readerUserId(currentUser.getId())
                .readerUsername(currentUser.getUsername())
                .lastReadMessageId(result.lastReadMessageId())
                .readAt(result.readAt().toString())
                .build();
        boolean directConversation = conversationRepository.findById(conversationId)
                .map(conversation -> !conversation.isGroup()).orElse(false);
        if (directConversation && (readerProfile == null || readerProfile.isReadReceiptsEnabled())) {
            messagingTemplate.convertAndSend("/topic/conversation." + conversationId, receipt);
        }
        return ResponseEntity.ok(receipt);
    }

    @PostMapping("/direct/{username}/messages")
    public ResponseEntity<?> sendDirectMessage(
            @PathVariable String username,
            @RequestBody CreateMessageRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "El mensaje no puede estar vacío"));
        }
        ChatService.SendResult result = chatService.sendDirectMessage(currentUser, username, request.getContent(),
                request.getMessageType(), request.getStoryPreviewId());

        MessageResponseDto dto = toMessageDto(result.message(), currentUser);
        broadcastMessage(result.conversation().getId(), dto);
        return ResponseEntity.ok(Map.of(
            "conversationId", result.conversation().getId(),
            "message", dto
        ));
    }

    @PostMapping(value = "/conversations/{conversationId}/messages/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> sendMediaMessage(
            @PathVariable UUID conversationId,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "durationSeconds", required = false) Integer durationSeconds,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        MessageResponseDto dto = toMessageDto(
                chatService.sendMediaMessage(currentUser, conversationId, content, file, durationSeconds), currentUser);
        broadcastMessage(conversationId, dto);
        return ResponseEntity.ok(dto);
    }

    @PostMapping(value = "/direct/{username}/messages/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> sendDirectMediaMessage(
            @PathVariable String username,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "durationSeconds", required = false) Integer durationSeconds,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        ChatService.SendResult result = chatService.sendDirectMediaMessage(
                currentUser, username, content, file, durationSeconds);
        MessageResponseDto dto = toMessageDto(result.message(), currentUser);
        broadcastMessage(result.conversation().getId(), dto);
        return ResponseEntity.ok(Map.of(
                "conversationId", result.conversation().getId(),
                "message", dto
        ));
    }

    private void broadcastMessage(UUID conversationId, MessageResponseDto dto) {
        messagingTemplate.convertAndSend("/topic/conversation." + conversationId, dto);
    }

    private String messagePreview(Message message) {
        if (message.getContent() != null && !message.getContent().isBlank()) return message.getContent();
        if (message.getAttachments().isEmpty()) return "Mensaje";
        return switch (message.getAttachments().get(0).getFileType()) {
            case "IMAGE" -> "📷 Foto";
            case "VIDEO" -> "🎥 Video";
            case "AUDIO" -> "🎤 Nota de voz";
            default -> "📎 Archivo";
        };
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<?> deleteConversation(
            @PathVariable UUID conversationId,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        chatService.clearConversation(currentUser, conversationId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    private MessageResponseDto toMessageDto(Message message, User viewer) {
        return toMessageDto(message, viewer, receiptContext(message.getConversation().getId(), viewer));
    }

    private MessageResponseDto toMessageDto(Message message, User viewer, ReceiptContext receipt) {
        Profile senderProfile = profileRepository.findById(message.getSender().getId()).orElse(null);
        boolean ownMessage = viewer != null && message.getSender().getId().equals(viewer.getId());
        boolean read = ownMessage && receipt.visible() && receipt.lastReadAt() != null
                && message.getCreatedAt() != null && !message.getCreatedAt().isAfter(receipt.lastReadAt());
        return MessageResponseDto.builder()
                .messageId(message.getId()).senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderDisplayName(senderProfile != null ? senderProfile.getDisplayName() : message.getSender().getUsername())
                .senderAvatarUrl(senderProfile != null && senderProfile.getAvatarUrl() != null ? senderProfile.getAvatarUrl() : "")
                .content(message.getContent()).messageType(message.getMessageType())
                .storyPreviewId(message.getStoryPreviewId())
                .attachments(message.getAttachments().stream().map(this::toAttachmentDto).toList())
                .readReceiptVisible(ownMessage && receipt.visible())
                .readByRecipient(read)
                .createdAt((message.getCreatedAt() != null ? message.getCreatedAt() : java.time.Instant.now()).toString()).build();
    }

    private ReceiptContext receiptContext(UUID conversationId, User viewer) {
        if (viewer == null) return new ReceiptContext(false, null);
        List<ConversationParticipant> participants = participantRepository.findByConversationId(conversationId);
        if (participants.size() != 2) return new ReceiptContext(false, null);
        if (participants.get(0).getConversation().isGroup()) return new ReceiptContext(false, null);
        ConversationParticipant recipient = participants.stream()
                .filter(participant -> !participant.getUser().getId().equals(viewer.getId()))
                .findFirst().orElse(null);
        if (recipient == null) return new ReceiptContext(false, null);
        Profile recipientProfile = profileRepository.findById(recipient.getUser().getId()).orElse(null);
        boolean visible = recipientProfile == null || recipientProfile.isReadReceiptsEnabled();
        Instant lastReadAt = recipient.getLastReadMessageId() == null ? null
                : messageRepository.findById(recipient.getLastReadMessageId())
                    .map(Message::getCreatedAt).orElse(null);
        return new ReceiptContext(visible, lastReadAt);
    }

    private AttachmentDto toAttachmentDto(MessageAttachment attachment) {
        return AttachmentDto.builder()
                .id(attachment.getId())
                .fileUrl(attachment.getFileUrl())
                .fileType(attachment.getFileType())
                .fileName(attachment.getFileName())
                .fileSize(attachment.getFileSize())
                .durationSeconds(attachment.getDurationSeconds())
                .build();
    }

    @Data
    public static class CreateMessageRequest {
        private String content;
        private String messageType;
        private UUID storyPreviewId;
    }

    @Data
    @Builder
    public static class ConversationDto {
        private UUID conversationId;
        private String name;
        private String avatarUrl;
        private boolean isGroup;
        private String latestMessage;
        private String latestMessageSenderUsername;
        private int unreadCount;
        private String updatedAt;
        private UUID otherUserId;
        private String otherUsername;
    }

    @Data
    public static class CreateConversationRequest {
        private String recipientUsername;
        private String name;
        private boolean isGroup;
        private List<String> participantUsernames;
    }

    @Data
    @Builder
    public static class MessageResponseDto {
        private UUID messageId;
        private UUID senderId;
        private String senderUsername;
        private String senderDisplayName;
        private String senderAvatarUrl;
        private String content;
        private String messageType;
        private UUID storyPreviewId;
        private List<AttachmentDto> attachments;
        private String createdAt;
        private Boolean readByRecipient;
        private Boolean readReceiptVisible;
    }

    private record ReceiptContext(boolean visible, Instant lastReadAt) {}

    @Data
    @Builder
    public static class ReadReceiptDto {
        private String type;
        private UUID conversationId;
        private UUID readerUserId;
        private String readerUsername;
        private UUID lastReadMessageId;
        private String readAt;
    }

    @Data
    @Builder
    public static class AttachmentDto {
        private UUID id;
        private String fileUrl;
        private String fileType;
        private String fileName;
        private Long fileSize;
        private Integer durationSeconds;
    }
}
