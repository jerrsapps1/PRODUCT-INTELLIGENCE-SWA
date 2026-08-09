CREATE TABLE IF NOT EXISTS safety_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES project_contractor_engagements(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  title text NOT NULL,
  plan_type text NOT NULL,
  custom_plan_type text,
  current_revision_id uuid,
  review_status text NOT NULL CHECK (review_status IN ('pending','approved')) DEFAULT 'pending',
  approved_at timestamptz,
  approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_plan_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES safety_plans(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  revision_identifier text NOT NULL,
  submitted_date date,
  prior_revision_id uuid REFERENCES safety_plan_revisions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, source_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_safety_plans_current_revision'
  ) THEN
    ALTER TABLE safety_plans
      ADD CONSTRAINT fk_safety_plans_current_revision
      FOREIGN KEY (current_revision_id) REFERENCES safety_plan_revisions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS plan_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES safety_plans(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES safety_plan_revisions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','approved')) DEFAULT 'pending',
  assistant_provider text,
  assistant_model text,
  processing_status text NOT NULL CHECK (processing_status IN ('draft','running','completed','failed','partial')) DEFAULT 'draft',
  error_state text,
  prompt_config_version text,
  contractor_facing_summary text NOT NULL DEFAULT '',
  internal_reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_review_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES plan_reviews(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  authority_classification text NOT NULL,
  citation_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES plan_reviews(id) ON DELETE CASCADE,
  title text NOT NULL,
  finding_type text NOT NULL CHECK (finding_type IN ('compliant','revision_recommended','deficiency','conflict','reviewer_decision')),
  authority text NOT NULL CHECK (authority IN ('regulatory_requirement','project_requirement','recommendation','reviewer_decision')),
  plan_source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  plan_source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  reference_source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  reference_source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  reference_citation_label text,
  ai_explanation text,
  reviewer_explanation text,
  reviewer_notes text,
  contractor_facing_recommendation text,
  recommended_revision_text text,
  reviewer_decision text,
  resolved boolean NOT NULL DEFAULT false,
  not_applicable boolean NOT NULL DEFAULT false,
  origin text NOT NULL CHECK (origin IN ('assistant','reviewer')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_resubmission_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES safety_plans(id) ON DELETE CASCADE,
  prior_revision_id uuid NOT NULL REFERENCES safety_plan_revisions(id) ON DELETE CASCADE,
  new_revision_id uuid NOT NULL REFERENCES safety_plan_revisions(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES plan_findings(id) ON DELETE CASCADE,
  resolution_status text NOT NULL CHECK (resolution_status IN ('addressed','partially_addressed','unresolved','reviewer_decision')),
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_review_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES safety_plans(id) ON DELETE CASCADE,
  review_id uuid REFERENCES plan_reviews(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_plans_engagement_id ON safety_plans(engagement_id);
CREATE INDEX IF NOT EXISTS idx_safety_plan_revisions_plan_id ON safety_plan_revisions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_plan_id ON plan_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_review_references_review_id ON plan_review_references(review_id);
CREATE INDEX IF NOT EXISTS idx_plan_findings_review_id ON plan_findings(review_id);
CREATE INDEX IF NOT EXISTS idx_plan_review_audit_events_plan_id ON plan_review_audit_events(plan_id);
