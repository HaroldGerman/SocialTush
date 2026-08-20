package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.MessageReaction;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, UUID> {
    Optional<MessageReaction> findByMessageIdAndUserId(UUID messageId, UUID userId);

    @EntityGraph(attributePaths = "user")
    List<MessageReaction> findByMessageIdIn(Collection<UUID> messageIds);
}
