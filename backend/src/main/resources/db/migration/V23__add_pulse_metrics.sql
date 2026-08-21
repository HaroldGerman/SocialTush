ALTER TABLE posts
    ADD COLUMN pulse_views BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN pulse_watch_millis BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN pulse_completions BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN pulse_shares BIGINT NOT NULL DEFAULT 0;

CREATE INDEX idx_posts_pulse_discovery
    ON posts(is_short_video, pulse_views, pulse_completions, created_at DESC)
    WHERE is_short_video = TRUE;
