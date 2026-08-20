package com.socialtush.modules.stories.service;

import com.socialtush.modules.stories.entity.Story;
import com.socialtush.modules.stories.entity.StoryReaction;
import com.socialtush.modules.stories.entity.StoryView;
import com.socialtush.modules.stories.repository.StoryReactionRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.stories.repository.StoryViewRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StoryService {

    private final StoryRepository storyRepository;
    private final StoryViewRepository storyViewRepository;
    private final StoryReactionRepository storyReactionRepository;
    private final ChatService chatService;

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
        if (story == null || user == null || story.getExpiresAt() == null || !story.getExpiresAt().isAfter(java.time.Instant.now())
                || story.getUser().getId().equals(user.getId())) return false;

        StoryReaction existing = storyReactionRepository.findByStoryIdAndUserId(storyId, user.getId()).orElse(null);
        String normalizedType = reactionType != null && !reactionType.isBlank() ? reactionType.toUpperCase() : "HEART";
        StoryReaction reaction = Optional.ofNullable(existing)
                .orElse(StoryReaction.builder()
                        .story(story)
                        .user(user)
                        .build());
        boolean changed = existing == null || !normalizedType.equalsIgnoreCase(existing.getReactionType());
        reaction.setReactionType(normalizedType);
        storyReactionRepository.save(reaction);
        if (changed) {
            chatService.recordStoryReaction(user, story.getUser(), story.getId(), reactionEmoji(normalizedType));
        }
        return true;
    }

    private String reactionEmoji(String value) {
        return switch (value) {
            case "HEART", "LIKE" -> "❤️";
            case "LAUGH" -> "😂";
            case "WOW" -> "😮";
            case "SAD" -> "😢";
            case "FIRE" -> "🔥";
            case "THUMBS_UP" -> "👍";
            default -> value;
        };
    }

    @Transactional(readOnly = true)
    public List<StoryView> getStoryViewers(UUID storyId, User owner) {
        Story story = storyRepository.findById(storyId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Momento no encontrado"));
        if (owner == null || !story.getUser().getId().equals(owner.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Solo el propietario puede ver las vistas");
        }
        return storyViewRepository.findByStoryIdOrderByViewedAtDesc(storyId);
    }
}
