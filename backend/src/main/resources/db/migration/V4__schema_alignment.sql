-- V4__schema_alignment.sql: Align database schema with JPA Entities for Hibernate validation

-- 1. Comments: parent_id, indices
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- 2. Conversations: created_by
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Conversation Participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    last_read_message_id UUID,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uc_conversation_user UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_part_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_part_conv ON conversation_participants(conversation_id);

-- 4. Messages: parent_id, message_type, is_edited, is_deleted, story_preview_id, post_share_id, updated_at
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS story_preview_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS post_share_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 5. Message Attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_url VARCHAR(512) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    file_size BIGINT,
    duration_seconds INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Message Reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uc_message_user_reaction UNIQUE (message_id, user_id)
);

-- 7. Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL UNIQUE,
    platform VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- 8. Saved Posts table
CREATE TABLE IF NOT EXISTS saved_posts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uc_user_post_saved UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id);

-- 9. Refresh Tokens: expires_at
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'expiry_date'
    ) THEN
        UPDATE refresh_tokens SET expires_at = expiry_date WHERE expires_at IS NULL AND expiry_date IS NOT NULL;
    END IF;
END $$;
UPDATE refresh_tokens SET expires_at = CURRENT_TIMESTAMP WHERE expires_at IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN expires_at SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- 10. Notifications: receiver_id, sender_id, notification_type, target_id
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'recipient_id'
    ) THEN
        UPDATE notifications SET receiver_id = recipient_id WHERE receiver_id IS NULL AND recipient_id IS NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'actor_id'
    ) THEN
        UPDATE notifications SET sender_id = actor_id WHERE sender_id IS NULL AND actor_id IS NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'type'
    ) THEN
        UPDATE notifications SET notification_type = type WHERE notification_type IS NULL AND type IS NOT NULL;
    END IF;
END $$;
UPDATE notifications SET notification_type = 'SYSTEM' WHERE notification_type IS NULL;
ALTER TABLE notifications ALTER COLUMN receiver_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN notification_type SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'target_id' AND data_type LIKE '%char%'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN target_id TYPE UUID USING target_id::uuid;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_receiver ON notifications(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 11. Posts: music_url, indices
ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_url VARCHAR(512);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- 12. Post Media: original_url, medium_url, thumbnail_url, duration_seconds, display_order, index
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS original_url VARCHAR(512);
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS medium_url VARCHAR(512);
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(512);
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_media' AND column_name = 'media_url'
    ) THEN
        UPDATE post_media SET original_url = media_url WHERE original_url IS NULL AND media_url IS NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_media' AND column_name = 'media_order'
    ) THEN
        UPDATE post_media SET display_order = media_order WHERE display_order = 0 AND media_order != 0;
    END IF;
END $$;

UPDATE post_media SET original_url = '' WHERE original_url IS NULL;
ALTER TABLE post_media ALTER COLUMN original_url SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);

-- 13. Profiles: read_receipts_enabled
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'read_receiptsenabled'
    ) THEN
        UPDATE profiles SET read_receipts_enabled = "read_receiptsenabled";
    END IF;
END $$;

-- 14. Follow Requests: sender_id, receiver_id
ALTER TABLE follow_requests ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE follow_requests ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES users(id) ON DELETE CASCADE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follow_requests' AND column_name = 'requester_id'
    ) THEN
        UPDATE follow_requests SET sender_id = requester_id WHERE sender_id IS NULL AND requester_id IS NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follow_requests' AND column_name = 'target_id'
    ) THEN
        UPDATE follow_requests SET receiver_id = target_id WHERE receiver_id IS NULL AND target_id IS NOT NULL;
    END IF;
END $$;
ALTER TABLE follow_requests ALTER COLUMN sender_id SET NOT NULL;
ALTER TABLE follow_requests ALTER COLUMN receiver_id SET NOT NULL;

ALTER TABLE follow_requests DROP CONSTRAINT IF EXISTS uc_sender_receiver;
ALTER TABLE follow_requests ADD CONSTRAINT uc_sender_receiver UNIQUE (sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_follow_req_receiver ON follow_requests(receiver_id);

-- 15. Stories: music_url, index
ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_url VARCHAR(512);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);

-- 16. Likes: target_id, target_type
ALTER TABLE likes ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE likes ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) NOT NULL DEFAULT 'POST';
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'likes' AND column_name = 'post_id'
    ) THEN
        UPDATE likes SET target_id = post_id WHERE target_id IS NULL AND post_id IS NOT NULL;
    END IF;
END $$;
ALTER TABLE likes ALTER COLUMN target_id SET NOT NULL;

ALTER TABLE likes DROP CONSTRAINT IF EXISTS uc_user_target;
ALTER TABLE likes ADD CONSTRAINT uc_user_target UNIQUE (user_id, target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_id, target_type);

-- 17. Users: indices
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
