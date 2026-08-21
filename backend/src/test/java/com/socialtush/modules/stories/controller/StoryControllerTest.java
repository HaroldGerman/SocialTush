package com.socialtush.modules.stories.controller;

import com.socialtush.modules.media.service.StorageService;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.entity.Follow;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.stories.entity.StoryReaction;
import com.socialtush.modules.stories.entity.StoryView;
import com.socialtush.modules.stories.repository.StoryReactionRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.stories.repository.StoryViewRepository;
import com.socialtush.modules.stories.service.StoryService;
import com.socialtush.modules.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StoryControllerTest {
    @Mock StoryRepository storyRepository;
    @Mock FollowRepository followRepository;
    @Mock ProfileRepository profileRepository;
    @Mock StorageService storageService;
    @Mock StoryService storyService;
    @Mock StoryReactionRepository storyReactionRepository;
    @Mock StoryViewRepository storyViewRepository;

    private StoryController controller;
    private User owner;

    @BeforeEach
    void setUp() {
        controller = new StoryController(
                storyRepository,
                followRepository,
                profileRepository,
                storageService,
                storyService,
                storyReactionRepository,
                storyViewRepository
        );
        ReflectionTestUtils.setField(controller, "storagePublicUrl", "https://media.socialtush.test");
        owner = user("owner");
    }

    @Test
    void ownStoryCanBeDeletedAndOwnedMediaIsRemoved() {
        UUID id = UUID.randomUUID();
        Story story = story(id, owner, "https://media.socialtush.test/stories/photo.jpg");
        when(storyRepository.findById(id)).thenReturn(Optional.of(story));

        var response = controller.deleteStory(id, owner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(storageService).deleteFile("stories/photo.jpg");
        verify(storyRepository).delete(story);
    }

    @Test
    void anotherUsersStoryCannotBeDeleted() {
        UUID id = UUID.randomUUID();
        Story story = story(id, user("other"), "https://external.test/image.jpg");
        when(storyRepository.findById(id)).thenReturn(Optional.of(story));

        var response = controller.deleteStory(id, owner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(storageService);
        verify(storyRepository, never()).delete(any());
    }

    @Test
    void activeStoriesWithoutFollowingsReturnsOnlyOwnStories() {
        Story ownStory = story(UUID.randomUUID(), owner, null);
        when(followRepository.findByFollower(owner)).thenReturn(List.of());
        when(storyRepository.findByUserAndExpiresAtAfterOrderByCreatedAtAsc(eq(owner), any())).thenReturn(List.of(ownStory));

        var response = controller.getActiveStories(owner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(storyRepository, never()).findByExpiresAtAfterOrderByCreatedAtAsc(any());
        verify(storyRepository, never()).findActiveStories(any(), any(), any());
    }

    @Test
    void activeStoriesWithFollowingsUsesRestrictedQuery() {
        User followed = user("followed");
        Follow follow = Follow.builder().follower(owner).following(followed).build();
        when(followRepository.findByFollower(owner)).thenReturn(List.of(follow));
        when(storyRepository.findActiveStories(any(), eq(owner), any())).thenReturn(List.of());

        controller.getActiveStories(owner);

        verify(storyRepository).findActiveStories(argThat(users -> users.equals(List.of(followed))), eq(owner), any());
        verify(storyRepository, never()).findByExpiresAtAfterOrderByCreatedAtAsc(any());
    }

    @Test
    void onlyOwnerCanRequestStoryViewers() {
        UUID id = UUID.randomUUID();
        when(storyService.getStoryViewers(id, owner))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("Solo el propietario puede ver las vistas"));

        var response = controller.getStoryViewers(id, owner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void missingStoryViewersReturnsNotFound() {
        UUID id = UUID.randomUUID();
        when(storyService.getStoryViewers(id, owner))
                .thenThrow(new jakarta.persistence.EntityNotFoundException("Momento no encontrado"));

        var response = controller.getStoryViewers(id, owner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void viewersIncludeTheirResonanceWhenPresent() {
        UUID id = UUID.randomUUID();
        User viewer = user("viewer");
        Story moment = story(id, owner, null);
        StoryView view = StoryView.builder().story(moment).viewer(viewer).viewedAt(Instant.now()).build();
        StoryReaction resonance = StoryReaction.builder().story(moment).user(viewer).reactionType("FIRE").createdAt(Instant.now()).build();
        when(storyService.getStoryViewers(id, owner)).thenReturn(List.of(view));
        when(storyReactionRepository.findByStoryId(id)).thenReturn(List.of(resonance));
        when(profileRepository.findAllById(any())).thenReturn(List.of());

        var response = controller.getStoryViewers(id, owner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        var body = (List<java.util.Map<String, Object>>) response.getBody();
        assertThat(body).hasSize(1);
        assertThat(body.get(0).get("username")).isEqualTo("viewer");
        assertThat(body.get(0).get("resonance")).isEqualTo("🔥");
    }

    private User user(String username) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        return user;
    }

    private Story story(UUID id, User user, String mediaUrl) {
        return Story.builder().id(id).user(user).mediaType(mediaUrl == null ? "TEXT" : "IMAGE")
                .mediaUrl(mediaUrl).textContent("story").backgroundColor("#123456")
                .createdAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }
}
