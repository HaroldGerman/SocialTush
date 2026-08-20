package com.socialtush.modules.notifications.service;

import com.socialtush.modules.notifications.entity.WebPushSubscription;

public interface WebPushSender {
    int send(WebPushSubscription subscription, byte[] payload) throws Exception;
    boolean isConfigured();
}
