package com.socialtush.modules.auth.service;

import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.notifications.repository.WebPushSubscriptionRepository;
import com.socialtush.modules.users.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountSessionService {

    public static final String DEVICE_ID_HEADER = "X-Lifonk-Device-Id";

    private final RefreshTokenRepository refreshTokenRepository;
    private final WebPushSubscriptionRepository webPushSubscriptionRepository;

    public record DeviceMetadata(String deviceId, String label, String type, String userAgent) {}
    public record SessionInfo(UUID sessionKey, String label, String deviceType,
                              Instant createdAt, Instant lastActiveAt, Instant expiresAt,
                              boolean current) {}

    public DeviceMetadata resolveDevice(HttpServletRequest request, RefreshToken previous) {
        String headerDeviceId = clean(request == null ? null : request.getHeader(DEVICE_ID_HEADER), 128);
        String previousDeviceId = previous == null ? null : clean(previous.getDeviceId(), 128);
        String deviceId = headerDeviceId != null ? headerDeviceId
                : previousDeviceId != null ? previousDeviceId
                : "server-" + UUID.randomUUID();

        String userAgent = clean(request == null ? null : request.getHeader("User-Agent"), 512);
        if (userAgent == null && previous != null) userAgent = clean(previous.getUserAgent(), 512);
        String platform = platform(userAgent);
        String browser = browser(userAgent);
        String type = deviceType(userAgent);
        return new DeviceMetadata(deviceId, browser + " en " + platform, type, userAgent);
    }

    public UUID resolveSessionKey(RefreshToken previous) {
        return previous != null && previous.getSessionKey() != null ? previous.getSessionKey() : UUID.randomUUID();
    }

    public void revokeActiveDeviceTokens(User user, String deviceId) {
        if (user == null || deviceId == null || deviceId.isBlank()) return;
        List<RefreshToken> tokens = refreshTokenRepository.findByUserAndDeviceIdAndIsRevokedFalse(user, deviceId);
        if (tokens.isEmpty()) return;
        tokens.forEach(token -> token.setRevoked(true));
        refreshTokenRepository.saveAll(tokens);
    }

    /**
     * Existing tokens predate device metadata. When the security screen is opened from one
     * of those sessions, adopt the current token and revoke the other anonymous legacy tokens.
     * This removes inflated historical counts without guessing which old token belonged to which device.
     */
    public void adoptCurrentSession(User user, HttpServletRequest request, String rawToken) {
        if (user == null || rawToken == null || rawToken.isBlank()) return;
        RefreshToken current = refreshTokenRepository.findByToken(rawToken).orElse(null);
        if (current == null || current.isRevoked() || current.isExpired()
                || !current.getUser().getId().equals(user.getId())) return;

        boolean wasLegacy = current.getDeviceId() == null || current.getDeviceId().isBlank();
        DeviceMetadata metadata = resolveDevice(request, current);
        current.setDeviceId(metadata.deviceId());
        current.setDeviceLabel(metadata.label());
        current.setDeviceType(metadata.type());
        current.setUserAgent(metadata.userAgent());
        if (current.getSessionKey() == null) current.setSessionKey(UUID.randomUUID());
        current.setLastUsedAt(Instant.now());
        refreshTokenRepository.save(current);

        if (!wasLegacy) return;
        List<RefreshToken> active = refreshTokenRepository
                .findByUserAndIsRevokedFalseAndExpiresAtAfterOrderByLastUsedAtDesc(user, Instant.now());
        boolean changed = false;
        for (RefreshToken token : active) {
            if (token.getId().equals(current.getId())) continue;
            if (token.getDeviceId() == null || token.getDeviceId().isBlank()) {
                token.setRevoked(true);
                changed = true;
            }
        }
        if (changed) refreshTokenRepository.saveAll(active);
    }

    public List<SessionInfo> sessions(User user, String currentRawToken) {
        List<RefreshToken> active = refreshTokenRepository
                .findByUserAndIsRevokedFalseAndExpiresAtAfterOrderByLastUsedAtDesc(user, Instant.now());
        Map<String, List<RefreshToken>> grouped = new LinkedHashMap<>();
        for (RefreshToken token : active) {
            String key = token.getSessionKey() != null ? "session:" + token.getSessionKey()
                    : token.getDeviceId() != null && !token.getDeviceId().isBlank() ? "device:" + token.getDeviceId()
                    : "legacy";
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(token);
        }

        List<SessionInfo> result = new ArrayList<>();
        for (List<RefreshToken> group : grouped.values()) {
            RefreshToken newest = group.get(0);
            boolean current = group.stream().anyMatch(token -> currentRawToken != null && currentRawToken.equals(token.getToken()));
            Instant lastActive = newest.getLastUsedAt() != null ? newest.getLastUsedAt() : newest.getCreatedAt();
            String label = newest.getDeviceLabel();
            if (label == null || label.isBlank()) label = "Sesión anterior";
            String type = newest.getDeviceType();
            if (type == null || type.isBlank()) type = "UNKNOWN";
            result.add(new SessionInfo(newest.getSessionKey(), label, type,
                    newest.getCreatedAt(), lastActive, newest.getExpiresAt(), current));
        }
        return result;
    }

    public void invalidateAll(User user) {
        user.setAuthVersion(user.getAuthVersion() + 1);

        List<RefreshToken> activeTokens = refreshTokenRepository.findByUserAndIsRevokedFalse(user);
        if (!activeTokens.isEmpty()) {
            activeTokens.forEach(token -> token.setRevoked(true));
            refreshTokenRepository.saveAll(activeTokens);
        }

        webPushSubscriptionRepository.deleteByUser(user);
    }

    public void deleteSessionArtifacts(User user) {
        refreshTokenRepository.deleteByUser(user);
        webPushSubscriptionRepository.deleteByUser(user);
    }

    private String browser(String userAgent) {
        if (userAgent == null) return "Navegador";
        if (userAgent.contains("SamsungBrowser/")) return "Samsung Internet";
        if (userAgent.contains("Edg/")) return "Microsoft Edge";
        if (userAgent.contains("Firefox/") || userAgent.contains("FxiOS/")) return "Firefox";
        if (userAgent.contains("CriOS/") || userAgent.contains("Chrome/")) return "Chrome";
        if (userAgent.contains("Safari/") && userAgent.contains("Version/")) return "Safari";
        return "Navegador";
    }

    private String platform(String userAgent) {
        if (userAgent == null) return "dispositivo desconocido";
        if (userAgent.contains("Android")) return "Android";
        if (userAgent.contains("iPad")) return "iPadOS";
        if (userAgent.contains("iPhone") || userAgent.contains("iPod")) return "iOS";
        if (userAgent.contains("Windows")) return "Windows";
        if (userAgent.contains("Mac OS X") || userAgent.contains("Macintosh")) return "macOS";
        if (userAgent.contains("Linux")) return "Linux";
        return "dispositivo desconocido";
    }

    private String deviceType(String userAgent) {
        if (userAgent == null) return "UNKNOWN";
        String ua = userAgent.toLowerCase(Locale.ROOT);
        if (ua.contains("ipad") || ua.contains("tablet")) return "TABLET";
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) return "MOBILE";
        return "DESKTOP";
    }

    private String clean(String value, int maxLength) {
        if (value == null) return null;
        String cleaned = value.trim();
        if (cleaned.isBlank()) return null;
        return cleaned.length() <= maxLength ? cleaned : cleaned.substring(0, maxLength);
    }
}
