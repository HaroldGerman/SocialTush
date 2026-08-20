package com.socialtush.modules.notifications.controller;

import com.socialtush.modules.notifications.entity.WebPushSubscription;
import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.net.URI;

@RestController
@RequestMapping("/api/v1/push/web/subscriptions")
@RequiredArgsConstructor
public class WebPushController {
    private final WebPushSubscriptionRepository repository;

    @PostMapping
    @Transactional
    public ResponseEntity<?> subscribe(@Valid @RequestBody SubscriptionRequest request,
                                       @AuthenticationPrincipal User currentUser,
                                       @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!isSecurePushEndpoint(request.endpoint)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Endpoint Web Push inválido"));
        }

        WebPushSubscription subscription = repository.findByEndpoint(request.endpoint).orElseGet(WebPushSubscription::new);
        subscription.setUser(currentUser);
        subscription.setEndpoint(request.endpoint);
        subscription.setP256dh(request.keys.p256dh);
        subscription.setAuth(request.keys.auth);
        subscription.setUserAgent(limit(userAgent, 1000));
        subscription.setActive(true);
        repository.save(subscription);
        return ResponseEntity.ok(Map.of("subscribed", true));
    }

    @DeleteMapping
    @Transactional
    public ResponseEntity<?> unsubscribe(@Valid @RequestBody UnsubscribeRequest request,
                                         @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        WebPushSubscription subscription = repository.findByUserAndEndpoint(currentUser, request.endpoint).orElse(null);
        if (subscription == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Suscripción no encontrada"));
        }
        repository.delete(subscription);
        return ResponseEntity.noContent().build();
    }

    private static String limit(String value, int max) {
        return value == null ? null : value.substring(0, Math.min(value.length(), max));
    }

    private static boolean isSecurePushEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    @Data
    public static class SubscriptionRequest {
        @NotBlank @Size(max = 2000) private String endpoint;
        @Valid @NotNull private Keys keys;
    }

    @Data
    public static class Keys {
        @NotBlank @Size(max = 1024) private String p256dh;
        @NotBlank @Size(max = 512) private String auth;
    }

    @Data
    public static class UnsubscribeRequest {
        @NotBlank @Size(max = 2000) private String endpoint;
    }
}
