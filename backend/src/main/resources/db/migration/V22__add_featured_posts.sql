ALTER TABLE posts
    ADD COLUMN featured_position INTEGER NULL;

ALTER TABLE posts
    ADD CONSTRAINT chk_posts_featured_position
    CHECK (featured_position IS NULL OR (featured_position >= 1 AND featured_position <= 3));

CREATE INDEX idx_posts_user_featured_position
    ON posts(user_id, featured_position)
    WHERE featured_position IS NOT NULL;
