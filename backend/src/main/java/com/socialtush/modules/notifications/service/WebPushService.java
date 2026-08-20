package com.socialtush.modules.notifications.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialtush.modules.notifications.entity.WebPushSubscription;
import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {
    private final WebPushSubscriptionRepository repository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;

    @Transactional
    public void sendToUser(User receiver, WebPushPayload payload) {
        if (!sender.isConfigured()) {
            log.debug("Web Push omitido: VAPID no configurado");
            return;
        }
        List<WebPushSubscription> subscriptions = repository.findByUserAndActiveTrue(receiver);
        byte[] body;
        try {
            body = objectMapper.writeValueAsBytes(payload);
        } catch (Exception exception) {
            log.error("No se pudo serializar el payload Web Push", exception);
            return;
        }

        for (WebPushSubscription subscription : subscriptions) {
            try {
                int status = sender.send(subscription, body);
                if (status == 404 || status == 410) {
                    subscription.setActive(false);
                } else if (status >= 200 && status < 300) {
                    subscription.setLastUsedAt(Instant.now());
                } else {
                    log.warn("Proveedor Web Push respondió HTTP {} para subscription {}", status, subscription.getId());
                }
            } catch (Exception exception) {
                // Endpoint URLs and keys are deliberately never logged.
                log.warn("Falló Web Push para subscription {}: {}", subscription.getId(), exception.getMessage());
            }
        }
        repository.saveAll(subscriptions);
    }
}
