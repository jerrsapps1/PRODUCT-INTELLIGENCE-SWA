CREATE TABLE IF NOT EXISTS field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES project_contractor_engagements(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  original_text text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  location text,
  activity text,
  derived_classification text CHECK (derived_classification IN ('positive','neutral','concern','corrected_in_field','follow_up_required')),
  category text,
  derived_summary text,
  reviewer_note text,
  follow_up_status text NOT NULL DEFAULT 'none' CHECK (follow_up_status IN ('none','needed','verified_closed')),
  follow_up_note text,
  follow_up_due_date date,
  follow_up_verified_at timestamptz,
  follow_up_verified_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ai_suggestion_status text NOT NULL DEFAULT 'saved' CHECK (ai_suggestion_status IN ('saved','processing','ready','failed')),
  suggested_classification text CHECK (suggested_classification IN ('positive','neutral','concern','corrected_in_field','follow_up_required')),
  suggested_category text,
  suggested_activity text,
  suggested_summary text,
  suggested_follow_up_status text CHECK (suggested_follow_up_status IN ('none','needed','verified_closed')),
  ai_error_state text,
  ai_suggestions_rejected boolean NOT NULL DEFAULT false,
  recurrence_count integer NOT NULL DEFAULT 0,
  recurrence_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES field_observations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observation_id, source_id)
);

CREATE TABLE IF NOT EXISTS observation_reference_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES field_observations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  citation_label text,
  suggested boolean NOT NULL DEFAULT false,
  accepted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observation_id, source_id, source_chunk_id)
);

CREATE TABLE IF NOT EXISTS observation_plan_finding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES field_observations(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES plan_findings(id) ON DELETE CASCADE,
  suggested boolean NOT NULL DEFAULT false,
  accepted boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observation_id, finding_id)
);

CREATE TABLE IF NOT EXISTS observation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES field_observations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_observations_project_id ON field_observations(project_id);
CREATE INDEX IF NOT EXISTS idx_field_observations_engagement_id ON field_observations(engagement_id);
CREATE INDEX IF NOT EXISTS idx_observation_photos_observation_id ON observation_photos(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_reference_links_observation_id ON observation_reference_links(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_plan_finding_links_observation_id ON observation_plan_finding_links(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_audit_events_observation_id ON observation_audit_events(observation_id);
