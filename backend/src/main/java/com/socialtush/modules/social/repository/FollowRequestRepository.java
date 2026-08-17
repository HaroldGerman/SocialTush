package com.socialtush.modules.social.repository;

import com.socialtush.modules.social.entity.FollowRequest;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FollowRequestRepository extends JpaRepository<FollowRequest, UUID> {
    boolean existsBySenderIdAndReceiverIdAndStatus(UUID senderId, UUID receiverId, String status);
    Optional<FollowRequest> findBySenderIdAndReceiverId(UUID senderId, UUID receiverId);
    boolean existsBySenderAndReceiverAndStatus(User sender, User receiver, String status);
    Optional<FollowRequest> findBySenderAndReceiver(User sender, User receiver);
    List<FollowRequest> findByReceiverAndStatus(User receiver, String status);
}
