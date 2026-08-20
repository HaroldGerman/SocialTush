ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.auth_version IS 'Incremented to invalidate all previously issued JWT access tokens.';
