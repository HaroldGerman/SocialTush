package com.socialtush.modules.auth.repository;

import com.socialtush.modules.auth.entity.AccountActionToken;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountActionTokenRepository extends JpaRepository<AccountActionToken, UUID> {
    Optional<AccountActionToken> findByTokenHashAndPurpose(String tokenHash, String purpose);
    Optional<AccountActionToken> findFirstByUserAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(User user, String purpose);
    List<AccountActionToken> findByUserAndPurposeAndUsedAtIsNull(User user, String purpose);
}
