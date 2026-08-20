package com.socialtush.modules.notifications.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.socialtush.modules.notifications.entity.Device;
import com.socialtush.modules.notifications.entity.Notification;
import com.socialtush.modules.notifications.repository.DeviceRepository;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final DeviceRepository deviceRepository;
    private final ProfileRepository profileRepository;

    @GetMapping
    public ResponseEntity<?> getNotifications(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        List<Notification> list = notificationRepository.findByReceiverOrderByCreatedAtDesc(currentUser);
        List<NotificationResponseDto> dtos = list.stream().map(n -> {
            Profile senderProfile = profileRepository.findById(n.getSender().getId()).orElse(null);
            return NotificationResponseDto.builder()
                    .notificationId(n.getId())
                    .senderUsername(n.getSender().getUsername())
                    .senderDisplayName(senderProfile != null ? senderProfile.getDisplayName() : n.getSender().getUsername())
                    .senderAvatarUrl(senderProfile != null ? senderProfile.getAvatarUrl() : "")
                    .notificationType(n.getNotificationType())
                    .targetId(n.getTargetId())
                    .messagePreview(n.getMessagePreview())
                    .isRead(n.isRead())
                    .createdAt(n.getCreatedAt().toString())
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }
        long count = notificationRepository.countByReceiverAndIsReadFalse(currentUser);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @RequestMapping(value = "/{id}/read", method = {RequestMethod.POST, RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<?> markAsRead(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Notification notification = notificationRepository.findById(id).orElse(null);
        if (notification == null || !notification.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Notificación no encontrada"));
        }

        notification.setRead(true);
        notificationRepository.save(notification);

        return ResponseEntity.ok(Map.of("message", "Notificación marcada como leída"));
    }

    @RequestMapping(value = "/read-all", method = {RequestMethod.POST, RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<?> markAllAsRead(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        notificationRepository.markAllAsReadForReceiver(currentUser);
        return ResponseEntity.ok(Map.of("message", "Todas las notificaciones marcadas como leídas"));
    }

    @GetMapping("/unread-messages-count")
    public ResponseEntity<?> getUnreadMessagesCount(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("count", 0));
        }
        long count = notificationRepository.countByReceiverAndNotificationTypeAndIsReadFalse(currentUser, "MESSAGE");
        return ResponseEntity.ok(Map.of("count", count));
    }

    @RequestMapping(value = "/read-messages", method = {RequestMethod.POST, RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<?> markMessagesAsRead(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        notificationRepository.markAllMessagesAsReadForReceiver(currentUser);
        return ResponseEntity.ok(Map.of("message", "Notificaciones de mensajes marcadas como leídas"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Notification notification = notificationRepository.findById(id).orElse(null);
        if (notification == null || !notification.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Notificación no encontrada"));
        }

        notificationRepository.delete(notification);
        return ResponseEntity.ok(Map.of("message", "Notificación eliminada"));
    }

    @DeleteMapping
    public ResponseEntity<?> clearReadNotifications(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        notificationRepository.deleteReadNotificationsForReceiver(currentUser);
        return ResponseEntity.ok(Map.of("message", "Notificaciones leídas eliminadas"));
    }

    @PostMapping("/devices")
    public ResponseEntity<?> registerDevice(@RequestBody DeviceRegisterRequest request, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        }

        Optional<Device> existing = deviceRepository.findByToken(request.getToken());
        if (existing.isPresent()) {
            Device dev = existing.get();
            dev.setUser(currentUser);
            deviceRepository.save(dev);
            return ResponseEntity.ok(Map.of("message", "Dispositivo actualizado con éxito"));
        }

        Device device = Device.builder()
                .user(currentUser)
                .token(request.getToken())
                .platform(request.getPlatform().toUpperCase().trim())
                .build();
        deviceRepository.save(device);

        return ResponseEntity.ok(Map.of("message", "Dispositivo registrado con éxito"));
    }

    @Data
    @Builder
    public static class NotificationResponseDto {
        private UUID notificationId;
        private String senderUsername;
        private String senderDisplayName;
        private String senderAvatarUrl;
        private String notificationType;
        private UUID targetId;
        private String messagePreview;
        @JsonProperty("isRead")
        private boolean isRead;
        private String createdAt;
    }

    @Data
    public static class DeviceRegisterRequest {
        private String token;
        private String platform; // "ANDROID", "IOS", "WEB"
    }
}
