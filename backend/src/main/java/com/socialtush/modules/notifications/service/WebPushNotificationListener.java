package com.socialtush.modules.notifications.service;

import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class WebPushNotificationListener {
    private final UserRepository userRepository;
    private final WebPushService webPushService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void deliver(NotificationCreatedEvent event) {
        User receiver = userRepository.findById(event.receiverId()).orElse(null);
        if (receiver == null) return;
        webPushService.sendToUser(receiver, payload(event));
    }

    private WebPushPayload payload(NotificationCreatedEvent event) {
        String username = "@" + event.senderUsername();
        String body = switch (event.type()) {
            case "MESSAGE" -> username + " te escribió";
            case "LIKE_POST" -> username + " resonó con tu contribución";
            case "LIKE_COMMENT" -> username + " resonó con tu eco";
            case "COMMENT" -> username + " dejó un eco en tu contribución";
            case "COMMENT_REPLY" -> username + " respondió a tu eco";
            case "FOLLOW" -> username + " conectó contigo";
            case "FOLLOW_REQUEST" -> username + " quiere conectar contigo";
            case "STORY_REPLY" -> username + " respondió a tu momento";
            default -> "Tienes una nueva señal";
        };
        return WebPushPayload.builder()
                .title("Lifonk")
                .body(body)
                .type(event.type())
                .notificationId(event.notificationId())
                .targetId(event.targetId())
                .senderUsername(event.senderUsername())
                .url(safeUrl(event))
                .build();
    }

    private String safeUrl(NotificationCreatedEvent event) {
        String id = event.targetId() == null ? "" : event.targetId().toString();
        return switch (event.type()) {
            case "MESSAGE" -> "/chat?username=" + event.senderUsername();
            case "LIKE_POST", "COMMENT" -> "/post/" + id;
            case "FOLLOW", "FOLLOW_REQUEST" -> "/profile/" + event.senderUsername();
            case "LIKE_COMMENT", "COMMENT_REPLY" -> "/feed";
            case "STORY_REPLY" -> "/feed";
            default -> "/feed";
        };
    }
}
