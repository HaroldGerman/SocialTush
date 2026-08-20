-- Existing accounts predate mandatory email verification. Grandfather them so the rollout
-- does not lock current Lifonk users out. New registrations remain unverified until the link is used.
UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE;

CREATE TABLE IF NOT EXISTS account_action_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(32) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_action_tokens_user_purpose
    ON account_action_tokens(user_id, purpose);

CREATE INDEX IF NOT EXISTS idx_account_action_tokens_expires_at
    ON account_action_tokens(expires_at);
