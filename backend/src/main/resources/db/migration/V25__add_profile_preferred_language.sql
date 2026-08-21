ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'es';

UPDATE profiles
SET preferred_language = 'es'
WHERE preferred_language IS NULL OR preferred_language NOT IN ('es', 'en');

ALTER TABLE profiles
    ADD CONSTRAINT chk_profiles_preferred_language CHECK (preferred_language IN ('es', 'en'));
