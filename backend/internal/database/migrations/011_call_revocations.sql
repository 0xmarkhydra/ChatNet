CREATE TABLE IF NOT EXISTS call_revocations (
    id BIGSERIAL PRIMARY KEY,
    reason VARCHAR(24) NOT NULL CHECK (reason IN ('block', 'member_removed')),
    conversation_id BIGINT,
    actor_user_id BIGINT NOT NULL,
    target_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    revocation_window_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    last_error VARCHAR(255),
    CHECK (reason <> 'block' OR actor_user_id <> target_user_id),
    CHECK (
        (reason = 'block' AND conversation_id IS NULL)
        OR (reason = 'member_removed' AND conversation_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_call_revocations_pending
ON call_revocations(available_at, id)
WHERE processed_at IS NULL;
