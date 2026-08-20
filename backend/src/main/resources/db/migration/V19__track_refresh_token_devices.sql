ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_key UUID;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_id VARCHAR(128);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_label VARCHAR(160);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active_expires
    ON refresh_tokens(user_id, is_revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_key
    ON refresh_tokens(session_key);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id
    ON refresh_tokens(user_id, device_id);
