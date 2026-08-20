package com.socialtush.modules.auth.service;

import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountSessionService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final WebPushSubscriptionRepository webPushSubscriptionRepository;

    public void invalidateAll(User user) {
        user.setAuthVersion(user.getAuthVersion() + 1);

        List<RefreshToken> activeTokens = refreshTokenRepository.findByUserAndIsRevokedFalse(user);
        if (!activeTokens.isEmpty()) {
            activeTokens.forEach(token -> token.setRevoked(true));
            refreshTokenRepository.saveAll(activeTokens);
        }

        // A browser can keep a PushSubscription after logout. Remove backend bindings so
        // a former session cannot keep receiving private Lifonk notifications.
        webPushSubscriptionRepository.deleteByUser(user);
    }

    public long activeSessionCount(User user) {
        return refreshTokenRepository.findByUserAndIsRevokedFalse(user).size();
    }

    public void deleteSessionArtifacts(User user) {
        refreshTokenRepository.deleteByUser(user);
        webPushSubscriptionRepository.deleteByUser(user);
    }
}
