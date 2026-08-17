package com.socialtush.modules.circles.entity;

import com.socialtush.modules.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "circles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Circle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    @Column(name = "cover_url", length = 512)
    private String coverUrl;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String visibility = "PUBLIC"; // "PUBLIC", "PRIVATE", "SECRET"

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String type = "GENERAL"; // "GENERAL", "LOCAL", "EVENT", "TEMPORARY"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String country;

    @Column(length = 10)
    @Builder.Default
    private String language = "es";

    @Column(name = "members_count", nullable = false)
    @Builder.Default
    private int membersCount = 1;

    @Column(name = "active_now_count", nullable = false)
    @Builder.Default
    private int activeNowCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
