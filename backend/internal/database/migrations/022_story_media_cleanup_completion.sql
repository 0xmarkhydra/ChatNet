ALTER TABLE story_media_cleanup
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
