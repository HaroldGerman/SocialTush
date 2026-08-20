package com.socialtush.modules.notifications.service;

import com.socialtush.modules.notifications.entity.WebPushSubscription;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class VapidWebPushSender implements WebPushSender {
    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public VapidWebPushSender(
            @Value("${WEB_PUSH_VAPID_PUBLIC_KEY:}") String publicKey,
            @Value("${WEB_PUSH_VAPID_PRIVATE_KEY:}") String privateKey,
            @Value("${WEB_PUSH_VAPID_SUBJECT:}") String subject) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }

    @Override
    public boolean isConfigured() {
        return !publicKey.isBlank() && !privateKey.isBlank() && !subject.isBlank();
    }

    @Override
    public int send(WebPushSubscription subscription, byte[] payload) throws Exception {
        if (!isConfigured()) throw new IllegalStateException("Web Push VAPID no está configurado");
        PushService pushService = new PushService(publicKey, privateKey, subject);
        Notification notification = new Notification(
                subscription.getEndpoint(),
                subscription.getP256dh(),
                subscription.getAuth(),
                new String(payload, StandardCharsets.UTF_8)
        );
        return pushService.send(notification).getStatusLine().getStatusCode();
    }
}
