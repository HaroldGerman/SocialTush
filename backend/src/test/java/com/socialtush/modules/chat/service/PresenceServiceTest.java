package com.socialtush.modules.chat.service;

import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PresenceServiceTest {
    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String,String> values;
    @Mock SetOperations<String,String> sets;
    @Mock UserRepository users;
    @Mock ProfileRepository profiles;
    @Mock SimpMessagingTemplate messaging;
    PresenceService service;
    User user;
    Profile profile;

    @BeforeEach
    void setUp() {
        lenient().when(redis.opsForValue()).thenReturn(values);
        lenient().when(redis.opsForSet()).thenReturn(sets);
        user = User.builder().id(UUID.randomUUID()).username("vale").build();
        profile = Profile.builder().userId(user.getId()).user(user).displayName("Valeria").build();
        lenient().when(users.findByUsernameIgnoreCase("vale")).thenReturn(Optional.of(user));
        lenient().when(profiles.findById(user.getId())).thenReturn(Optional.of(profile));
        service = new PresenceService(redis, users, profiles, messaging);
    }

    @Test
    void multipleSessionsKeepUserOnlineUntilLastSessionExpires() {
        service.connected("phone", "vale");
        service.connected("web", "vale");
        when(sets.members("presence:user:vale:sessions")).thenReturn(Set.of("phone", "web"));
        when(redis.hasKey("presence:session:phone")).thenReturn(false);
        when(redis.hasKey("presence:session:web")).thenReturn(true);

        service.disconnected("phone");

        assertThat(service.isOnline("vale")).isTrue();
        verify(profiles, never()).save(any());
    }

    @Test
    void privacyHidesOnlineAndLastSeen() {
        profile.setShowOnlineStatus(false);
        profile.setShowLastSeen(false);

        PresenceService.PresenceView view = service.view("vale");

        assertThat(view.online()).isFalse();
        assertThat(view.lastSeenAt()).isNull();
        assertThat(view.onlineVisible()).isFalse();
        assertThat(view.lastSeenVisible()).isFalse();
    }
}
