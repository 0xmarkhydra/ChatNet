-- Existing likes become the Like reaction; preserve post_likes and likes_count.
ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS emoji VARCHAR(16) NOT NULL DEFAULT '👍';
