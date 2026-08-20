package com.socialtush.modules.auth.repository;

import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByToken(String token);
    List<RefreshToken> findByUserAndIsRevokedFalse(User user);
    List<RefreshToken> findByUserAndIsRevokedFalseAndExpiresAtAfterOrderByLastUsedAtDesc(User user, Instant now);
    List<RefreshToken> findByUserAndDeviceIdAndIsRevokedFalse(User user, String deviceId);
    void deleteByUser(User user);
}
