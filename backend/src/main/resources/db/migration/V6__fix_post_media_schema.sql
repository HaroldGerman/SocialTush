-- V6__fix_post_media_schema.sql
-- Ensure post_media schema matches PostMedia.java entity completely and cleans up legacy columns

-- 1. Ensure required columns exist
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS original_url VARCHAR(512);
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS medium_url VARCHAR(512);
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(512);
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

-- 2. Copy remaining data from media_url / media_order if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_media' AND column_name = 'media_url'
    ) THEN
        UPDATE post_media SET original_url = media_url WHERE (original_url IS NULL OR original_url = '') AND media_url IS NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_media' AND column_name = 'media_order'
    ) THEN
        UPDATE post_media SET display_order = media_order WHERE display_order = 0 AND media_order != 0;
    END IF;
END $$;

-- 3. Set default fallback for original_url and make NOT NULL
UPDATE post_media SET original_url = '' WHERE original_url IS NULL;
ALTER TABLE post_media ALTER COLUMN original_url SET NOT NULL;

-- 4. Safely drop legacy columns media_url and media_order if they still exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_media' AND column_name = 'media_url'
    ) THEN
        ALTER TABLE post_media ALTER COLUMN media_url DROP NOT NULL;
        ALTER TABLE post_media DROP COLUMN IF EXISTS media_url;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_media' AND column_name = 'media_order'
    ) THEN
        ALTER TABLE post_media DROP COLUMN IF EXISTS media_order;
    END IF;
END $$;

-- 5. Ensure index on post_id exists
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
