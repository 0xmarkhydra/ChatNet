-- One row per viewer: viewed_at is the first time they saw the story.
CREATE TABLE IF NOT EXISTS story_views (
    story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_views_user_id_idx ON story_views (user_id);
