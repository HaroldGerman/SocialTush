package com.socialtush.modules.notifications.service;

import com.socialtush.modules.notifications.entity.Notification;
import com.socialtush.modules.notifications.repository.NotificationRepository;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationServiceWebPushTest {
    @Test
    void persistsNotificationAndOnlyPublishesDeliveryEvent() {
        NotificationRepository repository = mock(NotificationRepository.class);
        ProfileRepository profiles = mock(ProfileRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        User receiver = User.builder().id(UUID.randomUUID()).username("receiver").build();
        User sender = User.builder().id(UUID.randomUUID()).username("sender").build();
        when(repository.save(any())).thenAnswer(invocation -> {
            Notification value = invocation.getArgument(0);
            value.setId(UUID.randomUUID());
            return value;
        });

        NotificationService service = new NotificationService(repository, profiles, messaging, events);
        assertDoesNotThrow(() -> service.createNotification(receiver, sender, "FOLLOW", sender.getId()));

        verify(repository).save(any(Notification.class));
        verify(events).publishEvent(any(NotificationCreatedEvent.class));
    }

    @Test
    void doesNotCreateNotificationWhenSenderIsReceiver() {
        NotificationRepository repository = mock(NotificationRepository.class);
        ProfileRepository profiles = mock(ProfileRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        User user = User.builder().id(UUID.randomUUID()).username("self").build();

        new NotificationService(repository, profiles, messaging, events)
                .createNotification(user, user, "FOLLOW", user.getId());

        verifyNoInteractions(repository, messaging, events);
    }

    @Test
    void notificationRemainsPersistedWhenPushEventDispatchFails() {
        NotificationRepository repository = mock(NotificationRepository.class);
        ProfileRepository profiles = mock(ProfileRepository.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        User receiver = User.builder().id(UUID.randomUUID()).username("receiver_fail").build();
        User sender = User.builder().id(UUID.randomUUID()).username("sender_fail").build();
        when(repository.save(any())).thenAnswer(invocation -> {
            Notification value = invocation.getArgument(0);
            value.setId(UUID.randomUUID());
            return value;
        });
        doThrow(new RuntimeException("executor unavailable")).when(events).publishEvent(any());

        assertDoesNotThrow(() -> new NotificationService(repository, profiles, messaging, events)
                .createNotification(receiver, sender, "FOLLOW", sender.getId()));

        verify(repository).save(any(Notification.class));
    }
}
