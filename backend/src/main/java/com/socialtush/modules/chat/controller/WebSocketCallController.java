package com.socialtush.modules.chat.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class WebSocketCallController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/call.signal")
    public void handleCallSignal(CallSignalPayload payload, Principal principal) {
        if (principal == null || payload == null || payload.getRecipientUsername() == null || payload.getRecipientUsername().isBlank()) return;
        payload.setSenderUsername(principal.getName());
        // Forward WebRTC SDP descriptions and ICE candidates directly to the recipient's private topic
        messagingTemplate.convertAndSend("/topic/user." + payload.getRecipientUsername() + ".call", payload);
    }

    @Data
    public static class CallSignalPayload {
        private String senderUsername;
        private String recipientUsername;
        private String type; // "OFFER", "ANSWER", "ICE_CANDIDATE", "HANGUP", "REJECT", "BUSY"
        private String callMode; // "AUDIO", "VIDEO"
        private String sdp;
        private Object candidate;
    }
}
