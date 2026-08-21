package com.socialtush.modules.comments.entity;

import com.socialtush.modules.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "comment_resonances", uniqueConstraints = {
        @UniqueConstraint(name = "uk_comment_resonances_comment_user", columnNames = {"comment_id", "user_id"})
}, indexes = {
        @Index(name = "idx_comment_resonances_comment_id", columnList = "comment_id"),
        @Index(name = "idx_comment_resonances_user_id", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommentResonance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comment_id", nullable = false)
    private Comment comment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
