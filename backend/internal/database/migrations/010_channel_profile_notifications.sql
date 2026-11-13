-- Channel avatars are independently configured; the general channel inherits its group's avatar.
ALTER TABLE group_channels ADD COLUMN IF NOT EXISTS avatar_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE group_channels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP INDEX IF EXISTS idx_group_channels_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_channels_name ON group_channels(conversation_id,lower(name)) WHERE deleted_at IS NULL;

-- Each group member may mute a specific channel without muting the whole group.
CREATE TABLE IF NOT EXISTS group_channel_notification_preferences (
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL CHECK (channel_id >= 0),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id, channel_id),
  FOREIGN KEY (conversation_id, user_id) REFERENCES conversation_members(conversation_id, user_id) ON DELETE CASCADE
);
