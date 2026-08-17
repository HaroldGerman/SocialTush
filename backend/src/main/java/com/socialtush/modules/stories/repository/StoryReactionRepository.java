package com.socialtush.modules.stories.repository;

import com.socialtush.modules.stories.entity.StoryReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StoryReactionRepository extends JpaRepository<StoryReaction, UUID> {
    Optional<StoryReaction> findByStoryIdAndUserId(UUID storyId, UUID userId);
    List<StoryReaction> findByStoryId(UUID storyId);
    long countByStoryId(UUID storyId);
}
