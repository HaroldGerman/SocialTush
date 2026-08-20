package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {
    List<Message> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);
    @EntityGraph(attributePaths = {"attachments", "sender"})
    Page<Message> findByConversationIdOrderByCreatedAtDesc(UUID conversationId, Pageable pageable);
    @EntityGraph(attributePaths = {"attachments", "sender"})
    Page<Message> findByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(UUID conversationId, Instant clearedAt, Pageable pageable);
    @EntityGraph(attributePaths = {"attachments", "sender"})
    Optional<Message> findFirstByConversationIdOrderByCreatedAtDesc(UUID conversationId);
    long countByConversationId(UUID conversationId);
}
