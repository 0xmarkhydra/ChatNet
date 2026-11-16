-- Conversation pins are personal; message pins are shared by authorized members.
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_conversation_members_pinned
  ON conversation_members(user_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_pins (
  message_id BIGINT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_pins_recent ON message_pins(pinned_at DESC);
