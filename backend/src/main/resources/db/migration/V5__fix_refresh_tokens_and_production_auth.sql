-- V5__fix_refresh_tokens_and_production_auth.sql
-- Fix legacy NOT NULL constraints and align database tables with JPA Entities

-- 1. Refresh Tokens: Drop legacy columns expiry_date and is_expired
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refresh_tokens' AND column_name = 'expiry_date'
    ) THEN
        UPDATE refresh_tokens SET expires_at = expiry_date WHERE expires_at IS NULL AND expiry_date IS NOT NULL;
    END IF;
END $$;
UPDATE refresh_tokens SET expires_at = CURRENT_TIMESTAMP WHERE expires_at IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS expiry_date;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS is_expired;

-- 2. Notifications: Drop legacy columns recipient_id, actor_id, type, title, body
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN recipient_id DROP NOT NULL;
        ALTER TABLE notifications DROP COLUMN IF EXISTS recipient_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'actor_id'
    ) THEN
        ALTER TABLE notifications DROP COLUMN IF EXISTS actor_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'type'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL;
        ALTER TABLE notifications DROP COLUMN IF EXISTS type;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'title'
    ) THEN
        ALTER TABLE notifications DROP COLUMN IF EXISTS title;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'body'
    ) THEN
        ALTER TABLE notifications DROP COLUMN IF EXISTS body;
    END IF;
END $$;

-- 3. Follow Requests: Drop legacy columns requester_id, target_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follow_requests' AND column_name = 'requester_id'
    ) THEN
        ALTER TABLE follow_requests ALTER COLUMN requester_id DROP NOT NULL;
        ALTER TABLE follow_requests DROP COLUMN IF EXISTS requester_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follow_requests' AND column_name = 'target_id'
    ) THEN
        ALTER TABLE follow_requests ALTER COLUMN target_id DROP NOT NULL;
        ALTER TABLE follow_requests DROP COLUMN IF EXISTS target_id;
    END IF;
END $$;

-- 4. Post Media: Drop legacy columns media_url, media_order
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

-- 5. Profiles: Drop legacy column read_receiptsEnabled
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'read_receiptsenabled'
    ) THEN
        ALTER TABLE profiles DROP COLUMN IF EXISTS "read_receiptsenabled";
    END IF;
END $$;

-- 6. Likes: Drop legacy column post_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'likes' AND column_name = 'post_id'
    ) THEN
        ALTER TABLE likes ALTER COLUMN post_id DROP NOT NULL;
        ALTER TABLE likes DROP COLUMN IF EXISTS post_id;
    END IF;
END $$;
