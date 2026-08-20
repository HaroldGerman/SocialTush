package com.socialtush.modules.users.repository;

import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByUsernameIgnoreCase(String username);
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmailIgnoreCase(String email);
    long countByIsActiveTrue();
    long countByIsActiveFalse();
    long countByIsVerifiedTrue();
    long countByCreatedAtAfter(java.time.Instant instant);
    long countByRoleAndIsActiveTrue(String role);

    interface AdminUserView {
        UUID getUserId();
        String getUsername();
        String getEmail();
        String getRole();
        boolean getActive();
        boolean getVerified();
        java.time.Instant getCreatedAt();
        String getDisplayName();
        String getBio();
        String getAvatarUrl();
        boolean getPrivateAccount();
        long getPostCount();
        long getFollowerCount();
        long getFollowingCount();
        long getActiveStoryCount();
    }

    @Query(value = """
            SELECT u.id AS userId, u.username AS username, u.email AS email, u.role AS role,
                   u.isActive AS active, u.isVerified AS verified, u.createdAt AS createdAt,
                   COALESCE(p.displayName, u.username) AS displayName, p.bio AS bio,
                   p.avatarUrl AS avatarUrl, COALESCE(p.isPrivate, false) AS privateAccount,
                   (SELECT COUNT(po) FROM Post po WHERE po.user = u) AS postCount,
                   (SELECT COUNT(f1) FROM Follow f1 WHERE f1.following = u) AS followerCount,
                   (SELECT COUNT(f2) FROM Follow f2 WHERE f2.follower = u) AS followingCount,
                   (SELECT COUNT(s) FROM Story s WHERE s.user = u AND s.expiresAt > :now) AS activeStoryCount
            FROM User u LEFT JOIN Profile p ON p.user = u
            WHERE (:query = '' OR LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%'))
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))
                   OR LOWER(COALESCE(p.displayName, '')) LIKE LOWER(CONCAT('%', :query, '%')))
              AND (:filter = 'ALL'
                   OR (:filter = 'ACTIVE' AND u.isActive = true)
                   OR (:filter = 'BLOCKED' AND u.isActive = false)
                   OR (:filter = 'VERIFIED' AND u.isVerified = true)
                   OR (:filter = 'UNVERIFIED' AND u.isVerified = false)
                   OR (:filter = 'ADMINS' AND u.role = 'ADMIN'))
            """,
            countQuery = """
            SELECT COUNT(u) FROM User u LEFT JOIN Profile p ON p.user = u
            WHERE (:query = '' OR LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%'))
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))
                   OR LOWER(COALESCE(p.displayName, '')) LIKE LOWER(CONCAT('%', :query, '%')))
              AND (:filter = 'ALL'
                   OR (:filter = 'ACTIVE' AND u.isActive = true)
                   OR (:filter = 'BLOCKED' AND u.isActive = false)
                   OR (:filter = 'VERIFIED' AND u.isVerified = true)
                   OR (:filter = 'UNVERIFIED' AND u.isVerified = false)
                   OR (:filter = 'ADMINS' AND u.role = 'ADMIN'))
            """)
    Page<AdminUserView> searchAdminUsers(@Param("query") String query, @Param("filter") String filter,
                                         @Param("now") java.time.Instant now, Pageable pageable);
}
