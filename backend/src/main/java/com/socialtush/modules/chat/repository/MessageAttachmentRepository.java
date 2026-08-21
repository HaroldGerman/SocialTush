package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.MessageAttachment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MessageAttachmentRepository extends JpaRepository<MessageAttachment, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select attachment from MessageAttachment attachment join fetch attachment.message message join fetch message.conversation where attachment.id = :id")
    Optional<MessageAttachment> findByIdForUpdate(@Param("id") UUID id);
}