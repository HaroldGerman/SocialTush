package com.socialtush.modules.stories.repository;

import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface StoryRepository extends JpaRepository<Story, UUID> {
    long countByExpiresAtAfter(Instant now);
    long countByUserAndExpiresAtAfter(User user, Instant now);
    List<Story> findByUserAndExpiresAtAfterOrderByCreatedAtAsc(User user, Instant now);
    List<Story> findByExpiresAtAfterOrderByCreatedAtAsc(Instant now);

    @Query("SELECT s FROM Story s WHERE (s.user IN :users OR s.user = :currentUser) AND s.expiresAt > :now ORDER BY s.createdAt ASC")
    List<Story> findActiveStories(List<User> users, User currentUser, Instant now);
}
