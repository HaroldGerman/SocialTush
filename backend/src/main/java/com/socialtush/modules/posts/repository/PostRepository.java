package com.socialtush.modules.posts.repository;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PostRepository extends JpaRepository<Post, UUID> {
    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.user = :user AND (c IS NULL OR c.visibility = 'PUBLIC') ORDER BY p.createdAt DESC")
    Page<Post> findPublicProfilePosts(User user, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.user = :user AND (c IS NULL OR c.visibility = 'PUBLIC' OR EXISTS (SELECT cm FROM CircleMember cm WHERE cm.circle = c AND cm.user.id = :viewerId)) ORDER BY p.createdAt DESC")
    Page<Post> findProfilePostsVisibleTo(User user, UUID viewerId, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE (p.user = :currentUser OR EXISTS (SELECT f FROM Follow f WHERE f.follower = :currentUser AND f.following = p.user)) AND (c IS NULL OR c.visibility = 'PUBLIC' OR EXISTS (SELECT cm FROM CircleMember cm WHERE cm.circle = c AND cm.user = :currentUser)) ORDER BY p.createdAt DESC")
    Page<Post> findFeedPostsNew(User currentUser, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.isShortVideo = :isShortVideo AND (c IS NULL OR c.visibility = 'PUBLIC') ORDER BY p.createdAt DESC")
    Page<Post> findPublicExplorePosts(boolean isShortVideo, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.isShortVideo = :isShortVideo AND (c IS NULL OR c.visibility = 'PUBLIC' OR EXISTS (SELECT cm FROM CircleMember cm WHERE cm.circle = c AND cm.user.id = :viewerId)) ORDER BY p.createdAt DESC")
    Page<Post> findExplorePostsVisibleTo(boolean isShortVideo, UUID viewerId, Pageable pageable);

    Page<Post> findByCircleIdOrderByCreatedAtDesc(UUID circleId, Pageable pageable);
}
