package com.socialtush.modules.notifications.service;

import com.socialtush.modules.notifications.entity.Notification;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final ProfileRepository profileRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public void createNotification(User receiver, User sender, String type, UUID targetId) {
        if (receiver.getId().equals(sender.getId())) {
            return; // Don't notify users of their own actions
        }

        // 1. Create and Persist
        Notification notification = Notification.builder()
                .receiver(receiver)
                .sender(sender)
                .notificationType(type)
                .targetId(targetId)
                .isRead(false)
                .build();
        notification = notificationRepository.save(notification);

        // 2. Format DTO for WebSocket STOMP
        Profile senderProfile = profileRepository.findById(sender.getId()).orElse(null);
        NotificationDto dto = NotificationDto.builder()
                .notificationId(notification.getId())
                .senderUsername(sender.getUsername())
                .senderDisplayName(senderProfile != null ? senderProfile.getDisplayName() : sender.getUsername())
                .senderAvatarUrl(senderProfile != null ? senderProfile.getAvatarUrl() : "")
                .notificationType(notification.getNotificationType())
                .targetId(notification.getTargetId())
                .isRead(false)
                .createdAt(notification.getCreatedAt().toString())
                .build();

        // 3. Push real-time alert via WebSocket STOMP topic specific to receiver username
        messagingTemplate.convertAndSend("/topic/user." + receiver.getUsername() + ".notifications", dto);
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
        private boolean isRead;
        private String createdAt;
    }
}
