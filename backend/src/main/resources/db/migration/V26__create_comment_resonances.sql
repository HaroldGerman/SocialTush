CREATE TABLE IF NOT EXISTS comment_resonances (
    id UUID PRIMARY KEY,
    comment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_comment_resonances_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_resonances_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_comment_resonances_comment_user UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_resonances_comment_id ON comment_resonances(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_resonances_user_id ON comment_resonances(user_id);
