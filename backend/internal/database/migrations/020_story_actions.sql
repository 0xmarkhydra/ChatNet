CREATE TABLE IF NOT EXISTS story_likes (
    story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_likes_user_id_idx ON story_likes (user_id);

ALTER TABLE stories ADD COLUMN IF NOT EXISTS highlight_title TEXT;

CREATE INDEX IF NOT EXISTS stories_highlights_by_owner_idx
    ON stories (user_id, created_at DESC, id DESC)
    WHERE highlight_title IS NOT NULL;
