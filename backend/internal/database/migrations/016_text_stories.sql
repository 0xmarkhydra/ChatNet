-- Apply once on existing installations without rewriting any media story.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'stories'::regclass AND conname = 'stories_payload_check'
    ) THEN
        ALTER TABLE stories
            DROP CONSTRAINT stories_kind_check,
            ALTER COLUMN storage_ref DROP NOT NULL,
            ALTER COLUMN original_name DROP NOT NULL,
            ALTER COLUMN content_type DROP NOT NULL,
            ALTER COLUMN size_bytes DROP NOT NULL,
            ADD COLUMN text_content TEXT,
            ADD COLUMN text_background VARCHAR(16),
            ADD CONSTRAINT stories_payload_check CHECK (
                (kind IN ('image', 'video')
                 AND storage_ref IS NOT NULL AND original_name IS NOT NULL
                 AND content_type IS NOT NULL AND size_bytes IS NOT NULL
                 AND text_content IS NULL AND text_background IS NULL)
                OR
                (kind = 'text'
                 AND storage_ref IS NULL AND original_name IS NULL
                 AND content_type IS NULL AND size_bytes IS NULL
                 AND text_content IS NOT NULL AND char_length(text_content) BETWEEN 1 AND 200
                 AND text_background IS NOT NULL AND text_background IN ('berry', 'indigo', 'teal', 'sunset'))
            );
    END IF;
END;
$$;