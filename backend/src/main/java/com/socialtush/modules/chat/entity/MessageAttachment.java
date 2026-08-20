package com.socialtush.modules.chat.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "message_attachments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @Column(name = "file_url", nullable = false, length = 512)
    private String fileUrl;

    @Column(name = "file_type", nullable = false, length = 50)
    private String fileType; // "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER", "GIF"

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Builder.Default
    @Column(name = "view_once", nullable = false)
    private boolean viewOnce = false;

    @Column(name = "viewed_at")
    private Instant viewedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /**
     * Regular chat DTOs call this getter. Never leak the backing object URL for
     * one-time media through history, search, websocket replay or media lists.
     */
    public String getFileUrl() {
        return viewOnce ? "" : fileUrl;
    }

    /** Internal-only accessor used by the consume endpoint after authorization. */
    public String getStoredFileUrl() {
        return fileUrl;
    }

    /** Makes old DTOs understand the attachment without changing every response class. */
    public String getFileType() {
        return viewOnce ? "VIEW_ONCE_IMAGE" : fileType;
    }

    public String getStoredFileType() {
        return fileType;
    }
}