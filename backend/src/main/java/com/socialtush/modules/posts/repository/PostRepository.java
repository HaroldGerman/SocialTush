package com.socialtush.modules.posts.repository;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PostRepository extends JpaRepository<Post, UUID> {
    Page<Post> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);
    
    @Query("SELECT p FROM Post p WHERE p.user IN :users OR p.user = :currentUser ORDER BY p.createdAt DESC")
    Page<Post> findFeedPosts(List<User> users, User currentUser, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.isShortVideo = :isShortVideo ORDER BY p.createdAt DESC")
    Page<Post> findExplorePosts(boolean isShortVideo, Pageable pageable);
}
