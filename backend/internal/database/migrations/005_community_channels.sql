-- Additive community functionality; legacy group conversations and their messages
-- remain private and continue to belong to the default/general channel (NULL).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_description VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_topic VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_rules VARCHAR(5000) NOT NULL DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_visibility VARCHAR(10) NOT NULL DEFAULT 'private';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversations_group_visibility_check' AND conrelid='conversations'::regclass)
  THEN ALTER TABLE conversations ADD CONSTRAINT conversations_group_visibility_check CHECK(group_visibility IN ('public','private')); END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_public_group_search ON conversations(id DESC) WHERE type='group' AND group_visibility='public';

CREATE TABLE IF NOT EXISTS group_channels(
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL CHECK(length(trim(name))>0),
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id,conversation_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_channels_name ON group_channels(conversation_id,lower(name));
CREATE INDEX IF NOT EXISTS idx_group_channels_group ON group_channels(conversation_id,id);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id BIGINT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_channel_conversation_fk' AND conrelid='messages'::regclass)
  THEN ALTER TABLE messages ADD CONSTRAINT messages_channel_conversation_fk
    FOREIGN KEY(channel_id,conversation_id) REFERENCES group_channels(id,conversation_id) ON DELETE RESTRICT; END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_messages_group_channel ON messages(conversation_id,channel_id,id DESC);

-- Per-member notification settings are never exposed to other members.
CREATE TABLE IF NOT EXISTS group_notification_preferences(
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  message_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  mention_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(conversation_id,user_id),
  FOREIGN KEY(conversation_id,user_id) REFERENCES conversation_members(conversation_id,user_id) ON DELETE CASCADE
);
