package com.socialtush.modules.chat.controller;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class WebSocketCallControllerTest {
    @Test
    void authenticatedPrincipalReplacesSpoofedSender() {
        SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
        WebSocketCallController controller = new WebSocketCallController(template);
        WebSocketCallController.CallSignalPayload payload = new WebSocketCallController.CallSignalPayload();
        payload.setSenderUsername("victima"); payload.setRecipientUsername("ana"); payload.setType("OFFER");
        Principal principal = () -> "german";

        controller.handleCallSignal(payload, principal);

        assertEquals("german", payload.getSenderUsername());
        verify(template).convertAndSend("/topic/user.ana.call", payload);
    }

    @Test
    void unauthenticatedCallSignalIsNotForwarded() {
        SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
        WebSocketCallController controller = new WebSocketCallController(template);
        WebSocketCallController.CallSignalPayload payload = new WebSocketCallController.CallSignalPayload();
        payload.setRecipientUsername("ana");
        controller.handleCallSignal(payload, null);
        verifyNoInteractions(template);
    }
}
