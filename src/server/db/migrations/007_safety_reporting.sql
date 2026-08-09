CREATE TABLE IF NOT EXISTS safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily','weekly','monthly','custom')),
  format text NOT NULL CHECK (format IN ('narrative','structured')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','finalized')) DEFAULT 'draft',
  generation_status text NOT NULL CHECK (generation_status IN ('not_generated','generating','ready','failed')) DEFAULT 'not_generated',
  generation_provider text,
  generation_model text,
  error_state text,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_revision_id uuid,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  finalized_at timestamptz,
  finalized_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start <= period_end)
);

CREATE TABLE IF NOT EXISTS safety_report_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES safety_reports(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','finalized')) DEFAULT 'draft',
  title text NOT NULL,
  content_markdown text NOT NULL DEFAULT '',
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  finalized_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (report_id, revision_number)
);

CREATE TABLE IF NOT EXISTS safety_report_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES safety_reports(id) ON DELETE CASCADE,
  revision_id uuid REFERENCES safety_report_revisions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_reports_project_id ON safety_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_period ON safety_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_safety_report_revisions_report_id ON safety_report_revisions(report_id);
CREATE INDEX IF NOT EXISTS idx_safety_report_audit_report_id ON safety_report_audit_events(report_id);
