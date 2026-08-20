package com.socialtush.modules.notifications.service;

import lombok.Builder;

import java.util.UUID;

@Builder
public record WebPushPayload(
        String title,
        String body,
        String type,
        UUID notificationId,
        UUID targetId,
        String senderUsername,
        String url
) {}
