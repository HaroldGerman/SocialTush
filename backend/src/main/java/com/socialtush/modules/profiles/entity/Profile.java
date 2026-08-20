package com.socialtush.modules.profiles.entity;

import com.socialtush.modules.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Profile implements Persistable<UUID> {

    @Id
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    @Column(name = "interests", columnDefinition = "TEXT")
    private String interests;

    @Column(name = "onboarding_completed", nullable = false)
    @Builder.Default
    private boolean onboardingCompleted = false;

    @Column(name = "is_private", nullable = false)
    @Builder.Default
    private boolean isPrivate = false;

    @Column(name = "show_last_seen", nullable = false)
    @Builder.Default
    private boolean showLastSeen = true;

    @Column(name = "show_online_status", nullable = false)
    @Builder.Default
    private boolean showOnlineStatus = true;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "who_can_message", nullable = false, length = 20)
    @Builder.Default
    private String whoCanMessage = "EVERYONE";

    @Column(name = "who_can_comment", nullable = false, length = 20)
    @Builder.Default
    private String whoCanComment = "EVERYONE";

    @Column(name = "who_can_mention", nullable = false, length = 20)
    @Builder.Default
    private String whoCanMention = "EVERYONE";

    @Column(name = "who_can_see_stories", nullable = false, length = 20)
    @Builder.Default
    private String whoCanSeeStories = "EVERYONE";

    @Column(name = "read_receipts_enabled", nullable = false)
    @Builder.Default
    private boolean readReceiptsEnabled = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Override
    public UUID getId() {
        return userId;
    }

    @Override
    public boolean isNew() {
        return createdAt == null;
    }
}
