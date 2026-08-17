package com.socialtush.modules.stories.repository;

import com.socialtush.modules.stories.entity.StoryView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StoryViewRepository extends JpaRepository<StoryView, UUID> {
    boolean existsByStoryIdAndViewerId(UUID storyId, UUID viewerId);
    List<StoryView> findByStoryIdOrderByViewedAtDesc(UUID storyId);
    long countByStoryId(UUID storyId);
}
