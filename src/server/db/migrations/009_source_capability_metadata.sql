ALTER TABLE sources ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE sources ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS summary_status text NOT NULL DEFAULT 'not_generated';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS summary_generated_at timestamptz;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS summary_provider text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS summary_model text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sources_tags ON sources USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_sources_archived_at ON sources(archived_at);
