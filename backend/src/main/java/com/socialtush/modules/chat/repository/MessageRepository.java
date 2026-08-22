package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
    @EntityGraph(attributePaths = {"attachments", "sender"})
    Optional<Message> findFirstByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(UUID conversationId, Instant clearedAt);
    long countByConversationId(UUID conversationId);

    Optional<Message> findFirstByConversationIdAndSenderIdAndMessageTypeAndStoryPreviewId(
            UUID conversationId, UUID senderId, String messageType, UUID storyPreviewId);

    @Query("select count(m) from Message m join m.conversation.participants p " +
            "where m.storyPreviewId = :storyId and p.user.id = :userId " +
            "and m.messageType in ('STORY_REPLY','STORY_REACTION')")
    long countStoryReferencesForParticipant(@Param("storyId") UUID storyId, @Param("userId") UUID userId);

    @EntityGraph(attributePaths = {"attachments", "sender"})
    @Query(value = "select m from Message m where m.conversation.id = :conversationId and m.messageType in ('TEXT','STORY_REPLY') and lower(coalesce(m.content, '')) like lower(concat('%', :content, '%')) and (:clearedAt is null or m.createdAt > :clearedAt) order by m.createdAt desc",
            countQuery = "select count(m) from Message m where m.conversation.id = :conversationId and m.messageType in ('TEXT','STORY_REPLY') and lower(coalesce(m.content, '')) like lower(concat('%', :content, '%')) and (:clearedAt is null or m.createdAt > :clearedAt)")
    Page<Message> searchText(@Param("conversationId") UUID conversationId, @Param("content") String content,
                             @Param("clearedAt") Instant clearedAt, Pageable pageable);

    @Query(value = "select distinct m from Message m join fetch m.attachments a join fetch m.sender where m.conversation.id = :conversationId and (:clearedAt is null or m.createdAt > :clearedAt) order by m.createdAt desc",
            countQuery = "select count(distinct m) from Message m join m.attachments a where m.conversation.id = :conversationId and (:clearedAt is null or m.createdAt > :clearedAt)")
    Page<Message> findMediaByConversationId(@Param("conversationId") UUID conversationId,
                                            @Param("clearedAt") Instant clearedAt, Pageable pageable);
}
