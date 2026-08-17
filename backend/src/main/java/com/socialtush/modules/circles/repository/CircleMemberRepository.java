package com.socialtush.modules.circles.repository;

import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.entity.CircleMember;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CircleMemberRepository extends JpaRepository<CircleMember, UUID> {
    boolean existsByCircleIdAndUserId(UUID circleId, UUID userId);
    Optional<CircleMember> findByCircleIdAndUserId(UUID circleId, UUID userId);
    List<CircleMember> findByUserId(UUID userId);
    List<CircleMember> findByCircleId(UUID circleId);
    long countByCircleId(UUID circleId);
}
