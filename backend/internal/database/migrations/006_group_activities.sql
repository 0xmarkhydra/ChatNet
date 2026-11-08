-- Group collaboration records are append-only except each member's vote.
CREATE TABLE IF NOT EXISTS group_activities (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  creator_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kind VARCHAR(12) NOT NULL CHECK (kind IN ('poll','note','reminder')),
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  body TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_group_activities_recent ON group_activities(conversation_id,id DESC);

CREATE TABLE IF NOT EXISTS group_activity_votes (
  activity_id BIGINT NOT NULL REFERENCES group_activities(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index SMALLINT NOT NULL CHECK (option_index >= 0 AND option_index < 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_activity_vote_counts ON group_activity_votes(activity_id,option_index);

CREATE TABLE IF NOT EXISTS group_activity_events (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  activity_id BIGINT NOT NULL,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('created','voted','vote_changed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (activity_id,conversation_id) REFERENCES group_activities(id,conversation_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_group_activity_events_recent ON group_activity_events(conversation_id,id DESC);
