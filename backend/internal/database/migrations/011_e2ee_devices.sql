-- Additive E2EE device identity registry; no private keys or plaintext payloads.
-- Experimental APIs remain disabled unless CHATNET_E2EE_EXPERIMENTAL=1.
CREATE TABLE IF NOT EXISTS e2ee_devices (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    identity_key BYTEA NOT NULL CHECK (octet_length(identity_key) = 32),
    label VARCHAR(80) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE (user_id, identity_key)
);
CREATE INDEX IF NOT EXISTS idx_e2ee_devices_user_active
    ON e2ee_devices(user_id, created_at DESC) WHERE revoked_at IS NULL;
