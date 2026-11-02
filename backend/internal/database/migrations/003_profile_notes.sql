CREATE TABLE IF NOT EXISTS profile_notes (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 60),
 visibility VARCHAR(12) NOT NULL CHECK (visibility IN ('public','friends','private')),
 version UUID NOT NULL DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '24 hours')
);
