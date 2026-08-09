CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_filename text,
  mime_type text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('pdf', 'docx', 'xlsx', 'pptx', 'txt', 'markdown', 'csv', 'image', 'url', 'other')),
  scope text NOT NULL CHECK (scope IN ('global', 'project', 'contractor')),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  authority_classification text NOT NULL CHECK (authority_classification IN ('regulatory_requirement', 'project_requirement', 'owner_requirement', 'gc_policy', 'general_reference', 'contractor_submission', 'working_document', 'generated_artifact')),
  user_confirmed_classification boolean NOT NULL DEFAULT false,
  ai_suggested_classification text,
  storage_key text,
  original_url text,
  size_bytes integer NOT NULL DEFAULT 0,
  processing_status text NOT NULL CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'partial', 'failed')),
  extraction_status text NOT NULL CHECK (extraction_status IN ('uploaded', 'processing', 'ready', 'partial', 'failed')),
  extraction_version text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_chunks (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  location_label text,
  citation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  activation_status text NOT NULL CHECK (activation_status IN ('available', 'associated', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_sources_owner_user_id ON sources(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sources_project_id ON sources(project_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_source_id ON source_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_text ON source_chunks USING gin (to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_project_sources_project_id ON project_sources(project_id);
