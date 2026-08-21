package com.socialtush.modules.posts.repository;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PostRepository extends JpaRepository<Post, UUID> {
    long countByUser(User user);

    List<Post> findByUserAndFeaturedPositionIsNotNullOrderByFeaturedPositionAsc(User user);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.user = :user AND (c IS NULL OR c.visibility = 'PUBLIC') ORDER BY CASE WHEN p.featuredPosition IS NULL THEN 1 ELSE 0 END, p.featuredPosition ASC, p.createdAt DESC")
    Page<Post> findPublicProfilePosts(User user, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.user = :user AND (c IS NULL OR c.visibility = 'PUBLIC' OR EXISTS (SELECT cm FROM CircleMember cm WHERE cm.circle = c AND cm.user.id = :viewerId)) ORDER BY CASE WHEN p.featuredPosition IS NULL THEN 1 ELSE 0 END, p.featuredPosition ASC, p.createdAt DESC")
    Page<Post> findProfilePostsVisibleTo(User user, UUID viewerId, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE (p.user = :currentUser OR EXISTS (SELECT f FROM Follow f WHERE f.follower = :currentUser AND f.following = p.user)) AND (c IS NULL OR c.visibility = 'PUBLIC' OR EXISTS (SELECT cm FROM CircleMember cm WHERE cm.circle = c AND cm.user = :currentUser)) ORDER BY p.createdAt DESC")
    Page<Post> findFeedPostsNew(User currentUser, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.isShortVideo = :isShortVideo AND (c IS NULL OR c.visibility = 'PUBLIC') ORDER BY p.pulseCompletions DESC, p.pulseWatchMillis DESC, p.pulseShares DESC, p.pulseViews DESC, p.createdAt DESC")
    Page<Post> findPublicExplorePosts(boolean isShortVideo, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN p.circle c WHERE p.isShortVideo = :isShortVideo AND (c IS NULL OR c.visibility = 'PUBLIC' OR EXISTS (SELECT cm FROM CircleMember cm WHERE cm.circle = c AND cm.user.id = :viewerId)) ORDER BY p.pulseCompletions DESC, p.pulseWatchMillis DESC, p.pulseShares DESC, p.pulseViews DESC, p.createdAt DESC")
    Page<Post> findExplorePostsVisibleTo(boolean isShortVideo, UUID viewerId, Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.pulseViews = p.pulseViews + 1, p.pulseWatchMillis = p.pulseWatchMillis + :watchMillis, p.pulseCompletions = p.pulseCompletions + :completionIncrement WHERE p.id = :postId AND p.isShortVideo = true")
    int incrementPulseView(@Param("postId") UUID postId,
                           @Param("watchMillis") long watchMillis,
                           @Param("completionIncrement") long completionIncrement);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Post p SET p.pulseShares = p.pulseShares + 1 WHERE p.id = :postId AND p.isShortVideo = true")
    int incrementPulseShare(@Param("postId") UUID postId);

    Page<Post> findByCircleIdOrderByCreatedAtDesc(UUID circleId, Pageable pageable);
}
