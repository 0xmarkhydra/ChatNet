-- Independent read cursors for every channel in a group. The general room uses channel_id=0.
-- Existing members inherit their last conversation-level read cursor once; reruns never reset it.
CREATE TABLE IF NOT EXISTS group_channel_reads (
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL CHECK(channel_id >= 0),
  last_read_message_id BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(conversation_id,user_id,channel_id),
  FOREIGN KEY(conversation_id,user_id) REFERENCES conversation_members(conversation_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_group_channel_reads_member ON group_channel_reads(user_id,conversation_id);

INSERT INTO group_channel_reads(conversation_id,user_id,channel_id,last_read_message_id)
SELECT cm.conversation_id,cm.user_id,rooms.id,cm.last_read_message_id
FROM conversation_members cm
JOIN conversations c ON c.id=cm.conversation_id AND c.type='group'
CROSS JOIN LATERAL (
  SELECT 0::BIGINT id
  UNION ALL SELECT gc.id FROM group_channels gc WHERE gc.conversation_id=cm.conversation_id
) rooms
ON CONFLICT(conversation_id,user_id,channel_id) DO NOTHING;
