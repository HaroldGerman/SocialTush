ALTER TABLE conversation_participants
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(40),
    ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS chat_theme VARCHAR(30) NOT NULL DEFAULT 'DEFAULT';

CREATE INDEX IF NOT EXISTS idx_conv_part_user_pinned
    ON conversation_participants(user_id, is_pinned, pinned_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
    ON message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC);

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
