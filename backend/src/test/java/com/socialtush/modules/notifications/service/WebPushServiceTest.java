package com.socialtush.modules.notifications.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialtush.modules.notifications.entity.WebPushSubscription;
import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebPushServiceTest {
    @Mock WebPushSubscriptionRepository repository;
    @Mock WebPushSender sender;

    @Test
    void attemptsEveryActiveSubscriptionAndDoesNotPropagateProviderFailure() throws Exception {
        User receiver = User.builder().id(UUID.randomUUID()).username("receiver").email("r@example.com").passwordHash("x").build();
        WebPushSubscription first = subscription(receiver, "https://push.example/a");
        WebPushSubscription second = subscription(receiver, "https://push.example/b");
        when(sender.isConfigured()).thenReturn(true);
        when(repository.findByUserAndActiveTrue(receiver)).thenReturn(List.of(first, second));
        when(sender.send(eq(first), any())).thenThrow(new RuntimeException("provider unavailable"));
        when(sender.send(eq(second), any())).thenReturn(201);

        WebPushService service = new WebPushService(repository, sender, new ObjectMapper());
        WebPushDeliverySummary summary = assertDoesNotThrow(() -> service.sendToUser(receiver, payload()));
        assertEquals(2, summary.attempted());
        assertEquals(1, summary.success());
        assertEquals(1, summary.failed());

        verify(sender).send(eq(first), any());
        verify(sender).send(eq(second), any());
        verify(repository).saveAll(List.of(first, second));
    }

    @Test
    void authorizationFailureCountsAsFailedWithoutDeactivatingSubscription() throws Exception {
        User receiver = User.builder().id(UUID.randomUUID()).username("receiver3").email("r3@example.com").passwordHash("x").build();
        WebPushSubscription subscription = subscription(receiver, "https://push.example/forbidden");
        when(sender.isConfigured()).thenReturn(true);
        when(repository.findByUserAndActiveTrue(receiver)).thenReturn(List.of(subscription));
        when(sender.send(eq(subscription), any())).thenReturn(403);

        WebPushDeliverySummary summary = new WebPushService(repository, sender, new ObjectMapper())
                .sendToUser(receiver, payload());

        assertEquals(1, summary.attempted());
        assertEquals(0, summary.success());
        assertEquals(1, summary.failed());
        assertTrue(subscription.isActive());
    }

    @ParameterizedTest
    @ValueSource(ints = {404, 410})
    void deactivatesGoneSubscription(int providerStatus) throws Exception {
        User receiver = User.builder().id(UUID.randomUUID()).username("receiver2").email("r2@example.com").passwordHash("x").build();
        WebPushSubscription gone = subscription(receiver, "https://push.example/gone");
        when(sender.isConfigured()).thenReturn(true);
        when(repository.findByUserAndActiveTrue(receiver)).thenReturn(List.of(gone));
        when(sender.send(eq(gone), any())).thenReturn(providerStatus);

        new WebPushService(repository, sender, new ObjectMapper()).sendToUser(receiver, payload());

        assertFalse(gone.isActive());
        verify(repository).saveAll(List.of(gone));
    }

    private WebPushSubscription subscription(User user, String endpoint) {
        return WebPushSubscription.builder().id(UUID.randomUUID()).user(user).endpoint(endpoint)
                .p256dh("key").auth("auth").active(true).build();
    }

    private WebPushPayload payload() {
        return WebPushPayload.builder().title("Lifonk").body("Test").type("FOLLOW")
                .notificationId(UUID.randomUUID()).url("/notifications").build();
    }
}
