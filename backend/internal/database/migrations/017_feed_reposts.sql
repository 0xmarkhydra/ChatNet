ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_of BIGINT REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_kind TEXT
    CONSTRAINT posts_repost_kind_valid CHECK (
        (repost_of IS NULL AND repost_kind IS NULL) OR
        (repost_of IS NOT NULL AND repost_kind IS NOT NULL AND repost_kind IN ('quick', 'quote'))
    );
CREATE UNIQUE INDEX IF NOT EXISTS posts_one_quick_repost
    ON posts(repost_of,user_id) WHERE repost_kind='quick';
CREATE INDEX IF NOT EXISTS posts_repost_source ON posts(repost_of) WHERE repost_of IS NOT NULL;

ALTER TABLE post_mentions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'mention'
    CHECK (kind IN ('mention', 'repost', 'quote'));
