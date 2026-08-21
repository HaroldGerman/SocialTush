package com.socialtush.modules.notifications.service;

import com.socialtush.modules.notifications.entity.Notification;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final ProfileRepository profileRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ApplicationEventPublisher eventPublisher;

    public Notification createNotification(User receiver, User sender, String type, UUID targetId) {
        return createNotification(receiver, sender, type, targetId, null);
    }

    public Notification createNotification(User receiver, User sender, String type, UUID targetId, String messagePreview) {
        if (receiver.getId().equals(sender.getId())) return null;

        Notification notification = Notification.builder()
                .receiver(receiver)
                .sender(sender)
                .notificationType(type)
                .targetId(targetId)
                .messagePreview(limitPreview(messagePreview))
                .isRead(false)
                .build();
        notification = notificationRepository.save(notification);

        Profile senderProfile = profileRepository.findById(sender.getId()).orElse(null);
        NotificationDto dto = NotificationDto.builder()
                .notificationId(notification.getId())
                .senderUsername(sender.getUsername())
                .senderDisplayName(senderProfile != null ? senderProfile.getDisplayName() : sender.getUsername())
                .senderAvatarUrl(senderProfile != null ? senderProfile.getAvatarUrl() : "")
                .notificationType(notification.getNotificationType())
                .targetId(notification.getTargetId())
                .messagePreview(notification.getMessagePreview())
                .isRead(false)
                .createdAt(notification.getCreatedAt() != null ? notification.getCreatedAt().toString() : java.time.Instant.now().toString())
                .build();

        messagingTemplate.convertAndSend("/topic/user." + receiver.getUsername() + ".notifications", dto);

        try {
            eventPublisher.publishEvent(new NotificationCreatedEvent(
                    receiver.getId(), notification.getId(), notification.getNotificationType(),
                    notification.getTargetId(), sender.getUsername(), notification.getMessagePreview()));
        } catch (RuntimeException exception) {
            log.warn("No se pudo programar Web Push para notification {}", notification.getId(), exception);
        }
        return notification;
    }

    private static String limitPreview(String preview) {
        if (preview == null) return null;
        String normalized = preview.trim();
        return normalized.isEmpty() ? null : normalized.substring(0, Math.min(normalized.length(), 500));
    }

    @Data
    @Builder
    public static class NotificationDto {
        private UUID notificationId;
        private String senderUsername;
        private String senderDisplayName;
        private String senderAvatarUrl;
        private String notificationType;
        private UUID targetId;
        private String messagePreview;
        private boolean isRead;
        private String createdAt;
    }
}
