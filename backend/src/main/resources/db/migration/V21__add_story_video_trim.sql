ALTER TABLE stories
    ADD COLUMN video_trim_start DOUBLE PRECISION NULL,
    ADD COLUMN video_trim_end DOUBLE PRECISION NULL;

ALTER TABLE stories
    ADD CONSTRAINT chk_story_video_trim_range
    CHECK (
        video_trim_start IS NULL
        OR video_trim_end IS NULL
        OR (video_trim_start >= 0 AND video_trim_end > video_trim_start AND video_trim_end - video_trim_start <= 30.5)
    );
