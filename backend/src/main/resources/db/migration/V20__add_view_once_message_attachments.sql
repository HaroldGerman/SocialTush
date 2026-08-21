ALTER TABLE message_attachments
    ADD COLUMN view_once BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN viewed_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX idx_message_attachments_view_once
    ON message_attachments (message_id, view_once);
