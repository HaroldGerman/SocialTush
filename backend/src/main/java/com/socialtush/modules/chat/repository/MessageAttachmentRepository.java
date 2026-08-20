package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.MessageAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MessageAttachmentRepository extends JpaRepository<MessageAttachment, UUID> {
}
