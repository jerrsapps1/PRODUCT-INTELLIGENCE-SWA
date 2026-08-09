CREATE TABLE IF NOT EXISTS readiness_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Other',
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  citation_label text,
  required boolean NOT NULL DEFAULT true,
  blocking boolean NOT NULL DEFAULT true,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractor_requirement_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES readiness_requirements(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES project_contractor_engagements(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('required','requested','received','needs_review','accepted','rejected','expired','replacement_requested','not_applicable')),
  reviewer_notes text,
  planned_mobilization_date date,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, engagement_id)
);

CREATE TABLE IF NOT EXISTS readiness_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_status_id uuid NOT NULL REFERENCES contractor_requirement_statuses(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  evidence_role text NOT NULL DEFAULT 'supporting_evidence',
  review_status text NOT NULL CHECK (review_status IN ('required','requested','received','needs_review','accepted','rejected','expired','replacement_requested','not_applicable')),
  extracted_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_confirmed_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_notes text,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_status_id, source_id)
);

CREATE TABLE IF NOT EXISTS safety_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES project_contractor_engagements(id) ON DELETE SET NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('emr','trir','dart','other')),
  metric_name text,
  period_year integer NOT NULL,
  value numeric NOT NULL,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  evidence_id uuid REFERENCES readiness_evidence(id) ON DELETE SET NULL,
  review_status text NOT NULL CHECK (review_status IN ('required','requested','received','needs_review','accepted','rejected','expired','replacement_requested','not_applicable')),
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competent_person_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES project_contractor_engagements(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  designation text NOT NULL,
  authorization_source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  training_source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  effective_date date,
  expiration_date date,
  review_status text NOT NULL CHECK (review_status IN ('required','requested','received','needs_review','accepted','rejected','expired','replacement_requested','not_applicable')),
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS readiness_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES project_contractor_engagements(id) ON DELETE CASCADE,
  requirement_status_id uuid REFERENCES contractor_requirement_statuses(id) ON DELETE SET NULL,
  evidence_id uuid REFERENCES readiness_evidence(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_requirements_project_id ON readiness_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_contractor_requirement_statuses_engagement_id ON contractor_requirement_statuses(engagement_id);
CREATE INDEX IF NOT EXISTS idx_readiness_evidence_requirement_status_id ON readiness_evidence(requirement_status_id);
CREATE INDEX IF NOT EXISTS idx_safety_metrics_contractor_id ON safety_metrics(contractor_id);
CREATE INDEX IF NOT EXISTS idx_competent_person_evidence_engagement_id ON competent_person_evidence(engagement_id);
CREATE INDEX IF NOT EXISTS idx_readiness_audit_events_engagement_id ON readiness_audit_events(engagement_id);
