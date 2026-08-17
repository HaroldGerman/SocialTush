package com.socialtush.modules.chat.controller;

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

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;

    @GetMapping("/conversations")
    public ResponseEntity<?> getConversations(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        List<Conversation> conversations = conversationRepository.findUserConversations(currentUser);
        List<ConversationDto> dtos = conversations.stream().map(c -> {
            String name = c.getName();
            String avatarUrl = c.getAvatarUrl();

            // For private 1to1 chats, set name/avatar based on the other participant
            if (!c.isGroup()) {
                Optional<ConversationParticipant> otherParticipant = c.getParticipants().stream()
                        .filter(p -> !p.getUser().getId().equals(currentUser.getId()))
                        .findFirst();

                if (otherParticipant.isPresent()) {
                    User otherUser = otherParticipant.get().getUser();
                    Profile otherProfile = profileRepository.findById(otherUser.getId()).orElse(null);
                    name = otherProfile != null ? otherProfile.getDisplayName() : otherUser.getUsername();
                    avatarUrl = otherProfile != null ? otherProfile.getAvatarUrl() : "";
                }
            }

            Optional<Message> latestMessage = messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(c.getId());
            String latestText = latestMessage.map(Message::getContent).orElse("No hay mensajes");
            String latestTime = latestMessage.map(m -> m.getCreatedAt().toString()).orElse(c.getUpdatedAt().toString());

            return ConversationDto.builder()
                    .conversationId(c.getId())
                    .name(name)
                    .avatarUrl(avatarUrl)
                    .isGroup(c.isGroup())
                    .latestMessage(latestText)
                    .updatedAt(latestTime)
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
            Optional<Conversation> existing = conversationRepository.findPrivateConversation(currentUser, recipient);
            if (existing.isPresent()) {
                return ResponseEntity.ok(Map.of(
                        "conversationId", existing.get().getId(),
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

    @Data
    @Builder
    public static class ConversationDto {
        private UUID conversationId;
        private String name;
        private String avatarUrl;
        private boolean isGroup;
        private String latestMessage;
        private String updatedAt;
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
        private String createdAt;
    }
}
