-- Additive queue for plaintext text messages. Encrypted rooms are rejected by chat policy.
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  channel_id BIGINT,
  client_id VARCHAR(64) NOT NULL CHECK (octet_length(client_id) BETWEEN 1 AND 64),
  request_fingerprint TEXT NOT NULL,
  body TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sent', 'cancelled', 'failed')),
  message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, client_id),
  CHECK ((state = 'pending') = (body IS NOT NULL)),
  CHECK (body IS NULL OR octet_length(body) BETWEEN 1 AND 4000),
  CHECK (message_id IS NULL OR state = 'sent'),
  FOREIGN KEY (channel_id, conversation_id) REFERENCES group_channels(id, conversation_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
  ON scheduled_messages(send_at, id) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_owner_pending
  ON scheduled_messages(user_id, conversation_id, send_at, id) WHERE state = 'pending';
