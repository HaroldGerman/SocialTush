package com.socialtush.modules.comments.repository;

import com.socialtush.modules.comments.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CommentRepository extends JpaRepository<Comment, UUID> {
    List<Comment> findByPostIdAndParentIsNullOrderByCreatedAtAsc(UUID postId);
    List<Comment> findByParentIdOrderByCreatedAtAsc(UUID parentId);
    long countByPostId(UUID postId);
}
