package com.socialtush.modules.comments.repository;

import com.socialtush.modules.comments.entity.CommentResonance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

public interface CommentResonanceRepository extends JpaRepository<CommentResonance, UUID> {
    long countByCommentId(UUID commentId);
    boolean existsByCommentIdAndUserId(UUID commentId, UUID userId);

    @Transactional
    void deleteByCommentIdAndUserId(UUID commentId, UUID userId);
}
