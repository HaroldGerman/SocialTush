package com.socialtush.modules.chat.entity;

import com.socialtush.modules.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversation_participants", uniqueConstraints = {
    @UniqueConstraint(name = "uc_conversation_user", columnNames = {"conversation_id", "user_id"})
}, indexes = {
    @Index(name = "idx_conv_part_user", columnList = "user_id"),
    @Index(name = "idx_conv_part_conv", columnList = "conversation_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "MEMBER"; // "MEMBER", "ADMIN"

    @Column(name = "last_read_message_id")
    private UUID lastReadMessageId;

    @Column(name = "cleared_at")
    private Instant clearedAt;

    @Column(name = "hidden_at")
    private Instant hiddenAt;

    @Column(name = "is_pinned", nullable = false)
    @Builder.Default
    private boolean pinned = false;

    @Column(name = "pinned_at")
    private Instant pinnedAt;

    @Column(length = 40)
    private String nickname;

    @Column(name = "notifications_muted", nullable = false)
    @Builder.Default
    private boolean notificationsMuted = false;

    @Column(name = "muted_until")
    private Instant mutedUntil;

    @Column(name = "chat_theme", nullable = false, length = 30)
    @Builder.Default
    private String chatTheme = "DEFAULT";

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;
}
