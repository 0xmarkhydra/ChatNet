ALTER TABLE call_revocations
    ADD COLUMN IF NOT EXISTS call_id VARCHAR(40),
    ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

ALTER TABLE call_revocations
    DROP CONSTRAINT IF EXISTS call_revocations_reason_check,
    DROP CONSTRAINT IF EXISTS call_revocations_check,
    DROP CONSTRAINT IF EXISTS call_revocations_check1,
    DROP CONSTRAINT IF EXISTS call_revocations_shape_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'call_revocations_reason_check'
          AND conrelid = 'call_revocations'::regclass
    ) THEN
        ALTER TABLE call_revocations
            ADD CONSTRAINT call_revocations_reason_check
            CHECK (reason IN ('block', 'member_removed', 'participant_left', 'call_finished'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'call_revocations_shape_check'
          AND conrelid = 'call_revocations'::regclass
    ) THEN
        ALTER TABLE call_revocations
            ADD CONSTRAINT call_revocations_shape_check
            CHECK (
                (reason = 'block' AND conversation_id IS NULL AND call_id IS NULL AND actor_user_id <> target_user_id)
                OR (reason = 'member_removed' AND conversation_id IS NOT NULL AND call_id IS NULL)
                OR (reason = 'participant_left' AND conversation_id IS NOT NULL AND call_id IS NOT NULL)
                OR (reason = 'call_finished' AND conversation_id IS NOT NULL AND call_id IS NOT NULL)
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_revocations_finished_call
ON call_revocations(call_id)
WHERE reason = 'call_finished';

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_revocations_participant_left
ON call_revocations(call_id, target_user_id)
WHERE reason = 'participant_left' AND processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_call_revocations_pending_ready
ON call_revocations(available_at, id)
WHERE processed_at IS NULL AND dead_lettered_at IS NULL;
