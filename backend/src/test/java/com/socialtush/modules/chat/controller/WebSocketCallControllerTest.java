package com.socialtush.modules.chat.controller;

import com.socialtush.modules.notifications.service.WebPushService;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class WebSocketCallControllerTest {
    @Test
    void authenticatedPrincipalReplacesSpoofedSender() {
        SimpMessagingTemplate template = mock(SimpMessagingTemplate.class);
        UserRepository userRepository = mock(UserRepository.class);
        WebPushService webPushService = mock(WebPushService.class);
        WebSocketCallController controller = new WebSocketCallController(template, userRepository, webPushService);
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
        UserRepository userRepository = mock(UserRepository.class);
        WebPushService webPushService = mock(WebPushService.class);
        WebSocketCallController controller = new WebSocketCallController(template, userRepository, webPushService);
        WebSocketCallController.CallSignalPayload payload = new WebSocketCallController.CallSignalPayload();
        payload.setRecipientUsername("ana");
        controller.handleCallSignal(payload, null);
        verifyNoInteractions(template, userRepository, webPushService);
    }
}
