-- Shared group activity pins are displayed with message pins in the conversation header.
ALTER TABLE group_activities
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_group_activities_pinned
  ON group_activities(conversation_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;
