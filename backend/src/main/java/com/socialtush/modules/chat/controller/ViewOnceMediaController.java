package com.socialtush.modules.chat.controller;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageAttachment;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageAttachmentRepository;
import com.socialtush.modules.chat.service.ChatService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat/view-once")
@RequiredArgsConstructor
public class ViewOnceMediaController {

    private final ChatService chatService;
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageAttachmentRepository attachmentRepository;
    private final ProfileRepository profileRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping(value = "/conversations/{conversationId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<?> sendToConversation(
            @PathVariable UUID conversationId,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser
    ) {
        requireAuthenticated(currentUser);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada"));
        if (conversation.isGroup()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Las fotos de una sola vista están disponibles por ahora solo en chats privados");
        }
        validateImage(file);

        Message message = chatService.sendMediaMessage(currentUser, conversationId, content, file, null);
        markViewOnce(message);
        ViewOnceMessageDto dto = toDto(message);
        messagingTemplate.convertAndSend("/topic/conversation." + conversationId, dto);
        return ResponseEntity.ok(dto);
    }

    @PostMapping(value = "/direct/{username}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<?> sendDirect(
            @PathVariable String username,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser
    ) {
        requireAuthenticated(currentUser);
        validateImage(file);

        ChatService.SendResult result = chatService.sendDirectMediaMessage(currentUser, username, content, file, null);
        markViewOnce(result.message());
        ViewOnceMessageDto dto = toDto(result.message());
        messagingTemplate.convertAndSend("/topic/conversation." + result.conversation().getId(), dto);
        return ResponseEntity.ok(DirectViewOnceResponse.builder()
                .conversationId(result.conversation().getId())
                .message(dto)
                .build());
    }

    @PostMapping("/attachments/{attachmentId}/open")
    @Transactional
    public ResponseEntity<?> open(
            @PathVariable UUID attachmentId,
            @AuthenticationPrincipal User currentUser
    ) {
        requireAuthenticated(currentUser);
        MessageAttachment attachment = attachmentRepository.findByIdForUpdate(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Foto no encontrada"));
        Message message = attachment.getMessage();
        UUID conversationId = message.getConversation().getId();

        if (!participantRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No perteneces a esta conversación");
        }
        if (!attachment.isViewOnce() || !"IMAGE".equalsIgnoreCase(attachment.getStoredFileType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este archivo no es de una sola vista");
        }
        if (message.getSender().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El remitente no puede consumir su propia foto");
        }
        if (attachment.getViewedAt() != null) {
            throw new ResponseStatusException(HttpStatus.GONE, "Esta foto ya fue vista");
        }

        String fileUrl = attachment.getStoredFileUrl();
        attachment.setViewedAt(Instant.now());
        attachmentRepository.save(attachment);

        messagingTemplate.convertAndSend("/topic/conversation." + conversationId,
                ViewOnceConsumedEvent.builder()
                        .type("VIEW_ONCE_CONSUMED")
                        .messageId(message.getId())
                        .attachmentId(attachment.getId())
                        .viewedAt(attachment.getViewedAt().toString())
                        .build());

        return ResponseEntity.ok(OpenViewOnceResponse.builder()
                .messageId(message.getId())
                .attachmentId(attachment.getId())
                .fileUrl(fileUrl)
                .build());
    }

    private void markViewOnce(Message message) {
        if (message.getConversation().isGroup()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Las fotos de una sola vista están disponibles por ahora solo en chats privados");
        }
        MessageAttachment attachment = message.getAttachments().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "No se pudo preparar la foto de una sola vista"));
        if (!"IMAGE".equalsIgnoreCase(attachment.getStoredFileType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo las fotos pueden enviarse para ver una vez");
        }
        attachment.setViewOnce(true);
        attachment.setViewedAt(null);
        attachmentRepository.save(attachment);
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona una foto");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "La opción ver una vez solo admite imágenes JPG, PNG o WebP");
        }
    }

    private void requireAuthenticated(User currentUser) {
        if (currentUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }
    }

    private ViewOnceMessageDto toDto(Message message) {
        Profile profile = profileRepository.findById(message.getSender().getId()).orElse(null);
        MessageAttachment attachment = message.getAttachments().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Adjunto no disponible"));
        return ViewOnceMessageDto.builder()
                .messageId(message.getId())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderDisplayName(profile != null ? profile.getDisplayName() : message.getSender().getUsername())
                .senderAvatarUrl(profile != null && profile.getAvatarUrl() != null ? profile.getAvatarUrl() : "")
                .content(message.getContent())
                .messageType("IMAGE")
                .createdAt((message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now()).toString())
                .attachments(List.of(ViewOnceAttachmentDto.builder()
                        .id(attachment.getId())
                        .fileUrl("")
                        .fileType("VIEW_ONCE_IMAGE")
                        .fileName(attachment.getFileName())
                        .fileSize(attachment.getFileSize())
                        .viewOnce(true)
                        .viewed(false)
                        .build()))
                .build();
    }

    @Data
    @Builder
    public static class ViewOnceMessageDto {
        private UUID messageId;
        private UUID senderId;
        private String senderUsername;
        private String senderDisplayName;
        private String senderAvatarUrl;
        private String content;
        private String messageType;
        private String createdAt;
        private List<ViewOnceAttachmentDto> attachments;
    }

    @Data
    @Builder
    public static class ViewOnceAttachmentDto {
        private UUID id;
        private String fileUrl;
        private String fileType;
        private String fileName;
        private Long fileSize;
        private boolean viewOnce;
        private boolean viewed;
    }

    @Data
    @Builder
    public static class DirectViewOnceResponse {
        private UUID conversationId;
        private ViewOnceMessageDto message;
    }

    @Data
    @Builder
    public static class OpenViewOnceResponse {
        private UUID messageId;
        private UUID attachmentId;
        private String fileUrl;
    }

    @Data
    @Builder
    public static class ViewOnceConsumedEvent {
        private String type;
        private UUID messageId;
        private UUID attachmentId;
        private String viewedAt;
    }
}