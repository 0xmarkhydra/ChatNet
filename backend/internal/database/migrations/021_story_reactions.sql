-- Story hearts become reactions; existing rows keep showing as a heart.
ALTER TABLE story_likes ADD COLUMN IF NOT EXISTS emoji VARCHAR(16) NOT NULL DEFAULT '❤️';
