package com.socialtush.modules.circles.repository;

import com.socialtush.modules.circles.entity.CircleJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CircleJoinRequestRepository extends JpaRepository<CircleJoinRequest, UUID> {
    boolean existsByCircleIdAndUserIdAndStatus(UUID circleId, UUID userId, String status);
    Optional<CircleJoinRequest> findByCircleIdAndUserId(UUID circleId, UUID userId);
    List<CircleJoinRequest> findByCircleIdAndStatus(UUID circleId, String status);
}
