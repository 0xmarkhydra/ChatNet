-- An opt-in cutover must be explicitly accepted by BOTH direct-chat members.
-- These approvals have no effect on the existing plaintext chat until the
-- first atomic MLS Commit/Welcome is stored. No secret material is persisted.
CREATE TABLE IF NOT EXISTS e2ee_pilot_consents (
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    device_id UUID NOT NULL REFERENCES e2ee_devices(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id, user_id)
        REFERENCES conversation_members(conversation_id, user_id)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_e2ee_pilot_consents_device
    ON e2ee_pilot_consents(device_id);
