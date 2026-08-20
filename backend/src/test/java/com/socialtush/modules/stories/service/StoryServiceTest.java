package com.socialtush.modules.stories.service;

import com.socialtush.modules.notifications.service.NotificationService;
import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.stories.entity.StoryReaction;
import com.socialtush.modules.stories.repository.StoryReactionRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.stories.repository.StoryViewRepository;
import com.socialtush.modules.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StoryServiceTest {
    @Mock StoryRepository stories;
    @Mock StoryViewRepository views;
    @Mock StoryReactionRepository reactions;
    @Mock NotificationService notifications;
    StoryService service;
    User owner;
    User viewer;
    Story story;

    @BeforeEach
    void setUp() {
        service = new StoryService(stories, views, reactions, notifications);
        owner = User.builder().id(UUID.randomUUID()).username("owner").email("owner@test.local").passwordHash("x").build();
        viewer = User.builder().id(UUID.randomUUID()).username("viewer").email("viewer@test.local").passwordHash("x").build();
        story = Story.builder().id(UUID.randomUUID()).user(owner).mediaType("TEXT").expiresAt(java.time.Instant.now().plusSeconds(3600)).build();
        when(stories.findById(story.getId())).thenReturn(Optional.of(story));
        when(reactions.findByStoryIdAndUserId(story.getId(), viewer.getId())).thenReturn(Optional.empty());
    }

    @Test
    void newReactionCreatesSignalForStoryOwner() {
        service.recordReaction(story.getId(), viewer, "HEART");

        verify(reactions).save(any(StoryReaction.class));
        verify(notifications).createNotification(owner, viewer, "STORY_REACTION", story.getId(), "HEART");
    }

    @Test
    void repeatingSameReactionDoesNotSpamSignals() {
        StoryReaction existing = StoryReaction.builder().story(story).user(viewer).reactionType("HEART").build();
        when(reactions.findByStoryIdAndUserId(story.getId(), viewer.getId())).thenReturn(Optional.of(existing));

        service.recordReaction(story.getId(), viewer, "heart");

        verify(reactions).save(existing);
        verifyNoInteractions(notifications);
    }
}
