-- Public MLS KeyPackage delivery queue. Never stores MLS epoch secrets or private keys.
-- A successfully claimed package is consumed once and must not be recycled.
CREATE TABLE IF NOT EXISTS e2ee_key_packages (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES e2ee_devices(id) ON DELETE CASCADE,
    package_hash BYTEA NOT NULL CHECK (octet_length(package_hash) = 32),
    package_bytes BYTEA NOT NULL CHECK (octet_length(package_bytes) BETWEEN 64 AND 16384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    claimed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (device_id, package_hash),
    CONSTRAINT e2ee_package_claim_state CHECK (claimed_at IS NOT NULL OR claimed_by IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_e2ee_key_packages_available
    ON e2ee_key_packages(device_id, created_at, id)
    WHERE claimed_at IS NULL;
