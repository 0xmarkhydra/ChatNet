ALTER TABLE group_notification_preferences ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS manual_unread BOOLEAN NOT NULL DEFAULT FALSE;CREATE TABLE IF NOT EXISTS chat_quick_replies (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL CHECK (shortcut ~ '^[a-z0-9_-]{1,32}$'),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  PRIMARY KEY (user_id, shortcut)
);ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS chat_wallpaper TEXT NOT NULL DEFAULT 'default';
