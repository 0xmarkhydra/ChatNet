-- Additive publisher proof for client-side verification of claimed MLS KeyPackages.
-- Legacy packages that predate this record are NOT returned by claim API.
-- No private key or MLS group secret is stored.
ALTER TABLE e2ee_key_packages
  ADD COLUMN IF NOT EXISTS publisher_session_id UUID;
ALTER TABLE e2ee_key_packages
  ADD COLUMN IF NOT EXISTS publication_challenge BYTEA;
ALTER TABLE e2ee_key_packages
  ADD COLUMN IF NOT EXISTS publication_signature BYTEA;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='e2ee_key_packages'::regclass
      AND conname='e2ee_package_attestation'
  ) THEN
    ALTER TABLE e2ee_key_packages ADD CONSTRAINT e2ee_package_attestation CHECK (
      (publisher_session_id IS NULL AND publication_challenge IS NULL AND publication_signature IS NULL) OR
      (publisher_session_id IS NOT NULL AND octet_length(publication_challenge)=32 AND octet_length(publication_signature)=64)
    );
  END IF;
END $$;
