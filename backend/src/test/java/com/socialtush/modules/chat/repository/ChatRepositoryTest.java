package com.socialtush.modules.chat.repository;

import com.socialtush.modules.chat.entity.Conversation;
import com.socialtush.modules.chat.entity.ConversationParticipant;
import com.socialtush.modules.chat.entity.Message;
import com.socialtush.modules.chat.entity.MessageAttachment;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class ChatRepositoryTest {
    @Autowired ConversationRepository conversations;
    @Autowired ConversationParticipantRepository participants;
    @Autowired MessageRepository messages;
    @Autowired MessageAttachmentRepository attachments;
    @Autowired UserRepository users;

    @Test
    void emptyPrivateConversationDoesNotAppearButEmptyGroupCanAppear() {
        User a = user("empty_a");
        Conversation privateChat = conversation(a, false);
        participants.save(participant(privateChat, a));
        Conversation group = conversation(a, true);
        participants.save(participant(group, a));

        assertThat(conversations.findUserConversations(a)).containsExactly(group);
    }

    @Test
    void clearedParticipantOnlyReadsNewMessagesWhileOtherParticipantKeepsFullHistory() {
        User a = user("history_a");
        User b = user("history_b");
        Conversation conversation = conversation(a, false);
        ConversationParticipant partA = participants.save(participant(conversation, a));
        participants.save(participant(conversation, b));
        Message oldMedia = messages.saveAndFlush(Message.builder().conversation(conversation).sender(b).content("").messageType("IMAGE").build());
        attachments.saveAndFlush(MessageAttachment.builder().message(oldMedia).fileUrl("https://cdn/old.jpg")
                .fileType("IMAGE").fileName("old.jpg").fileSize(10L).build());
        Instant cutoff = Instant.now();
        partA.setClearedAt(cutoff);
        participants.saveAndFlush(partA);
        messages.saveAndFlush(Message.builder().conversation(conversation).sender(b).content("nuevo").build());

        assertThat(messages.findByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(conversation.getId(), cutoff, PageRequest.of(0, 30)))
                .extracting(Message::getContent).containsExactly("nuevo");
        assertThat(messages.findByConversationIdOrderByCreatedAtDesc(conversation.getId(), PageRequest.of(0, 30)))
                .hasSize(2)
                .anySatisfy(message -> {
                    if (message.getId().equals(oldMedia.getId())) {
                        assertThat(message.getAttachments()).singleElement()
                                .extracting(MessageAttachment::getFileUrl).isEqualTo("https://cdn/old.jpg");
                    }
                });
    }

    private User user(String username) {
        return users.save(User.builder().username(username).email(username + "@test.local").passwordHash("hash").build());
    }

    private Conversation conversation(User creator, boolean group) {
        return conversations.save(Conversation.builder().isGroup(group).name(group ? "Grupo" : null).createdBy(creator).build());
    }

    private ConversationParticipant participant(Conversation conversation, User user) {
        return ConversationParticipant.builder().conversation(conversation).user(user).role("MEMBER").build();
    }
}
