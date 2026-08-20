package com.socialtush.modules.chat.config;

import com.socialtush.modules.chat.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
@RequiredArgsConstructor
public class WebSocketPresenceListener {
    private final PresenceService presence;

    @EventListener
    public void connected(SessionConnectEvent event) {
        String sessionId = event.getMessage().getHeaders().get("simpSessionId", String.class);
        if (event.getUser() != null && sessionId != null) presence.connected(sessionId, event.getUser().getName());
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent event) {
        presence.disconnected(event.getSessionId());
    }
}
