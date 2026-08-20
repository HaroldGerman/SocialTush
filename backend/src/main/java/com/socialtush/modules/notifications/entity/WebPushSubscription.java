package com.socialtush.modules.notifications.entity;

import com.socialtush.modules.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "web_push_subscriptions", indexes = {
        @Index(name = "idx_web_push_subscriptions_user_id", columnList = "user_id"),
        @Index(name = "idx_web_push_subscriptions_active", columnList = "is_active")
}, uniqueConstraints = @UniqueConstraint(name = "uk_web_push_subscriptions_endpoint", columnNames = "endpoint"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebPushSubscription {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String endpoint;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String p256dh;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String auth;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;
}
