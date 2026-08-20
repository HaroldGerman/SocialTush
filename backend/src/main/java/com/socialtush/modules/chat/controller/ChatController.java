package com.socialtush.modules.chat.controller;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.notifications.service.NotificationService;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

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
            String latestText = latestMessage.map(Message::getContent).orElse("No hay mensajes");
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

            // Create New Private Chat
            Conversation unsavedPrivate = Conversation.builder()
                    .isGroup(false)
                    .createdBy(currentUser)
                    .build();
            final Conversation conversation = conversationRepository.save(unsavedPrivate);

            ConversationParticipant part1 = ConversationParticipant.builder()
                    .conversation(conversation)
                    .user(currentUser)
                    .role("MEMBER")
                    .build();
            ConversationParticipant part2 = ConversationParticipant.builder()
                    .conversation(conversation)
                    .user(recipient)
                    .role("MEMBER")
                    .build();
            
            participantRepository.save(part1);
            participantRepository.save(part2);

            return ResponseEntity.ok(Map.of(
                    "conversationId", conversation.getId(),
                    "isGroup", false,
                    "message", "Chat iniciado con éxito"
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

        // Verify participant boundary
        if (!participantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No eres miembro de esta conversación"));
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Message> messagePage = messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable);

        List<MessageResponseDto> dtos = messagePage.getContent().stream().map(m -> {
            Profile profile = profileRepository.findById(m.getSender().getId()).orElse(null);
            return MessageResponseDto.builder()
                    .messageId(m.getId())
                    .senderId(m.getSender().getId())
                    .senderUsername(m.getSender().getUsername())
                    .senderDisplayName(profile != null ? profile.getDisplayName() : m.getSender().getUsername())
                    .senderAvatarUrl(profile != null ? profile.getAvatarUrl() : "")
                    .content(m.getContent())
                    .messageType(m.getMessageType())
                    .createdAt(m.getCreatedAt().toString())
                    .build();
        }).collect(Collectors.toList());

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

        Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Conversación no encontrada"));
        }

        if (!participantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "No eres miembro de esta conversación"));
        }

        if (request == null || request.getContent() == null || request.getContent().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "El mensaje no puede estar vacío"));
        }

        Message message = Message.builder()
                .conversation(conversation)
                .sender(currentUser)
                .content(request.getContent().trim())
                .messageType(request.getMessageType() != null ? request.getMessageType() : "TEXT")
                .storyPreviewId(request.getStoryPreviewId())
                .build();

        message = messageRepository.save(message);

        // Notify other participants
        List<ConversationParticipant> participants = participantRepository.findByConversationId(conversationId);
        for (ConversationParticipant part : participants) {
            if (!part.getUser().getId().equals(currentUser.getId())) {
                notificationService.createNotification(
                        part.getUser(),
                        currentUser,
                        "MESSAGE",
                        conversation.getId()
                );
            }
        }

        Profile senderProfile = profileRepository.findById(currentUser.getId()).orElse(null);
        MessageResponseDto dto = MessageResponseDto.builder()
                .messageId(message.getId())
                .senderId(currentUser.getId())
                .senderUsername(currentUser.getUsername())
                .senderDisplayName(senderProfile != null ? senderProfile.getDisplayName() : currentUser.getUsername())
                .senderAvatarUrl(senderProfile != null ? senderProfile.getAvatarUrl() : "")
                .content(message.getContent())
                .messageType(message.getMessageType())
                .storyPreviewId(message.getStoryPreviewId())
                .createdAt(message.getCreatedAt().toString())
                .build();

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

        notificationRepository.markConversationMessagesAsRead(currentUser, conversationId);
        return ResponseEntity.ok(Map.of("message", "Conversación marcada como leída"));
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
        private String createdAt;
    }
}
