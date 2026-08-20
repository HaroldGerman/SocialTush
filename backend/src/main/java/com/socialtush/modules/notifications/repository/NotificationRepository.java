package com.socialtush.modules.notifications.repository;

import com.socialtush.modules.notifications.entity.Notification;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByReceiverOrderByCreatedAtDesc(User receiver);
    long countByReceiverAndIsReadFalse(User receiver);
    long countByReceiverAndNotificationTypeAndIsReadFalse(User receiver, String notificationType);

    long countByReceiverAndNotificationTypeAndTargetIdAndIsReadFalse(User receiver, String notificationType, UUID targetId);

    @Transactional
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.receiver = :receiver AND n.isRead = false")
    void markAllAsReadForReceiver(@Param("receiver") User receiver);

    @Transactional
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.receiver = :receiver AND n.notificationType = 'MESSAGE' AND n.isRead = false")
    void markAllMessagesAsReadForReceiver(@Param("receiver") User receiver);

    @Transactional
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.receiver = :receiver AND n.notificationType = 'MESSAGE' AND n.targetId = :targetId AND n.isRead = false")
    void markConversationMessagesAsRead(@Param("receiver") User receiver, @Param("targetId") UUID targetId);

    @Transactional
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.receiver = :receiver AND n.isRead = true")
    void deleteReadNotificationsForReceiver(@Param("receiver") User receiver);

    void deleteByReceiverAndNotificationTypeAndTargetId(User receiver, String notificationType, UUID targetId);
}
