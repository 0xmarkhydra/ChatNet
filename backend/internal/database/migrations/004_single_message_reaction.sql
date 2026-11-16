-- Existing installations may contain several emojis per user/message.
-- Keep the latest reaction deterministically before enforcing one per user.
WITH ranked AS (
  SELECT ctid, ROW_NUMBER() OVER (
    PARTITION BY message_id, user_id ORDER BY created_at DESC, emoji DESC
  ) AS position
  FROM message_reactions
)
DELETE FROM message_reactions AS reaction USING ranked
WHERE reaction.ctid = ranked.ctid AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_one_per_user
ON message_reactions(message_id, user_id);
