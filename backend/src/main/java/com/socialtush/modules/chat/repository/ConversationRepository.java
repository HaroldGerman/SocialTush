package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    
    @Query("SELECT DISTINCT c FROM Conversation c " +
           "JOIN c.participants p " +
           "WHERE p.user = :user " +
           "AND p.hiddenAt IS NULL " +
           "AND (c.isGroup = true OR EXISTS (" +
           "  SELECT m FROM Message m WHERE m.conversation = c " +
           "  AND (p.clearedAt IS NULL OR m.createdAt > p.clearedAt)" +
           ")) " +
           "ORDER BY c.updatedAt DESC")
    List<Conversation> findUserConversations(@Param("user") User user);

    @Query("SELECT c FROM Conversation c WHERE c.isGroup = false AND " +
           "c.id IN (SELECT p1.conversation.id FROM ConversationParticipant p1 WHERE p1.user = :user1) AND " +
           "c.id IN (SELECT p2.conversation.id FROM ConversationParticipant p2 WHERE p2.user = :user2) " +
           "ORDER BY c.updatedAt DESC")
    List<Conversation> findPrivateConversations(@Param("user1") User user1, @Param("user2") User user2);
}
