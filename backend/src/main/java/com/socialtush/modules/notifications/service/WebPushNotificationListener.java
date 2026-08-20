package com.socialtush.modules.notifications.service;

import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import java.time.Instant;

@Component
@RequiredArgsConstructor
public class WebPushNotificationListener {
    private final UserRepository userRepository;
    private final WebPushService webPushService;
    private final ConversationParticipantRepository participantRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void deliver(NotificationCreatedEvent event) {
        User receiver = userRepository.findById(event.receiverId()).orElse(null);
        if (receiver == null) return;
        if ("MESSAGE".equals(event.type()) && event.targetId() != null && messagePushMuted(receiver, event.targetId())) return;
        webPushService.sendToUser(receiver, payload(event));
    }

    private boolean messagePushMuted(User receiver, java.util.UUID conversationId) {
        ConversationParticipant participant = participantRepository
                .findByConversationIdAndUserId(conversationId, receiver.getId()).orElse(null);
        if (participant == null || !participant.isNotificationsMuted()) return false;
        return participant.getMutedUntil() == null || participant.getMutedUntil().isAfter(Instant.now());
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
            case "STORY_REACTION" -> username + " reaccionó a tu momento";
            default -> "Tienes una nueva señal";
        };
        if ("STORY_REPLY".equals(event.type()) && event.messagePreview() != null) {
            body += ": \"" + event.messagePreview() + "\"";
        }
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
            case "STORY_REACTION" -> "/feed";
            default -> "/feed";
        };
    }
}
