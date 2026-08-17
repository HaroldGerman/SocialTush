package com.socialtush.modules.posts.repository;

import com.socialtush.modules.posts.entity.SavedPost;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SavedPostRepository extends JpaRepository<SavedPost, UUID> {
    boolean existsByUserAndPostId(User user, UUID postId);
    Optional<SavedPost> findByUserAndPostId(User user, UUID postId);
    List<SavedPost> findByUserOrderByCreatedAtDesc(User user);
}
