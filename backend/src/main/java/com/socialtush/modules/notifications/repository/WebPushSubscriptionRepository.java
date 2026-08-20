package com.socialtush.modules.notifications.repository;

import com.socialtush.modules.notifications.entity.WebPushSubscription;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WebPushSubscriptionRepository extends JpaRepository<WebPushSubscription, UUID> {
    List<WebPushSubscription> findByUserAndActiveTrue(User user);
    Optional<WebPushSubscription> findByEndpoint(String endpoint);
    Optional<WebPushSubscription> findByUserAndEndpoint(User user, String endpoint);
}
