-- Experimental opaque MLS delivery transport. No group is marked E2EE-active
-- by this schema. Clients MUST validate MLS transcript, epochs and membership.
CREATE TABLE IF NOT EXISTS e2ee_mls_groups (
    conversation_id BIGINT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    epoch BIGINT NOT NULL DEFAULT 0 CHECK (epoch >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS e2ee_mls_events (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES e2ee_mls_groups(conversation_id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_device_id UUID NOT NULL REFERENCES e2ee_devices(id),
    client_id UUID NOT NULL,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('commit', 'application', 'welcome')),
    epoch BIGINT NOT NULL CHECK (epoch >= 1),
    target_device_id UUID REFERENCES e2ee_devices(id),
    payload BYTEA NOT NULL CHECK (octet_length(payload) BETWEEN 32 AND 131072),
    signature BYTEA NOT NULL CHECK (octet_length(signature) = 64),
    request_hash BYTEA NOT NULL CHECK (octet_length(request_hash) = 32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sender_device_id, client_id),
    CONSTRAINT e2ee_welcome_is_targeted CHECK (
        (event_type = 'welcome' AND target_device_id IS NOT NULL) OR
        (event_type <> 'welcome' AND target_device_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_e2ee_mls_events_conversation_cursor
    ON e2ee_mls_events(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_e2ee_mls_events_welcome_target
    ON e2ee_mls_events(target_device_id, id) WHERE event_type = 'welcome';
