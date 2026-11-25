CREATE TABLE IF NOT EXISTS story_media_cleanup (
    id BIGSERIAL PRIMARY KEY,
    storage_ref TEXT NOT NULL UNIQUE,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_media_cleanup_ready_idx
ON story_media_cleanup(available_at, id);
