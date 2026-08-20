package com.socialtush.modules.chat.service;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageAttachment;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.chat.repository.ConversationRepository;
import com.socialtush.modules.chat.repository.MessageRepository;
import com.socialtush.modules.chat.repository.MessageAttachmentRepository;
import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
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
    private final MessageAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final StorageService storageService;

    private static final long IMAGE_MAX_BYTES = 10L * 1024 * 1024;
    private static final long VIDEO_MAX_BYTES = 50L * 1024 * 1024;
    private static final long AUDIO_MAX_BYTES = 15L * 1024 * 1024;

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
    public SendResult sendDirectMediaMessage(User sender, String username, String content,
                                              MultipartFile file, Integer durationSeconds) {
        requireAuthenticated(sender);
        User recipient = resolveRecipient(sender, username);
        MediaSpec media = validateMedia(file);
        Conversation conversation = findOrCreateDirectConversation(sender, recipient);
        Message message = persistMediaMessage(conversation, sender, content, file, media, durationSeconds);
        return new SendResult(conversation, message);
    }

    @Transactional(rollbackFor = Exception.class)
    public Message sendMediaMessage(User sender, UUID conversationId, String content,
                                    MultipartFile file, Integer durationSeconds) {
        requireAuthenticated(sender);
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada"));
        if (!participantRepository.existsByConversationIdAndUserId(conversationId, sender.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No eres miembro de esta conversación");
        }
        MediaSpec media = validateMedia(file);
        return persistMediaMessage(conversation, sender, content, file, media, durationSeconds);
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

    private Message persistMediaMessage(Conversation conversation, User sender, String content, MultipartFile file,
                                        MediaSpec media, Integer durationSeconds) {
        String key = "chat/" + conversation.getId() + "/" + UUID.randomUUID() + "." + media.extension();
        String fileUrl = null;
        try {
            fileUrl = storageService.uploadFile(key, file.getBytes(), media.mimeType());
            Message message = persistMessage(conversation, sender, content == null ? "" : content,
                    media.fileType(), null);
            MessageAttachment attachment = attachmentRepository.save(MessageAttachment.builder()
                    .message(message)
                    .fileUrl(fileUrl)
                    .fileType(media.fileType())
                    .fileName(safeOriginalName(file.getOriginalFilename()))
                    .fileSize(file.getSize())
                    .durationSeconds(durationSeconds != null && durationSeconds >= 0 ? durationSeconds : null)
                    .build());
            message.getAttachments().add(attachment);
            return message;
        } catch (ResponseStatusException ex) {
            compensateUpload(key, fileUrl);
            throw ex;
        } catch (Exception ex) {
            compensateUpload(key, fileUrl);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar el archivo del mensaje", ex);
        }
    }

    private User resolveRecipient(User sender, String username) {
        String normalized = username == null ? "" : username.trim();
        User recipient = userRepository.findByUsernameIgnoreCase(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destinatario no encontrado"));
        if (sender.getId().equals(recipient.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes chatear contigo mismo");
        }
        return recipient;
    }

    private Conversation findOrCreateDirectConversation(User sender, User recipient) {
        List<Conversation> existing = conversationRepository.findPrivateConversations(sender, recipient);
        if (!existing.isEmpty()) return existing.get(0);
        Conversation conversation = conversationRepository.save(Conversation.builder().isGroup(false).createdBy(sender).build());
        participantRepository.save(ConversationParticipant.builder().conversation(conversation).user(sender).role("MEMBER").build());
        participantRepository.save(ConversationParticipant.builder().conversation(conversation).user(recipient).role("MEMBER").build());
        return conversation;
    }

    private MediaSpec validateMedia(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona un archivo");
        }
        String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        MediaSpec spec = switch (mime) {
            case "image/jpeg" -> new MediaSpec("IMAGE", "jpg", mime, IMAGE_MAX_BYTES);
            case "image/png" -> new MediaSpec("IMAGE", "png", mime, IMAGE_MAX_BYTES);
            case "image/webp" -> new MediaSpec("IMAGE", "webp", mime, IMAGE_MAX_BYTES);
            case "video/mp4" -> new MediaSpec("VIDEO", "mp4", mime, VIDEO_MAX_BYTES);
            case "video/webm" -> new MediaSpec("VIDEO", "webm", mime, VIDEO_MAX_BYTES);
            case "video/quicktime" -> new MediaSpec("VIDEO", "mov", mime, VIDEO_MAX_BYTES);
            case "audio/webm" -> new MediaSpec("AUDIO", "webm", mime, AUDIO_MAX_BYTES);
            case "audio/ogg" -> new MediaSpec("AUDIO", "ogg", mime, AUDIO_MAX_BYTES);
            case "audio/mp4", "audio/x-m4a", "audio/m4a" -> new MediaSpec("AUDIO", "m4a", mime, AUDIO_MAX_BYTES);
            default -> throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Formato de archivo no permitido");
        };
        if (file.getSize() > spec.maxBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "El archivo supera el límite de " + (spec.maxBytes() / 1024 / 1024) + " MB");
        }
        return spec;
    }

    private String safeOriginalName(String original) {
        if (original == null || original.isBlank()) return "archivo";
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    private void compensateUpload(String key, String fileUrl) {
        if (fileUrl == null) return;
        try {
            storageService.deleteFile(key);
        } catch (Exception cleanupError) {
            // Preserve the original failure; storage already logs deletion failures.
        }
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
    private record MediaSpec(String fileType, String extension, String mimeType, long maxBytes) {}
}
