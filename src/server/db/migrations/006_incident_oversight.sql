CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES project_contractor_engagements(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  incident_date_time timestamptz NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  location text,
  activity text,
  factual_description text NOT NULL,
  incident_category text NOT NULL,
  contractor_reported_classification text,
  contractor_investigation_status text NOT NULL DEFAULT 'unknown',
  oversight_status text NOT NULL DEFAULT 'received',
  affected_work_disposition text NOT NULL DEFAULT 'no_restriction',
  affected_work_scope text,
  ai_review_status text NOT NULL DEFAULT 'not_run',
  ai_summary text,
  ai_suggested_concerns text,
  ai_suggested_questions text,
  ai_error_state text,
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  closure_note text,
  project_outcome text,
  unresolved_contractor_items text,
  reopened_at timestamptz,
  reopened_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  role text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, source_id, role)
);

CREATE TABLE IF NOT EXISTS contractor_corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  description text NOT NULL,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  target_date date,
  contractor_status text NOT NULL DEFAULT 'provided',
  evidence_received boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_project_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
  reviewer_analysis text,
  remaining_exposure text,
  plan_procedure_concerns text,
  corrective_action_adequacy text,
  additional_information_needed text,
  management_review_needed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  recommendation_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_safety_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_text text NOT NULL,
  applies_to_scope text,
  effective_date date,
  status text NOT NULL DEFAULT 'active',
  decision_maker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rationale text,
  supporting_source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status text NOT NULL,
  verification_note text,
  verified_at timestamptz,
  verifier_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  linked_observation_id uuid REFERENCES field_observations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  plan_finding_id uuid REFERENCES plan_findings(id) ON DELETE CASCADE,
  observation_id uuid REFERENCES field_observations(id) ON DELETE CASCADE,
  suggested boolean NOT NULL DEFAULT false,
  accepted boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, plan_finding_id, observation_id)
);

CREATE TABLE IF NOT EXISTS incident_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_engagement_id ON incidents(engagement_id);
CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident_id ON incident_attachments(incident_id);
CREATE INDEX IF NOT EXISTS idx_contractor_corrective_actions_incident_id ON contractor_corrective_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_recommendations_incident_id ON incident_recommendations(incident_id);
CREATE INDEX IF NOT EXISTS idx_project_safety_decisions_incident_id ON project_safety_decisions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_followups_incident_id ON incident_followups(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_incident_id ON incident_links(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_audit_events_incident_id ON incident_audit_events(incident_id);
