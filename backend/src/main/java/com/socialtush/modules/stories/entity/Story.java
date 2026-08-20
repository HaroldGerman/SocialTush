package com.socialtush.modules.stories.entity;

import com.socialtush.modules.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stories", indexes = {
    @Index(name = "idx_stories_expires_at", columnList = "expires_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Story {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "media_type", nullable = false, length = 20)
    private String mediaType; // "IMAGE", "VIDEO", "TEXT"

    @Column(name = "media_url", length = 512)
    private String mediaUrl;

    @Column(name = "text_content", columnDefinition = "TEXT")
    private String textContent;

    @Column(name = "background_color", length = 7)
    private String backgroundColor; // Hex code, e.g. #ff0000

    @Column(name = "music_url", length = 512)
    private String musicUrl;

    @Column(name = "music_title", length = 255)
    private String musicTitle;

    @Column(name = "is_best_friends", nullable = false)
    @Builder.Default
    private boolean isBestFriends = false;

    @Column(name = "overlay_data", columnDefinition = "TEXT")
    private String overlayData;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
