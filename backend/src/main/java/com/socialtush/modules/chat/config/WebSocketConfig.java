package com.socialtush.modules.chat.config;

import com.socialtush.modules.auth.security.JwtService;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authorization = accessor.getFirstNativeHeader("Authorization");
                    if (authorization != null && authorization.startsWith("Bearer ")) {
                        String token = authorization.substring(7);
                        try {
                            String username = jwtService.extractUsername(token);
                            userRepository.findByUsernameIgnoreCase(username)
                                    .filter(user -> jwtService.isTokenValid(token, user.getUsername()))
                                    .ifPresent(user -> accessor.setUser(new UsernamePasswordAuthenticationToken(
                                            user.getUsername(), null, java.util.List.of())));
                        } catch (Exception ignored) {
                            // The signal controller rejects frames without an authenticated Principal.
                        }
                    }
                }
                return message;
            }
        });
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Habilitamos broker simple para subscripciones a temas (/topic para grupos y /queue para mensajes de usuario individuales)
        registry.enableSimpleBroker("/topic", "/queue");
        // Prefijo para enviar mensajes desde el cliente hacia el backend (@MessageMapping)
        registry.setApplicationDestinationPrefixes("/app");
        // Prefijo para mensajes específicos a un usuario
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint estándar para clientes Web (con SockJS)
        registry.addEndpoint("/ws/chat")
                .setAllowedOrigins("http://localhost:3000")
                .withSockJS();

        // Endpoint alternativo puro para clientes móviles (React Native)
        registry.addEndpoint("/ws/chat")
                .setAllowedOrigins("*");
    }
}
