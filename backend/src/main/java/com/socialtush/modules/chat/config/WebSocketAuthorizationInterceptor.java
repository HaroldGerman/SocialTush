package com.socialtush.modules.chat.config;

import com.socialtush.modules.auth.security.JwtService;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class WebSocketAuthorizationInterceptor implements ChannelInterceptor {
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ConversationParticipantRepository participantRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();
        if (command == null) return message;
        if (StompCommand.CONNECT.equals(command)) authenticate(accessor);
        if (StompCommand.SUBSCRIBE.equals(command)) authorizeSubscription(accessor);
        if (StompCommand.SEND.equals(command) && destination(accessor).startsWith("/app/")) requirePrincipal(accessor);
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) throw denied("Se requiere JWT para conectar");
        String token = authorization.substring(7).trim();
        try {
            String username = jwtService.extractUsername(token);
            User user = userRepository.findByUsernameIgnoreCase(username)
                    .filter(found -> jwtService.isTokenValid(token, found.getUsername()))
                    .orElseThrow(() -> denied("JWT inválido"));
            accessor.setUser(new UsernamePasswordAuthenticationToken(user.getUsername(), null, List.of()));
        } catch (MessageDeliveryException exception) {
            throw exception;
        } catch (Exception exception) {
            throw denied("JWT inválido");
        }
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        Principal principal = requirePrincipal(accessor);
        String destination = destination(accessor);
        String notificationsPrefix = "/topic/user.";
        if (destination.startsWith(notificationsPrefix)
                && (destination.endsWith(".notifications") || destination.endsWith(".call") || destination.endsWith(".buzz"))) {
            String suffix = destination.endsWith(".notifications") ? ".notifications"
                    : destination.endsWith(".call") ? ".call" : ".buzz";
            String username = destination.substring(notificationsPrefix.length(), destination.length() - suffix.length());
            if (!principal.getName().equalsIgnoreCase(username)) throw denied("No puedes suscribirte al canal privado de otro usuario");
            return;
        }
        String conversationPrefix = "/topic/conversation.";
        if (destination.startsWith(conversationPrefix)) {
            String rawId = destination.substring(conversationPrefix.length()).replaceFirst("\\.typing$", "");
            User user = userRepository.findByUsernameIgnoreCase(principal.getName()).orElseThrow(() -> denied("Usuario no encontrado"));
            try {
                if (!participantRepository.existsByConversationIdAndUserId(UUID.fromString(rawId), user.getId())) throw denied("No participas en esta conversación");
            } catch (IllegalArgumentException exception) {
                throw denied("Canal de conversación inválido");
            }
            return;
        }
        if (destination.startsWith("/topic/user.") || destination.startsWith("/topic/conversation.")) throw denied("Canal privado no autorizado");
    }

    private Principal requirePrincipal(StompHeaderAccessor accessor) {
        Principal principal = accessor.getUser();
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) throw denied("WebSocket no autenticado");
        return principal;
    }

    private String destination(StompHeaderAccessor accessor) {
        return accessor.getDestination() == null ? "" : accessor.getDestination().trim().toLowerCase(Locale.ROOT);
    }

    private MessageDeliveryException denied(String message) { return new MessageDeliveryException(message); }
}
