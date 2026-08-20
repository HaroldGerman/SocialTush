package com.socialtush.modules.chat.service;

import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {
    private static final Duration SESSION_TTL = Duration.ofSeconds(90);
    private final StringRedisTemplate redis;
    private final UserRepository users;
    private final ProfileRepository profiles;
    private final SimpMessagingTemplate messaging;
    private final Map<String, String> localSessions = new ConcurrentHashMap<>();

    public void connected(String sessionId, String username) {
        localSessions.put(sessionId, username);
        refreshSession(sessionId, username);
        publish(username, true, null);
    }

    public void disconnected(String sessionId) {
        String username = localSessions.remove(sessionId);
        if (username == null) return;
        try {
            redis.delete(sessionKey(sessionId));
            redis.opsForSet().remove(userSessionsKey(username), sessionId);
        } catch (RuntimeException ex) { log.warn("Redis presence disconnect failed", ex); }
        if (!isOnline(username)) {
            Instant lastSeen = Instant.now();
            users.findByUsernameIgnoreCase(username).flatMap(user -> profiles.findById(user.getId())).ifPresent(profile -> {
                profile.setLastSeenAt(lastSeen);
                profiles.save(profile);
            });
            publish(username, false, lastSeen);
        }
    }

    @Scheduled(fixedDelay = 30000)
    public void refreshLocalSessions() {
        localSessions.forEach(this::refreshSession);
    }

    public boolean isOnline(String username) {
        try {
            var sessionIds = redis.opsForSet().members(userSessionsKey(username));
            if (sessionIds == null) return false;
            for (String sessionId : sessionIds) {
                if (Boolean.TRUE.equals(redis.hasKey(sessionKey(sessionId)))) return true;
                redis.opsForSet().remove(userSessionsKey(username), sessionId);
            }
            return false;
        } catch (RuntimeException ex) {
            return localSessions.containsValue(username);
        }
    }

    public PresenceView view(String username) {
        User user = users.findByUsernameIgnoreCase(username).orElse(null);
        Profile profile = user == null ? null : profiles.findById(user.getId()).orElse(null);
        if (profile == null) return new PresenceView(false, null, false, false);
        boolean onlineVisible = profile.isShowOnlineStatus();
        boolean lastSeenVisible = profile.isShowLastSeen();
        return new PresenceView(onlineVisible && isOnline(username), lastSeenVisible ? profile.getLastSeenAt() : null,
                onlineVisible, lastSeenVisible);
    }

    private void refreshSession(String sessionId, String username) {
        try {
            redis.opsForValue().set(sessionKey(sessionId), username, SESSION_TTL);
            redis.opsForSet().add(userSessionsKey(username), sessionId);
            redis.expire(userSessionsKey(username), SESSION_TTL.plusSeconds(30));
        } catch (RuntimeException ex) { log.warn("Redis presence refresh failed", ex); }
    }

    private void publish(String username, boolean online, Instant lastSeen) {
        Profile profile = users.findByUsernameIgnoreCase(username).flatMap(user -> profiles.findById(user.getId())).orElse(null);
        if (profile == null || !profile.isShowOnlineStatus()) return;
        messaging.convertAndSend("/topic/presence", Map.of("type", "PRESENCE_CHANGED", "username", username,
                "online", online, "lastSeenAt", lastSeen == null || !profile.isShowLastSeen() ? "" : lastSeen.toString()));
    }

    private String sessionKey(String sessionId) { return "presence:session:" + sessionId; }
    private String userSessionsKey(String username) { return "presence:user:" + username.toLowerCase() + ":sessions"; }
    public record PresenceView(boolean online, Instant lastSeenAt, boolean onlineVisible, boolean lastSeenVisible) {}
}
