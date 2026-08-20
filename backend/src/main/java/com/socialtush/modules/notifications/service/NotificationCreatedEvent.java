package com.socialtush.modules.notifications.service;

import java.util.UUID;

public record NotificationCreatedEvent(
        UUID receiverId,
        UUID notificationId,
        String type,
        UUID targetId,
        String senderUsername,
        String messagePreview
) {}
