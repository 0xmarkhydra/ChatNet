-- Image references only: actual image files live in the configured S3-compatible object store.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_avatar_ref TEXT NOT NULL DEFAULT '';
