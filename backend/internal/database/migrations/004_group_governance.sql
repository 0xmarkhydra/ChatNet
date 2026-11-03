-- Group governance is additive; existing groups retain their current behavior.
CREATE TABLE IF NOT EXISTS group_settings (
  conversation_id BIGINT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  require_approval BOOLEAN NOT NULL DEFAULT FALSE,
  admin_can_invite BOOLEAN NOT NULL DEFAULT TRUE,
  admin_can_approve BOOLEAN NOT NULL DEFAULT TRUE,
  admin_can_edit_info BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS group_invite_links (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT CHECK (max_uses IS NULL OR max_uses BETWEEN 1 AND 10000),
  use_count INT NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_invite_links_group ON group_invite_links(conversation_id, created_at DESC);
CREATE TABLE IF NOT EXISTS group_join_requests (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_id BIGINT REFERENCES group_invite_links(id) ON DELETE SET NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_pending ON group_join_requests(conversation_id, created_at DESC) WHERE status='pending';
CREATE TABLE IF NOT EXISTS group_admin_audit (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_admin_audit_group ON group_admin_audit(conversation_id, id DESC);
