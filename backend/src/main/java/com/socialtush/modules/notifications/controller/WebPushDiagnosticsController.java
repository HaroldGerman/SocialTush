package com.socialtush.modules.notifications.controller;

import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.notifications.service.WebPushDeliverySummary;
import com.socialtush.modules.notifications.service.WebPushPayload;
import com.socialtush.modules.notifications.service.WebPushService;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/push/web")
@RequiredArgsConstructor
public class WebPushDiagnosticsController {
    private final WebPushSubscriptionRepository repository;
    private final WebPushService webPushService;

    @GetMapping("/status")
    public ResponseEntity<?> status(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(Map.of(
                "configured", webPushService.isConfigured(),
                "activeSubscriptions", repository.countByUserAndActiveTrue(currentUser)
        ));
    }

    @PostMapping("/test")
    public ResponseEntity<?> test(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        WebPushDeliverySummary summary = webPushService.sendToUser(currentUser, WebPushPayload.builder()
                .title("Lifonk")
                .body("Prueba de Señales activada correctamente")
                .type("WEB_PUSH_TEST")
                .senderUsername(currentUser.getUsername())
                .url("/feed")
                .build());
        return ResponseEntity.ok(summary);
    }
}
