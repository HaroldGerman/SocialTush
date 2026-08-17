package com.socialtush.modules.stories.service;

import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.stories.entity.StoryReaction;
import com.socialtush.modules.stories.entity.StoryView;
import com.socialtush.modules.stories.repository.StoryReactionRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.stories.repository.StoryViewRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StoryService {

    private final StoryRepository storyRepository;
    private final StoryViewRepository storyViewRepository;
    private final StoryReactionRepository storyReactionRepository;

    @Transactional
    public boolean recordView(UUID storyId, User viewer) {
        Story story = storyRepository.findById(storyId).orElse(null);
        if (story == null || viewer == null) return false;

        if (storyViewRepository.existsByStoryIdAndViewerId(storyId, viewer.getId())) {
            return true;
        }

        StoryView view = StoryView.builder()
                .story(story)
                .viewer(viewer)
                .build();
        storyViewRepository.save(view);
        return true;
    }

    @Transactional
    public boolean recordReaction(UUID storyId, User user, String reactionType) {
        Story story = storyRepository.findById(storyId).orElse(null);
        if (story == null || user == null) return false;

        StoryReaction reaction = storyReactionRepository.findByStoryIdAndUserId(storyId, user.getId())
                .orElse(StoryReaction.builder()
                        .story(story)
                        .user(user)
                        .build());
        reaction.setReactionType(reactionType != null ? reactionType.toUpperCase() : "HEART");
        storyReactionRepository.save(reaction);
        return true;
    }

    public List<StoryView> getStoryViewers(UUID storyId) {
        return storyViewRepository.findByStoryIdOrderByViewedAtDesc(storyId);
    }
}
