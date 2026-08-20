package com.socialtush.modules.auth.service;

import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountSessionServiceTest {

    @Mock RefreshTokenRepository refreshTokens;
    @Mock WebPushSubscriptionRepository webPushSubscriptions;
    @Mock HttpServletRequest request;

    @Test
    void securityAdoptionRemovesLegacyAndServerFallbackButKeepsRealOtherDevice() {
        AccountSessionService service = new AccountSessionService(refreshTokens, webPushSubscriptions);
        User user = User.builder().id(UUID.randomUUID()).username("owner").email("owner@test.local").passwordHash("x").build();
        Instant future = Instant.now().plusSeconds(3600);

        RefreshToken current = RefreshToken.builder()
                .id(UUID.randomUUID()).user(user).token("current-token").expiresAt(future)
                .deviceId("lifonk-current").sessionKey(UUID.randomUUID()).isRevoked(false).build();
        RefreshToken legacy = RefreshToken.builder()
                .id(UUID.randomUUID()).user(user).token("legacy-token").expiresAt(future)
                .deviceId(null).sessionKey(UUID.randomUUID()).isRevoked(false).build();
        RefreshToken serverFallback = RefreshToken.builder()
                .id(UUID.randomUUID()).user(user).token("server-token").expiresAt(future)
                .deviceId("server-" + UUID.randomUUID()).sessionKey(UUID.randomUUID()).isRevoked(false).build();
        RefreshToken otherRealDevice = RefreshToken.builder()
                .id(UUID.randomUUID()).user(user).token("other-token").expiresAt(future)
                .deviceId("lifonk-other").sessionKey(UUID.randomUUID()).isRevoked(false).build();

        when(request.getHeader(AccountSessionService.DEVICE_ID_HEADER)).thenReturn("lifonk-current");
        when(request.getHeader("User-Agent")).thenReturn("Mozilla/5.0 (Linux; Android 16; Mobile) Chrome/140.0.0.0");
        when(refreshTokens.findByToken("current-token")).thenReturn(Optional.of(current));
        when(refreshTokens.findByUserAndIsRevokedFalseAndExpiresAtAfterOrderByLastUsedAtDesc(any(User.class), any(Instant.class)))
                .thenReturn(List.of(current, legacy, serverFallback, otherRealDevice));

        service.adoptCurrentSession(user, request, "current-token");

        assertTrue(legacy.isRevoked());
        assertTrue(serverFallback.isRevoked());
        assertFalse(otherRealDevice.isRevoked());
        verify(refreshTokens).save(current);
        verify(refreshTokens).saveAll(any());
    }
}
