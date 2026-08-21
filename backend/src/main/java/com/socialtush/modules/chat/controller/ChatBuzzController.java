package com.socialtush.modules.chat.controller;

import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/chat/buzz")
@RequiredArgsConstructor
public class ChatBuzzController {
    private static final long COOLDOWN_MS = 15000L;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Map<String, Long> lastBuzzAt = new ConcurrentHashMap<>();

    @PostMapping("/{username}")
    public ResponseEntity<?> buzz(@PathVariable String username, @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        User recipient = userRepository.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (recipient == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Usuario no encontrado"));
        if (recipient.getId().equals(currentUser.getId())) return ResponseEntity.badRequest().body(Map.of("message", "No puedes enviarte un zumbido a ti mismo"));

        String key = currentUser.getId() + ":" + recipient.getId();
        long now = System.currentTimeMillis();
        long previous = lastBuzzAt.getOrDefault(key, 0L);
        if (now - previous < COOLDOWN_MS) {
            long retry = Math.max(1, (COOLDOWN_MS - (now - previous) + 999) / 1000);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("message", "Espera " + retry + " s para enviar otro zumbido", "retryAfterSeconds", retry));
        }
        lastBuzzAt.put(key, now);

        messagingTemplate.convertAndSend("/topic/user." + recipient.getUsername() + ".buzz", Map.of(
                "type", "BUZZ",
                "senderUsername", currentUser.getUsername(),
                "sentAt", Instant.now().toString()
        ));
        return ResponseEntity.ok(Map.of("sent", true));
    }
}
