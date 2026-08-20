ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS message_preview VARCHAR(500);
