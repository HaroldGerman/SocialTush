package com.socialtush.modules.chat.controller;

import com.socialtush.modules.notifications.service.WebPushPayload;
import com.socialtush.modules.notifications.service.WebPushService;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
public class WebSocketCallController {

    private static final long PENDING_CALL_TTL_MILLIS = 90_000L;

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final WebPushService webPushService;
    private final ConcurrentHashMap<String, PendingCall> pendingCalls = new ConcurrentHashMap<>();

    @MessageMapping("/call.signal")
    public void handleCallSignal(CallSignalPayload payload, Principal principal) {
        if (principal == null || payload == null || payload.getRecipientUsername() == null || payload.getRecipientUsername().isBlank()) return;
        payload.setSenderUsername(principal.getName());
        String type = payload.getType() == null ? "" : payload.getType().toUpperCase(Locale.ROOT);
        String recipientKey = key(payload.getRecipientUsername());
        String senderKey = key(principal.getName());

        if ("OFFER".equals(type) && payload.getSdp() != null && !payload.getSdp().isBlank()) {
            pendingCalls.put(recipientKey, new PendingCall(copy(payload), System.currentTimeMillis()));
            userRepository.findByUsernameIgnoreCase(payload.getRecipientUsername()).ifPresent(receiver -> {
                String mode = "VIDEO".equalsIgnoreCase(payload.getCallMode()) ? "Videollamada" : "Llamada";
                String caller = principal.getName();
                String url = "/chat?username=" + URLEncoder.encode(caller, StandardCharsets.UTF_8) + "&incomingCall=1";
                webPushService.sendToUser(receiver, WebPushPayload.builder()
                        .title(mode + " entrante")
                        .body("@" + caller + " te está llamando")
                        .type("INCOMING_CALL")
                        .notificationId(UUID.randomUUID())
                        .senderUsername(caller)
                        .url(url)
                        .build());
            });
        } else if ("ANSWER".equals(type) || "REJECT".equals(type) || "BUSY".equals(type)) {
            pendingCalls.remove(senderKey);
        } else if ("HANGUP".equals(type)) {
            pendingCalls.remove(senderKey);
            pendingCalls.remove(recipientKey);
        }

        messagingTemplate.convertAndSend("/topic/user." + payload.getRecipientUsername() + ".call", payload);
    }

    @GetMapping("/api/v1/chat/calls/pending")
    @ResponseBody
    public ResponseEntity<CallSignalPayload> pendingCall(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String key = key(principal.getName());
        PendingCall pending = pendingCalls.get(key);
        if (pending == null) return ResponseEntity.noContent().build();
        if (System.currentTimeMillis() - pending.createdAt() > PENDING_CALL_TTL_MILLIS) {
            pendingCalls.remove(key, pending);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(copy(pending.payload()));
    }

    private static String key(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static CallSignalPayload copy(CallSignalPayload source) {
        CallSignalPayload copy = new CallSignalPayload();
        copy.setSenderUsername(source.getSenderUsername());
        copy.setRecipientUsername(source.getRecipientUsername());
        copy.setType(source.getType());
        copy.setCallMode(source.getCallMode());
        copy.setSdp(source.getSdp());
        copy.setCandidate(source.getCandidate());
        return copy;
    }

    private record PendingCall(CallSignalPayload payload, long createdAt) {}

    @Data
    public static class CallSignalPayload {
        private String senderUsername;
        private String recipientUsername;
        private String type;
        private String callMode;
        private String sdp;
        private Object candidate;
    }
}
