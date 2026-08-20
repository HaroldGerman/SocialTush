package com.socialtush.modules.chat.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthorizationInterceptor authorizationInterceptor;

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authorizationInterceptor);
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
