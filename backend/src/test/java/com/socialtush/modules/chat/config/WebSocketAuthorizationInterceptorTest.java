package com.socialtush.modules.chat.config;

import com.socialtush.modules.auth.security.JwtService;
import com.socialtush.modules.chat.repository.ConversationParticipantRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WebSocketAuthorizationInterceptorTest {
    private JwtService jwtService;
    private UserRepository userRepository;
    private ConversationParticipantRepository participantRepository;
    private WebSocketAuthorizationInterceptor interceptor;
    private User german;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        userRepository = mock(UserRepository.class);
        participantRepository = mock(ConversationParticipantRepository.class);
        interceptor = new WebSocketAuthorizationInterceptor(jwtService, userRepository, participantRepository);
        german = User.builder().id(UUID.randomUUID()).username("german").email("g@example.com").passwordHash("x").build();
    }

    @Test
    void authenticatedUserCanConnectAndSubscribeToOwnNotifications() {
        when(jwtService.extractUsername("valid")).thenReturn("german");
        when(userRepository.findByUsernameIgnoreCase("german")).thenReturn(Optional.of(german));
        when(jwtService.isTokenValid("valid", "german")).thenReturn(true);
        assertDoesNotThrow(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, null, "Bearer valid"), mock(org.springframework.messaging.MessageChannel.class)));
        assertDoesNotThrow(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/user.german.notifications", "german", null), mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test
    void userCannotSubscribeToAnotherUsersNotificationOrCallTopic() {
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/user.ana.notifications", "german", null), mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/user.ana.call", "german", null), mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test
    void onlyConversationParticipantsCanSubscribe() {
        UUID conversationId = UUID.randomUUID();
        when(userRepository.findByUsernameIgnoreCase("german")).thenReturn(Optional.of(german));
        when(participantRepository.existsByConversationIdAndUserId(conversationId, german.getId())).thenReturn(false, true);
        Message<?> frame = frame(StompCommand.SUBSCRIBE, "/topic/conversation." + conversationId, "german", null);
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame, mock(org.springframework.messaging.MessageChannel.class)));
        assertDoesNotThrow(() -> interceptor.preSend(frame, mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test
    void unauthenticatedConnectAndPrivateSendAreRejected() {
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame(StompCommand.CONNECT, null, null, null), mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame(StompCommand.SEND, "/app/call.signal", null, null), mock(org.springframework.messaging.MessageChannel.class)));
    }

    private Message<?> frame(StompCommand command, String destination, String username, String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (destination != null) accessor.setDestination(destination);
        if (username != null) accessor.setUser(new UsernamePasswordAuthenticationToken(username, null, List.of()));
        if (authorization != null) accessor.setNativeHeader("Authorization", authorization);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
