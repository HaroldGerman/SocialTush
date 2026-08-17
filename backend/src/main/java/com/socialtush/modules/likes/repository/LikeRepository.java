package com.socialtush.modules.likes.repository;

import com.socialtush.modules.likes.entity.Like;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LikeRepository extends JpaRepository<Like, UUID> {
    boolean existsByUserAndTargetIdAndTargetType(User user, UUID targetId, String targetType);
    Optional<Like> findByUserAndTargetIdAndTargetType(User user, UUID targetId, String targetType);
    long countByTargetIdAndTargetType(UUID targetId, String targetType);
}
