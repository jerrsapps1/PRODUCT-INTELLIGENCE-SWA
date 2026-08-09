import { randomUUID } from "node:crypto";
import pg from "pg";
import type {
  CompetentPersonCreateInput,
  CompetentPersonEvidence,
  Contractor,
  ContractorCreateInput,
  ContractorReadinessDetail,
  ContractorReadinessSummary,
  ContractorRequirementApplyInput,
  ContractorRequirementStatus,
  ContractorRequirementUpdateInput,
  EngagementCreateInput,
  Project,
  ProjectContractorEngagement,
  ProjectCreateInput,
  ProjectSourceActivationInput,
  ProjectSourceInput,
  ProjectSourceLink,
  ReadinessAuditEvent,
  ReadinessEvidence,
  ReadinessEvidenceCreateInput,
  ReadinessEvidenceReviewInput,
  ReadinessRequirement,
  ReadinessRequirementCreateInput,
  ReadinessRequirementUpdateInput,
  ReadinessStatus,
  SafetyMetric,
  SafetyMetricCreateInput,
  SafetyPlan,
  SafetyPlanCreateInput,
  SafetyPlanDetail,
  SafetyPlanRevision,
  SafetyPlanRevisionCreateInput,
  PlanApprovalInput,
  PlanFinding,
  PlanFindingCreateInput,
  PlanFindingUpdateInput,
  PlanRecommendationUpdateInput,
  PlanReview,
  PlanReviewReference,
  PlanReviewRunInput,
  PlanReviewAuditEvent,
  ResubmissionComparison,
  ResubmissionComparisonCreateInput,
  FieldObservation,
  ObservationAuditEvent,
  ObservationCreateInput,
  ObservationDetail,
  ObservationPhoto,
  ObservationPhotoAttachInput,
  ObservationPhotoUpdateInput,
  ObservationPlanFindingLink,
  ObservationPlanFindingLinkInput,
  ObservationReferenceLink,
  ObservationReferenceLinkInput,
  ObservationSearchInput,
  ObservationUpdateInput,
  ContractorCorrectiveAction,
  ContractorCorrectiveActionInput,
  ContractorCorrectiveActionUpdateInput,
  IncidentAttachment,
  IncidentAttachmentInput,
  IncidentAuditEvent,
  IncidentCloseInput,
  IncidentCreateInput,
  IncidentDetail,
  IncidentFollowUp,
  IncidentFollowUpInput,
  IncidentLink,
  IncidentLinkInput,
  IncidentProjectReview,
  IncidentProjectReviewInput,
  IncidentRecommendation,
  IncidentRecommendationInput,
  IncidentRecommendationUpdateInput,
  IncidentRecord,
  IncidentReopenInput,
  IncidentSearchInput,
  IncidentUpdateInput,
  ProjectSafetyDecision,
  ProjectSafetyDecisionInput,
  AssistantActionDescriptor,
  AssistantActionInvokeInput,
  AssistantActionResult,
  AssistantContext,
  AssistantContextSummary,
  AssistantConversation,
  AssistantConversationCreateInput,
  AssistantConversationDetail,
  AssistantConversationUpdateInput,
  AssistantDashboard,
  AssistantMessage,
  AssistantMessageSendInput,
  AssistantRetrievalManifest,
  AssistantRun,
  AssistantSkill,
  InstructionDocument,
  InstructionDocumentSaveInput,
  MemoryEntry,
  MemoryEntryCreateInput,
  MemoryEntryUpdateInput,
  ProposedAction,
  ProposedActionConfirmInput,
  ProposedActionEditInput,
  ProposedActionRejectInput,
  ReportCreateInput,
  ReportExport,
  ReportEvidenceManifest,
  ReportFinalizeInput,
  ReportGenerateInput,
  ReportManualInputs,
  ReportRevisionUpdateInput,
  ReportScopeInput,
  ReportSearchInput,
  ReportUpdateInput,
  SafetyReport,
  SafetyReportAuditEvent,
  SafetyReportDetail,
  SafetyReportRevision,
  SkillActivationInput,
  SkillSaveInput,
  SourceChunk,
  SourceDetail,
  SourceRecord,
  SourceSearchInput,
  SourceUpdateInput
} from "../../shared/contracts";
import {
  DuplicateEngagementError,
  DuplicateEvidenceAssociationError,
  DuplicateIncidentAttachmentError,
  DuplicateIncidentLinkError,
  DuplicateObservationPhotoError,
  DuplicateObservationPlanFindingLinkError,
  DuplicateObservationReferenceError,
  DuplicatePlanRevisionSourceError,
  DuplicateProjectSourceError,
  DuplicateRequirementApplicationError,
  type AppStore,
  type StoredUser
} from "../store";
import { runPlanReviewAssistant, type ReviewReferenceContext } from "../planReviewAssistant";
import { buildObservationReferenceQuery, runObservationAssistant } from "../observationAssistant";
import { runIncidentAssistant } from "../incidentAssistant";
import { draftFallbackSafetyReport, draftSafetyReport, type ReportEvidenceContext } from "../reportAssistant";

const { Pool } = pg;

const initialMigration = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  project_identifier text,
  location text NOT NULL,
  federal_classification text NOT NULL CHECK (federal_classification IN ('Federal', 'Non-Federal')),
  description text,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  trade text,
  primary_contact_name text,
  primary_contact_email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, legal_name)
);

CREATE TABLE IF NOT EXISTS project_contractor_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  scope_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contractors_owner_user_id ON contractors(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_engagements_project_id ON project_contractor_engagements(project_id);

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
  engagement_id uuid REFERENCES project_contractor_engagements(id) ON DELETE CASCADE,
  metric_type text NOT NULL CHECK (metric_type IN ('emr','trir','dart','other')),
  metric_name text,
  period_year integer NOT NULL,
  value numeric NOT NULL CHECK (value >= 0),
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
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_requirements_project_id ON readiness_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirement_statuses_engagement_id ON contractor_requirement_statuses(engagement_id);
CREATE INDEX IF NOT EXISTS idx_readiness_evidence_status_id ON readiness_evidence(requirement_status_id);
CREATE INDEX IF NOT EXISTS idx_safety_metrics_engagement_id ON safety_metrics(engagement_id);
CREATE INDEX IF NOT EXISTS idx_competent_person_evidence_engagement_id ON competent_person_evidence(engagement_id);
CREATE INDEX IF NOT EXISTS idx_readiness_audit_engagement_id ON readiness_audit_events(engagement_id);

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

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  provider text,
  model text,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES assistant_conversations(id) ON DELETE SET NULL,
  status text NOT NULL,
  provider text,
  model text,
  context_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieval_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','project')),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  provenance_type text,
  provenance_id text,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  confirmed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instruction_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','project')),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  area text NOT NULL,
  title text NOT NULL,
  markdown text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by_user_id, scope, project_id, area)
);

CREATE TABLE IF NOT EXISTS assistant_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','project')),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  trigger_description text NOT NULL,
  guided_purpose text,
  guided_inputs text,
  guided_outputs text,
  guided_rules text,
  guided_authority_limits text,
  markdown text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposed_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES assistant_conversations(id) ON DELETE SET NULL,
  origin_message_id uuid REFERENCES assistant_messages(id) ON DELETE SET NULL,
  action_name text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  current_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_change jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL,
  confirmed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmation_note text,
  rejection_reason text,
  executed_result jsonb,
  error_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_plans_engagement_id ON safety_plans(engagement_id);
CREATE INDEX IF NOT EXISTS idx_safety_plan_revisions_plan_id ON safety_plan_revisions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_plan_id ON plan_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_review_references_review_id ON plan_review_references(review_id);
CREATE INDEX IF NOT EXISTS idx_plan_findings_review_id ON plan_findings(review_id);
CREATE INDEX IF NOT EXISTS idx_plan_review_audit_events_plan_id ON plan_review_audit_events(plan_id);
CREATE INDEX IF NOT EXISTS idx_field_observations_project_id ON field_observations(project_id);
CREATE INDEX IF NOT EXISTS idx_field_observations_engagement_id ON field_observations(engagement_id);
CREATE INDEX IF NOT EXISTS idx_observation_photos_observation_id ON observation_photos(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_reference_links_observation_id ON observation_reference_links(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_plan_finding_links_observation_id ON observation_plan_finding_links(observation_id);
CREATE INDEX IF NOT EXISTS idx_observation_audit_events_observation_id ON observation_audit_events(observation_id);
CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_engagement_id ON incidents(engagement_id);
CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident_id ON incident_attachments(incident_id);
CREATE INDEX IF NOT EXISTS idx_contractor_corrective_actions_incident_id ON contractor_corrective_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_recommendations_incident_id ON incident_recommendations(incident_id);
CREATE INDEX IF NOT EXISTS idx_project_safety_decisions_incident_id ON project_safety_decisions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_followups_incident_id ON incident_followups(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_incident_id ON incident_links(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_audit_events_incident_id ON incident_audit_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_project_id ON safety_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_period ON safety_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_safety_report_revisions_report_id ON safety_report_revisions(report_id);
CREATE INDEX IF NOT EXISTS idx_safety_report_audit_report_id ON safety_report_audit_events(report_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_project_id ON assistant_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_conversation_id ON assistant_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_project_id ON memory_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_instruction_documents_project_id ON instruction_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_assistant_skills_project_id ON assistant_skills(project_id);
CREATE INDEX IF NOT EXISTS idx_proposed_actions_conversation_id ON proposed_actions(conversation_id);
`;

function clean(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function titleCase(value: string): string {
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function normalizeReportScope(scope: Partial<ReportScopeInput> | undefined): ReportScopeInput {
  return {
    includeContractors: scope?.includeContractors ?? true,
    includeReadiness: scope?.includeReadiness ?? true,
    includePlanReview: scope?.includePlanReview ?? true,
    includeObservations: scope?.includeObservations ?? true,
    includeIncidents: scope?.includeIncidents ?? true,
    includeOpenFollowUp: scope?.includeOpenFollowUp ?? true,
    includeProjectDecisions: scope?.includeProjectDecisions ?? true,
    includeUpcomingFocus: scope?.includeUpcomingFocus ?? true
  };
}

function normalizeManualInputs(inputs: Partial<ReportManualInputs> | undefined): ReportManualInputs {
  return {
    projectActivity: inputs?.projectActivity ?? "",
    meetingNote: inputs?.meetingNote ?? "",
    plannedWork: inputs?.plannedWork ?? "",
    weather: inputs?.weather ?? "",
    visitorAuditNote: inputs?.visitorAuditNote ?? "",
    milestone: inputs?.milestone ?? "",
    safetyEmphasis: inputs?.safetyEmphasis ?? "",
    otherContext: inputs?.otherContext ?? ""
  };
}

function emptyReportManifest(periodStart: string, periodEnd: string): ReportEvidenceManifest {
  return {
    generatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
    newDuringPeriod: { observationIds: [], incidentIds: [], planReviewIds: [], readinessStatusIds: [], projectDecisionIds: [] },
    carriedOpen: { observationIds: [], incidentIds: [], planReviewIds: [], readinessStatusIds: [], projectDecisionIds: [] },
    sourceIds: []
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

function reportHtml(detail: SafetyReportDetail): string {
  const body = escapeHtml(detail.currentRevision?.contentMarkdown ?? "").split("\n").map((line) => line ? `<p>${line}</p>` : "").join("\n");
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(detail.title)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:32px auto;line-height:1.5;color:#17202a}p{white-space:pre-wrap}header{border-bottom:1px solid #d0d7de;margin-bottom:24px}</style></head>
<body><header><h1>${escapeHtml(detail.title)}</h1><p>${escapeHtml(detail.reportType)} | ${escapeHtml(detail.periodStart)} to ${escapeHtml(detail.periodEnd)} | ${escapeHtml(detail.status)}</p></header>${body}</body>
</html>`;
}

const assistantActionDescriptors: AssistantActionDescriptor[] = [
  { name: "get_project_status", description: "Summarize current project readiness, observations, incidents, decisions, and reports.", actionType: "READ", confirmationRequired: false },
  { name: "get_open_observation_followup", description: "List open observation follow-up for a project.", actionType: "READ", confirmationRequired: false },
  { name: "get_open_incident_followup", description: "List open incident follow-up for a project.", actionType: "READ", confirmationRequired: false },
  { name: "get_reports", description: "List project safety reports.", actionType: "READ", confirmationRequired: false },
  { name: "retrieve_sources", description: "Retrieve project/global source chunks with provenance.", actionType: "READ", confirmationRequired: false },
  { name: "draft_project_meeting_brief", description: "Draft a non-authoritative project meeting brief.", actionType: "DRAFT", confirmationRequired: false },
  { name: "draft_contractor_followup", description: "Draft non-authoritative contractor follow-up wording.", actionType: "DRAFT", confirmationRequired: false },
  { name: "propose_save_memory", description: "Propose a memory entry that requires human confirmation.", actionType: "PROPOSED_WRITE", confirmationRequired: true },
  { name: "propose_update_observation_followup", description: "Propose an observation follow-up update that requires confirmation.", actionType: "PROPOSED_WRITE", confirmationRequired: true }
];

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function mapUser(row: Record<string, unknown>): StoredUser {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash)
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    projectIdentifier: row.project_identifier ? String(row.project_identifier) : null,
    location: String(row.location),
    federalClassification: row.federal_classification as Project["federalClassification"],
    description: row.description ? String(row.description) : null,
    startDate: toIsoDate(row.start_date as Date | string | null),
    endDate: toIsoDate(row.end_date as Date | string | null),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapContractor(row: Record<string, unknown>): Contractor {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    legalName: String(row.legal_name),
    trade: row.trade ? String(row.trade) : null,
    primaryContactName: row.primary_contact_name ? String(row.primary_contact_name) : null,
    primaryContactEmail: row.primary_contact_email ? String(row.primary_contact_email) : null,
    phone: row.phone ? String(row.phone) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapEngagement(row: Record<string, unknown>, contractor?: Contractor): ProjectContractorEngagement {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    contractorId: String(row.contractor_id),
    scopeSummary: row.scope_summary ? String(row.scope_summary) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    contractor
  };
}

function mapSource(row: Record<string, unknown>): SourceRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    originalFilename: row.original_filename ? String(row.original_filename) : null,
    mimeType: String(row.mime_type),
    sourceType: row.source_type as SourceRecord["sourceType"],
    scope: row.scope as SourceRecord["scope"],
    projectId: row.project_id ? String(row.project_id) : null,
    authorityClassification: row.authority_classification as SourceRecord["authorityClassification"],
    userConfirmedClassification: Boolean(row.user_confirmed_classification),
    aiSuggestedClassification: row.ai_suggested_classification as SourceRecord["aiSuggestedClassification"] ?? null,
    storageKey: row.storage_key ? String(row.storage_key) : null,
    originalUrl: row.original_url ? String(row.original_url) : null,
    sizeBytes: Number(row.size_bytes),
    processingStatus: row.processing_status as SourceRecord["processingStatus"],
    extractionStatus: row.extraction_status as SourceRecord["extractionStatus"],
    extractionVersion: row.extraction_version ? String(row.extraction_version) : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    uploadedAt: new Date(row.uploaded_at as string).toISOString(),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapChunk(row: Record<string, unknown>): SourceChunk {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    chunkIndex: Number(row.chunk_index),
    text: String(row.text),
    locationLabel: row.location_label ? String(row.location_label) : null,
    citation: (row.citation as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapProjectSource(row: Record<string, unknown>, source?: SourceRecord): ProjectSourceLink {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sourceId: String(row.source_id),
    activationStatus: row.activation_status as ProjectSourceLink["activationStatus"],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    source
  };
}

function mapReadinessRequirement(row: Record<string, unknown>): ReadinessRequirement {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    category: String(row.category),
    sourceId: row.source_id ? String(row.source_id) : null,
    sourceChunkId: row.source_chunk_id ? String(row.source_chunk_id) : null,
    citationLabel: row.citation_label ? String(row.citation_label) : null,
    required: Boolean(row.required),
    blocking: Boolean(row.blocking),
    dueDate: toIsoDate(row.due_date as Date | string | null),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapRequirementStatus(row: Record<string, unknown>, requirement?: ReadinessRequirement): ContractorRequirementStatus {
  return {
    id: String(row.id),
    requirementId: String(row.requirement_id),
    engagementId: String(row.engagement_id),
    status: row.status as ReadinessStatus,
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    plannedMobilizationDate: toIsoDate(row.planned_mobilization_date as Date | string | null),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string).toISOString() : null,
    reviewedByUserId: row.reviewed_by_user_id ? String(row.reviewed_by_user_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    requirement
  };
}

function mapReadinessEvidence(row: Record<string, unknown>, source?: SourceRecord): ReadinessEvidence {
  return {
    id: String(row.id),
    requirementStatusId: String(row.requirement_status_id),
    sourceId: String(row.source_id),
    sourceChunkId: row.source_chunk_id ? String(row.source_chunk_id) : null,
    evidenceRole: String(row.evidence_role),
    reviewStatus: row.review_status as ReadinessStatus,
    extractedMetadata: (row.extracted_metadata as Record<string, unknown>) ?? {},
    reviewerConfirmedMetadata: (row.reviewer_confirmed_metadata as Record<string, unknown>) ?? {},
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string).toISOString() : null,
    reviewedByUserId: row.reviewed_by_user_id ? String(row.reviewed_by_user_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    source
  };
}

function mapSafetyMetric(row: Record<string, unknown>): SafetyMetric {
  return {
    id: String(row.id),
    contractorId: String(row.contractor_id),
    engagementId: row.engagement_id ? String(row.engagement_id) : null,
    metricType: row.metric_type as SafetyMetric["metricType"],
    metricName: row.metric_name ? String(row.metric_name) : null,
    periodYear: Number(row.period_year),
    value: Number(row.value),
    sourceId: String(row.source_id),
    evidenceId: row.evidence_id ? String(row.evidence_id) : null,
    reviewStatus: row.review_status as ReadinessStatus,
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapCompetentPerson(row: Record<string, unknown>): CompetentPersonEvidence {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    contractorId: String(row.contractor_id),
    personName: String(row.person_name),
    designation: String(row.designation),
    authorizationSourceId: String(row.authorization_source_id),
    trainingSourceId: row.training_source_id ? String(row.training_source_id) : null,
    effectiveDate: toIsoDate(row.effective_date as Date | string | null),
    expirationDate: toIsoDate(row.expiration_date as Date | string | null),
    reviewStatus: row.review_status as ReadinessStatus,
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapAuditEvent(row: Record<string, unknown>): ReadinessAuditEvent {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    requirementStatusId: row.requirement_status_id ? String(row.requirement_status_id) : null,
    evidenceId: row.evidence_id ? String(row.evidence_id) : null,
    eventType: String(row.event_type),
    message: String(row.message),
    actorUserId: String(row.actor_user_id),
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapSafetyPlan(row: Record<string, unknown>): SafetyPlan {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    engagementId: String(row.engagement_id),
    contractorId: String(row.contractor_id),
    title: String(row.title),
    planType: row.plan_type as SafetyPlan["planType"],
    customPlanType: row.custom_plan_type ? String(row.custom_plan_type) : null,
    currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : null,
    reviewStatus: row.review_status as SafetyPlan["reviewStatus"],
    approvedAt: row.approved_at ? new Date(row.approved_at as string).toISOString() : null,
    approvedByUserId: row.approved_by_user_id ? String(row.approved_by_user_id) : null,
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapSafetyPlanRevision(row: Record<string, unknown>, source?: SourceRecord): SafetyPlanRevision {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    sourceId: String(row.source_id),
    revisionIdentifier: String(row.revision_identifier),
    submittedDate: toIsoDate(row.submitted_date as Date | string | null),
    priorRevisionId: row.prior_revision_id ? String(row.prior_revision_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    source
  };
}

function mapPlanReview(row: Record<string, unknown>): PlanReview {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    revisionId: String(row.revision_id),
    status: row.status as PlanReview["status"],
    assistantProvider: row.assistant_provider ? String(row.assistant_provider) : null,
    assistantModel: row.assistant_model ? String(row.assistant_model) : null,
    processingStatus: row.processing_status as PlanReview["processingStatus"],
    errorState: row.error_state ? String(row.error_state) : null,
    promptConfigVersion: row.prompt_config_version ? String(row.prompt_config_version) : null,
    contractorFacingSummary: String(row.contractor_facing_summary ?? ""),
    internalReviewerNotes: row.internal_reviewer_notes ? String(row.internal_reviewer_notes) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapPlanReference(row: Record<string, unknown>, source?: SourceRecord): PlanReviewReference {
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    sourceId: String(row.source_id),
    sourceChunkId: row.source_chunk_id ? String(row.source_chunk_id) : null,
    authorityClassification: row.authority_classification as PlanReviewReference["authorityClassification"],
    citationLabel: row.citation_label ? String(row.citation_label) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    source
  };
}

function mapPlanFinding(row: Record<string, unknown>): PlanFinding {
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    title: String(row.title),
    findingType: row.finding_type as PlanFinding["findingType"],
    authority: row.authority as PlanFinding["authority"],
    planSourceId: row.plan_source_id ? String(row.plan_source_id) : null,
    planSourceChunkId: row.plan_source_chunk_id ? String(row.plan_source_chunk_id) : null,
    referenceSourceId: row.reference_source_id ? String(row.reference_source_id) : null,
    referenceSourceChunkId: row.reference_source_chunk_id ? String(row.reference_source_chunk_id) : null,
    referenceCitationLabel: row.reference_citation_label ? String(row.reference_citation_label) : null,
    aiExplanation: row.ai_explanation ? String(row.ai_explanation) : null,
    reviewerExplanation: row.reviewer_explanation ? String(row.reviewer_explanation) : null,
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    contractorFacingRecommendation: row.contractor_facing_recommendation ? String(row.contractor_facing_recommendation) : null,
    recommendedRevisionText: row.recommended_revision_text ? String(row.recommended_revision_text) : null,
    reviewerDecision: row.reviewer_decision ? String(row.reviewer_decision) : null,
    resolved: Boolean(row.resolved),
    notApplicable: Boolean(row.not_applicable),
    origin: row.origin as PlanFinding["origin"],
    sortOrder: Number(row.sort_order),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapComparison(row: Record<string, unknown>): ResubmissionComparison {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    priorRevisionId: String(row.prior_revision_id),
    newRevisionId: String(row.new_revision_id),
    findingId: String(row.finding_id),
    resolutionStatus: row.resolution_status as ResubmissionComparison["resolutionStatus"],
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapPlanAuditEvent(row: Record<string, unknown>): PlanReviewAuditEvent {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    reviewId: row.review_id ? String(row.review_id) : null,
    eventType: String(row.event_type),
    message: String(row.message),
    actorUserId: String(row.actor_user_id),
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapObservation(row: Record<string, unknown>, engagement?: ProjectContractorEngagement): FieldObservation {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    engagementId: row.engagement_id ? String(row.engagement_id) : null,
    contractorId: row.contractor_id ? String(row.contractor_id) : null,
    creatorUserId: String(row.creator_user_id),
    originalText: String(row.original_text),
    observedAt: new Date(row.observed_at as string).toISOString(),
    location: row.location ? String(row.location) : null,
    activity: row.activity ? String(row.activity) : null,
    derivedClassification: row.derived_classification as FieldObservation["derivedClassification"],
    category: row.category ? String(row.category) : null,
    derivedSummary: row.derived_summary ? String(row.derived_summary) : null,
    reviewerNote: row.reviewer_note ? String(row.reviewer_note) : null,
    followUpStatus: row.follow_up_status as FieldObservation["followUpStatus"],
    followUpNote: row.follow_up_note ? String(row.follow_up_note) : null,
    followUpDueDate: toIsoDate(row.follow_up_due_date as Date | string | null),
    followUpVerifiedAt: row.follow_up_verified_at ? new Date(row.follow_up_verified_at as string).toISOString() : null,
    followUpVerifiedByUserId: row.follow_up_verified_by_user_id ? String(row.follow_up_verified_by_user_id) : null,
    aiSuggestionStatus: row.ai_suggestion_status as FieldObservation["aiSuggestionStatus"],
    suggestedClassification: row.suggested_classification as FieldObservation["suggestedClassification"],
    suggestedCategory: row.suggested_category ? String(row.suggested_category) : null,
    suggestedActivity: row.suggested_activity ? String(row.suggested_activity) : null,
    suggestedSummary: row.suggested_summary ? String(row.suggested_summary) : null,
    suggestedFollowUpStatus: row.suggested_follow_up_status as FieldObservation["suggestedFollowUpStatus"],
    aiErrorState: row.ai_error_state ? String(row.ai_error_state) : null,
    aiSuggestionsRejected: Boolean(row.ai_suggestions_rejected),
    recurrenceCount: Number(row.recurrence_count ?? 0),
    recurrenceSummary: row.recurrence_summary ? String(row.recurrence_summary) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    engagement
  };
}

function mapObservationPhoto(row: Record<string, unknown>, source?: SourceRecord): ObservationPhoto {
  return {
    id: String(row.id),
    observationId: String(row.observation_id),
    sourceId: String(row.source_id),
    caption: row.caption ? String(row.caption) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    source
  };
}

function mapObservationReference(row: Record<string, unknown>, source?: SourceRecord): ObservationReferenceLink {
  return {
    id: String(row.id),
    observationId: String(row.observation_id),
    sourceId: String(row.source_id),
    sourceChunkId: row.source_chunk_id ? String(row.source_chunk_id) : null,
    citationLabel: row.citation_label ? String(row.citation_label) : null,
    suggested: Boolean(row.suggested),
    accepted: Boolean(row.accepted),
    createdAt: new Date(row.created_at as string).toISOString(),
    source
  };
}

function mapObservationPlanFindingLink(row: Record<string, unknown>, finding?: PlanFinding): ObservationPlanFindingLink {
  return {
    id: String(row.id),
    observationId: String(row.observation_id),
    findingId: String(row.finding_id),
    suggested: Boolean(row.suggested),
    accepted: Boolean(row.accepted),
    note: row.note ? String(row.note) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    finding
  };
}

function mapObservationAudit(row: Record<string, unknown>): ObservationAuditEvent {
  return {
    id: String(row.id),
    observationId: String(row.observation_id),
    eventType: String(row.event_type),
    message: String(row.message),
    actorUserId: String(row.actor_user_id),
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapIncident(row: Record<string, unknown>, engagement?: ProjectContractorEngagement): IncidentRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    engagementId: row.engagement_id ? String(row.engagement_id) : null,
    contractorId: row.contractor_id ? String(row.contractor_id) : null,
    creatorUserId: String(row.creator_user_id),
    incidentDateTime: new Date(row.incident_date_time as string).toISOString(),
    reportedAt: new Date(row.reported_at as string).toISOString(),
    location: row.location ? String(row.location) : null,
    activity: row.activity ? String(row.activity) : null,
    factualDescription: String(row.factual_description),
    incidentCategory: row.incident_category as IncidentRecord["incidentCategory"],
    contractorReportedClassification: row.contractor_reported_classification ? String(row.contractor_reported_classification) : null,
    contractorInvestigationStatus: row.contractor_investigation_status as IncidentRecord["contractorInvestigationStatus"],
    oversightStatus: row.oversight_status as IncidentRecord["oversightStatus"],
    affectedWorkDisposition: row.affected_work_disposition as IncidentRecord["affectedWorkDisposition"],
    affectedWorkScope: row.affected_work_scope ? String(row.affected_work_scope) : null,
    aiReviewStatus: row.ai_review_status as IncidentRecord["aiReviewStatus"],
    aiSummary: row.ai_summary ? String(row.ai_summary) : null,
    aiSuggestedConcerns: row.ai_suggested_concerns ? String(row.ai_suggested_concerns) : null,
    aiSuggestedQuestions: row.ai_suggested_questions ? String(row.ai_suggested_questions) : null,
    aiErrorState: row.ai_error_state ? String(row.ai_error_state) : null,
    closedAt: row.closed_at ? new Date(row.closed_at as string).toISOString() : null,
    closedByUserId: row.closed_by_user_id ? String(row.closed_by_user_id) : null,
    closureNote: row.closure_note ? String(row.closure_note) : null,
    projectOutcome: row.project_outcome ? String(row.project_outcome) : null,
    unresolvedContractorItems: row.unresolved_contractor_items ? String(row.unresolved_contractor_items) : null,
    reopenedAt: row.reopened_at ? new Date(row.reopened_at as string).toISOString() : null,
    reopenedByUserId: row.reopened_by_user_id ? String(row.reopened_by_user_id) : null,
    reopenReason: row.reopen_reason ? String(row.reopen_reason) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    engagement
  };
}

function mapIncidentAttachment(row: Record<string, unknown>, source?: SourceRecord): IncidentAttachment {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    sourceId: String(row.source_id),
    role: row.role as IncidentAttachment["role"],
    receivedAt: new Date(row.received_at as string).toISOString(),
    notes: row.notes ? String(row.notes) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    source
  };
}

function mapCorrectiveAction(row: Record<string, unknown>, source?: SourceRecord): ContractorCorrectiveAction {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    description: String(row.description),
    sourceId: row.source_id ? String(row.source_id) : null,
    targetDate: toIsoDate(row.target_date as Date | string | null),
    contractorStatus: row.contractor_status as ContractorCorrectiveAction["contractorStatus"],
    evidenceReceived: Boolean(row.evidence_received),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    source
  };
}

function mapIncidentProjectReview(row: Record<string, unknown>): IncidentProjectReview {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    reviewerAnalysis: row.reviewer_analysis ? String(row.reviewer_analysis) : null,
    remainingExposure: row.remaining_exposure ? String(row.remaining_exposure) : null,
    planProcedureConcerns: row.plan_procedure_concerns ? String(row.plan_procedure_concerns) : null,
    correctiveActionAdequacy: row.corrective_action_adequacy ? String(row.corrective_action_adequacy) : null,
    additionalInformationNeeded: row.additional_information_needed ? String(row.additional_information_needed) : null,
    managementReviewNeeded: Boolean(row.management_review_needed),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapIncidentRecommendation(row: Record<string, unknown>): IncidentRecommendation {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    recommendationType: row.recommendation_type as IncidentRecommendation["recommendationType"],
    recommendationText: String(row.recommendation_text),
    status: row.status as IncidentRecommendation["status"],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapProjectSafetyDecision(row: Record<string, unknown>, source?: SourceRecord): ProjectSafetyDecision {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    projectId: String(row.project_id),
    decisionText: String(row.decision_text),
    appliesToScope: row.applies_to_scope ? String(row.applies_to_scope) : null,
    effectiveDate: toIsoDate(row.effective_date as Date | string | null),
    status: row.status as ProjectSafetyDecision["status"],
    decisionMakerUserId: String(row.decision_maker_user_id),
    rationale: row.rationale ? String(row.rationale) : null,
    supportingSourceId: row.supporting_source_id ? String(row.supporting_source_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    source
  };
}

function mapIncidentFollowUp(row: Record<string, unknown>, source?: SourceRecord, observation?: FieldObservation): IncidentFollowUp {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    status: row.status as IncidentFollowUp["status"],
    verificationNote: row.verification_note ? String(row.verification_note) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at as string).toISOString() : null,
    verifierUserId: String(row.verifier_user_id),
    linkedSourceId: row.linked_source_id ? String(row.linked_source_id) : null,
    linkedObservationId: row.linked_observation_id ? String(row.linked_observation_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    source,
    observation
  };
}

function mapIncidentLink(row: Record<string, unknown>, finding?: PlanFinding, observation?: FieldObservation): IncidentLink {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    planFindingId: row.plan_finding_id ? String(row.plan_finding_id) : null,
    observationId: row.observation_id ? String(row.observation_id) : null,
    suggested: Boolean(row.suggested),
    accepted: Boolean(row.accepted),
    note: row.note ? String(row.note) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    finding,
    observation
  };
}

function mapIncidentAudit(row: Record<string, unknown>): IncidentAuditEvent {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    eventType: String(row.event_type),
    message: String(row.message),
    actorUserId: String(row.actor_user_id),
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapReport(row: Record<string, unknown>): SafetyReport {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    reportType: row.report_type as SafetyReport["reportType"],
    format: row.format as SafetyReport["format"],
    periodStart: toIsoDate(row.period_start as Date | string) as string,
    periodEnd: toIsoDate(row.period_end as Date | string) as string,
    title: String(row.title),
    status: row.status as SafetyReport["status"],
    generationStatus: row.generation_status as SafetyReport["generationStatus"],
    generationProvider: row.generation_provider ? String(row.generation_provider) : null,
    generationModel: row.generation_model ? String(row.generation_model) : null,
    errorState: row.error_state ? String(row.error_state) : null,
    scope: normalizeReportScope(row.scope as Partial<ReportScopeInput> | undefined),
    manualInputs: normalizeManualInputs(row.manual_inputs as Partial<ReportManualInputs> | undefined),
    currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : null,
    createdByUserId: String(row.created_by_user_id),
    finalizedAt: row.finalized_at ? new Date(row.finalized_at as string).toISOString() : null,
    finalizedByUserId: row.finalized_by_user_id ? String(row.finalized_by_user_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapReportRevision(row: Record<string, unknown>): SafetyReportRevision {
  return {
    id: String(row.id),
    reportId: String(row.report_id),
    revisionNumber: Number(row.revision_number),
    status: row.status as SafetyReportRevision["status"],
    title: String(row.title),
    contentMarkdown: String(row.content_markdown ?? ""),
    contentJson: (row.content_json ?? {}) as Record<string, unknown>,
    evidenceManifest: (row.evidence_manifest ?? emptyReportManifest("", "")) as ReportEvidenceManifest,
    createdByUserId: String(row.created_by_user_id),
    createdAt: new Date(row.created_at as string).toISOString(),
    finalizedAt: row.finalized_at ? new Date(row.finalized_at as string).toISOString() : null,
    finalizedByUserId: row.finalized_by_user_id ? String(row.finalized_by_user_id) : null
  };
}

function mapReportAudit(row: Record<string, unknown>): SafetyReportAuditEvent {
  return {
    id: String(row.id),
    reportId: String(row.report_id),
    revisionId: row.revision_id ? String(row.revision_id) : null,
    eventType: String(row.event_type),
    message: String(row.message),
    actorUserId: String(row.actor_user_id),
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function normalizeAssistantContext(value: unknown, projectId: string): AssistantContext {
  const context = (value ?? {}) as Partial<AssistantContext>;
  return {
    projectId,
    contractorId: context.contractorId ?? null,
    retrievalScope: context.retrievalScope ?? "current_project",
    selectedProjectIds: context.selectedProjectIds ?? [],
    activeSkillId: context.activeSkillId ?? null
  };
}

function emptyManifest(projectId = ""): AssistantRetrievalManifest {
  return { scope: "current_project", projectIds: projectId ? [projectId] : [], contractorId: null, sourceIds: [], sourceChunkIds: [], operationalRecords: [], memoryIds: [], instructionIds: [], skillId: null, skillVersion: null };
}

function emptyContextSummary(): AssistantContextSummary {
  return { scope: "current_project", sources: 0, sourceChunks: 0, operationalRecords: 0, memoryEntries: 0, instructions: [], activeSkill: null, activeSkillVersion: null };
}

function mapAssistantConversation(row: Record<string, unknown>): AssistantConversation {
  return { id: String(row.id), projectId: String(row.project_id), ownerUserId: String(row.owner_user_id), title: String(row.title), context: normalizeAssistantContext(row.context, String(row.project_id)), createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() };
}

function mapAssistantMessage(row: Record<string, unknown>): AssistantMessage {
  return { id: String(row.id), conversationId: String(row.conversation_id), role: row.role as AssistantMessage["role"], content: String(row.content), provider: row.provider ? String(row.provider) : null, model: row.model ? String(row.model) : null, runId: row.run_id ? String(row.run_id) : null, createdAt: new Date(row.created_at as string).toISOString() };
}

function mapAssistantRun(row: Record<string, unknown>): AssistantRun {
  return { id: String(row.id), conversationId: row.conversation_id ? String(row.conversation_id) : null, status: row.status as AssistantRun["status"], provider: row.provider ? String(row.provider) : null, model: row.model ? String(row.model) : null, contextSummary: (row.context_summary ?? emptyContextSummary()) as AssistantContextSummary, retrievalManifest: (row.retrieval_manifest ?? emptyManifest()) as AssistantRetrievalManifest, errorState: row.error_state ? String(row.error_state) : null, createdAt: new Date(row.created_at as string).toISOString(), completedAt: row.completed_at ? new Date(row.completed_at as string).toISOString() : null };
}

function mapMemoryEntry(row: Record<string, unknown>): MemoryEntry {
  return { id: String(row.id), scope: row.scope as MemoryEntry["scope"], projectId: row.project_id ? String(row.project_id) : null, content: String(row.content), provenanceType: row.provenance_type ? String(row.provenance_type) : null, provenanceId: row.provenance_id ? String(row.provenance_id) : null, createdByUserId: String(row.created_by_user_id), confirmedByUserId: row.confirmed_by_user_id ? String(row.confirmed_by_user_id) : null, active: Boolean(row.active), createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() };
}

function mapInstructionDocument(row: Record<string, unknown>): InstructionDocument {
  return { id: String(row.id), scope: row.scope as InstructionDocument["scope"], projectId: row.project_id ? String(row.project_id) : null, area: String(row.area), title: String(row.title), markdown: String(row.markdown), version: Number(row.version), active: Boolean(row.active), createdByUserId: String(row.created_by_user_id), updatedByUserId: String(row.updated_by_user_id), createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() };
}

function mapAssistantSkill(row: Record<string, unknown>): AssistantSkill {
  return { id: String(row.id), scope: row.scope as AssistantSkill["scope"], projectId: row.project_id ? String(row.project_id) : null, name: String(row.name), description: String(row.description), triggerDescription: String(row.trigger_description), guidedPurpose: row.guided_purpose ? String(row.guided_purpose) : null, guidedInputs: row.guided_inputs ? String(row.guided_inputs) : null, guidedOutputs: row.guided_outputs ? String(row.guided_outputs) : null, guidedRules: row.guided_rules ? String(row.guided_rules) : null, guidedAuthorityLimits: row.guided_authority_limits ? String(row.guided_authority_limits) : null, markdown: String(row.markdown), version: Number(row.version), active: Boolean(row.active), createdByUserId: String(row.created_by_user_id), updatedByUserId: String(row.updated_by_user_id), createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() };
}

function mapProposedAction(row: Record<string, unknown>): ProposedAction {
  return { id: String(row.id), conversationId: row.conversation_id ? String(row.conversation_id) : null, originMessageId: row.origin_message_id ? String(row.origin_message_id) : null, actionName: String(row.action_name), targetType: String(row.target_type), targetId: row.target_id ? String(row.target_id) : null, currentState: (row.current_state ?? {}) as Record<string, unknown>, proposedChange: (row.proposed_change ?? {}) as Record<string, unknown>, rationale: row.rationale ? String(row.rationale) : null, evidence: (row.evidence ?? emptyManifest()) as AssistantRetrievalManifest, createdByUserId: String(row.created_by_user_id), status: row.status as ProposedAction["status"], confirmedByUserId: row.confirmed_by_user_id ? String(row.confirmed_by_user_id) : null, confirmationNote: row.confirmation_note ? String(row.confirmation_note) : null, rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null, executedResult: row.executed_result ? row.executed_result as Record<string, unknown> : null, errorState: row.error_state ? String(row.error_state) : null, createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() };
}

export class PostgresStore implements AppStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async migrate(): Promise<void> {
    await this.pool.query(initialMigration);
  }

  async ensureBootstrapUser(user: { email: string; displayName: string; passwordHash: string }): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [user.email.toLowerCase(), user.displayName, user.passwordHash]
    );
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserBySessionTokenHash(tokenHash: string): Promise<StoredUser | null> {
    const result = await this.pool.query(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [tokenHash]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
      userId,
      tokenHash,
      expiresAt
    ]);
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  async listProjects(userId: string): Promise<Project[]> {
    const result = await this.pool.query("SELECT * FROM projects WHERE owner_user_id = $1 ORDER BY created_at DESC", [
      userId
    ]);
    return result.rows.map(mapProject);
  }

  async createProject(userId: string, input: ProjectCreateInput): Promise<Project> {
    const result = await this.pool.query(
      `INSERT INTO projects
       (owner_user_id, name, project_identifier, location, federal_classification, description, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        input.name.trim(),
        clean(input.projectIdentifier),
        input.location.trim(),
        input.federalClassification,
        clean(input.description),
        clean(input.startDate),
        clean(input.endDate)
      ]
    );
    return mapProject(result.rows[0]);
  }

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const result = await this.pool.query("SELECT * FROM projects WHERE owner_user_id = $1 AND id = $2", [
      userId,
      projectId
    ]);
    return result.rows[0] ? mapProject(result.rows[0]) : null;
  }

  async listContractors(userId: string): Promise<Contractor[]> {
    const result = await this.pool.query("SELECT * FROM contractors WHERE owner_user_id = $1 ORDER BY legal_name", [
      userId
    ]);
    return result.rows.map(mapContractor);
  }

  async createContractor(userId: string, input: ContractorCreateInput): Promise<Contractor> {
    const result = await this.pool.query(
      `INSERT INTO contractors
       (owner_user_id, legal_name, trade, primary_contact_name, primary_contact_email, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        input.legalName.trim(),
        clean(input.trade),
        clean(input.primaryContactName),
        clean(input.primaryContactEmail),
        clean(input.phone)
      ]
    );
    return mapContractor(result.rows[0]);
  }

  async getContractor(userId: string, contractorId: string): Promise<Contractor | null> {
    const result = await this.pool.query("SELECT * FROM contractors WHERE owner_user_id = $1 AND id = $2", [
      userId,
      contractorId
    ]);
    return result.rows[0] ? mapContractor(result.rows[0]) : null;
  }

  async listProjectEngagements(userId: string, projectId: string): Promise<ProjectContractorEngagement[]> {
    const result = await this.pool.query(
      `SELECT e.*, c.id AS c_id, c.owner_user_id AS c_owner_user_id, c.legal_name, c.trade,
              c.primary_contact_name, c.primary_contact_email, c.phone,
              c.created_at AS c_created_at, c.updated_at AS c_updated_at
       FROM project_contractor_engagements e
       JOIN projects p ON p.id = e.project_id
       JOIN contractors c ON c.id = e.contractor_id
       WHERE p.owner_user_id = $1 AND e.project_id = $2
       ORDER BY e.created_at DESC`,
      [userId, projectId]
    );
    return result.rows.map((row) =>
      mapEngagement(row, mapContractor({
        id: row.c_id,
        owner_user_id: row.c_owner_user_id,
        legal_name: row.legal_name,
        trade: row.trade,
        primary_contact_name: row.primary_contact_name,
        primary_contact_email: row.primary_contact_email,
        phone: row.phone,
        created_at: row.c_created_at,
        updated_at: row.c_updated_at
      }))
    );
  }

  async createProjectEngagement(
    userId: string,
    projectId: string,
    input: EngagementCreateInput
  ): Promise<ProjectContractorEngagement> {
    const project = await this.getProject(userId, projectId);
    if (!project) throw new Error("Project not found");
    let contractorId = input.contractorId;
    if (input.contractor) {
      const contractor = await this.createContractor(userId, input.contractor);
      contractorId = contractor.id;
    }
    if (!contractorId || !(await this.getContractor(userId, contractorId))) {
      throw new Error("Contractor not found");
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO project_contractor_engagements (project_id, contractor_id, scope_summary)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [projectId, contractorId, clean(input.scopeSummary)]
      );
      return (await this.getProjectEngagement(userId, projectId, result.rows[0].id)) ?? mapEngagement(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateEngagementError();
      throw error;
    }
  }

  async getProjectEngagement(
    userId: string,
    projectId: string,
    engagementId: string
  ): Promise<ProjectContractorEngagement | null> {
    const engagements = await this.listProjectEngagements(userId, projectId);
    return engagements.find((engagement) => engagement.id === engagementId) ?? null;
  }

  async listSources(userId: string, filters: SourceSearchInput): Promise<SourceRecord[]> {
    const values: unknown[] = [userId];
    const clauses = ["s.owner_user_id = $1"];
    if (filters.scope) {
      values.push(filters.scope);
      clauses.push(`s.scope = $${values.length}`);
    }
    if (filters.sourceType) {
      values.push(filters.sourceType);
      clauses.push(`s.source_type = $${values.length}`);
    }
    if (filters.authorityClassification) {
      values.push(filters.authorityClassification);
      clauses.push(`s.authority_classification = $${values.length}`);
    }
    if (filters.projectId) {
      values.push(filters.projectId);
      clauses.push(`(s.project_id = $${values.length} OR EXISTS (SELECT 1 FROM project_sources ps WHERE ps.source_id = s.id AND ps.project_id = $${values.length}))`);
    }
    if (filters.activeOnly) {
      clauses.push("EXISTS (SELECT 1 FROM project_sources ps WHERE ps.source_id = s.id AND ps.activation_status = 'active')");
    }
    if (filters.q) {
      values.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(`(lower(s.title) LIKE $${values.length} OR lower(coalesce(s.original_filename, '')) LIKE $${values.length} OR EXISTS (SELECT 1 FROM source_chunks sc WHERE sc.source_id = s.id AND lower(sc.text) LIKE $${values.length}))`);
    }
    const result = await this.pool.query(`SELECT s.* FROM sources s WHERE ${clauses.join(" AND ")} ORDER BY s.created_at DESC`, values);
    return result.rows.map(mapSource);
  }

  async createSource(
    userId: string,
    input: Omit<SourceRecord, "ownerUserId" | "createdAt" | "updatedAt" | "uploadedAt">
  ): Promise<SourceRecord> {
    const result = await this.pool.query(
      `INSERT INTO sources
       (id, owner_user_id, title, original_filename, mime_type, source_type, scope, project_id,
        authority_classification, user_confirmed_classification, ai_suggested_classification,
        storage_key, original_url, size_bytes, processing_status, extraction_status,
        extraction_version, failure_reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        input.id,
        userId,
        input.title,
        input.originalFilename,
        input.mimeType,
        input.sourceType,
        input.scope,
        input.projectId,
        input.authorityClassification,
        input.userConfirmedClassification,
        input.aiSuggestedClassification,
        input.storageKey,
        input.originalUrl,
        input.sizeBytes,
        input.processingStatus,
        input.extractionStatus,
        input.extractionVersion,
        input.failureReason,
        input.metadata
      ]
    );
    const source = mapSource(result.rows[0]);
    if (source.projectId) {
      try {
        await this.associateSourceToProject(userId, source.projectId, { sourceId: source.id, activationStatus: "associated" });
      } catch (error) {
        if (!(error instanceof DuplicateProjectSourceError)) throw error;
      }
    }
    return source;
  }

  async updateSourceProcessing(
    userId: string,
    sourceId: string,
    input: Pick<SourceRecord, "processingStatus" | "extractionStatus" | "extractionVersion" | "failureReason" | "metadata">
  ): Promise<SourceRecord> {
    const result = await this.pool.query(
      `UPDATE sources
       SET processing_status = $3, extraction_status = $4, extraction_version = $5,
           failure_reason = $6, metadata = $7, updated_at = now()
       WHERE owner_user_id = $1 AND id = $2
       RETURNING *`,
      [userId, sourceId, input.processingStatus, input.extractionStatus, input.extractionVersion, input.failureReason, input.metadata]
    );
    if (!result.rows[0]) throw new Error("Source not found");
    return mapSource(result.rows[0]);
  }

  async updateSource(userId: string, sourceId: string, input: SourceUpdateInput): Promise<SourceRecord | null> {
    const current = await this.getSource(userId, sourceId);
    if (!current) return null;
    const result = await this.pool.query(
      `UPDATE sources
       SET title = $3, authority_classification = $4, user_confirmed_classification = $5, updated_at = now()
       WHERE owner_user_id = $1 AND id = $2
       RETURNING *`,
      [
        userId,
        sourceId,
        input.title ?? current.title,
        input.authorityClassification ?? current.authorityClassification,
        input.userConfirmedClassification ?? current.userConfirmedClassification
      ]
    );
    return result.rows[0] ? mapSource(result.rows[0]) : null;
  }

  async getSource(userId: string, sourceId: string): Promise<SourceDetail | null> {
    const result = await this.pool.query("SELECT * FROM sources WHERE owner_user_id = $1 AND id = $2", [userId, sourceId]);
    if (!result.rows[0]) return null;
    const source = mapSource(result.rows[0]);
    const chunks = await this.pool.query("SELECT * FROM source_chunks WHERE source_id = $1 ORDER BY chunk_index", [sourceId]);
    const links = await this.pool.query("SELECT * FROM project_sources WHERE source_id = $1 ORDER BY created_at DESC", [sourceId]);
    return { ...source, chunks: chunks.rows.map(mapChunk), projectLinks: links.rows.map((row) => mapProjectSource(row, source)) };
  }

  async addSourceChunks(userId: string, sourceId: string, chunks: SourceChunk[]): Promise<void> {
    if (!(await this.getSource(userId, sourceId))) throw new Error("Source not found");
    await this.pool.query("DELETE FROM source_chunks WHERE source_id = $1", [sourceId]);
    for (const chunk of chunks) {
      await this.pool.query(
        `INSERT INTO source_chunks (id, source_id, chunk_index, text, location_label, citation)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [chunk.id, sourceId, chunk.chunkIndex, chunk.text, chunk.locationLabel, chunk.citation]
      );
    }
  }

  async associateSourceToProject(userId: string, projectId: string, input: ProjectSourceInput): Promise<ProjectSourceLink> {
    if (!(await this.getProject(userId, projectId))) throw new Error("Project not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    try {
      const result = await this.pool.query(
        `INSERT INTO project_sources (project_id, source_id, activation_status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [projectId, input.sourceId, input.activationStatus]
      );
      return mapProjectSource(result.rows[0], source);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateProjectSourceError();
      throw error;
    }
  }

  async listProjectSources(userId: string, projectId: string): Promise<ProjectSourceLink[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    const result = await this.pool.query(
      `SELECT ps.*, s.id AS s_id, s.owner_user_id, s.title, s.original_filename, s.mime_type, s.source_type, s.scope,
              s.project_id, s.authority_classification, s.user_confirmed_classification, s.ai_suggested_classification,
              s.storage_key, s.original_url, s.size_bytes, s.processing_status, s.extraction_status,
              s.extraction_version, s.failure_reason, s.metadata, s.uploaded_at, s.created_at AS s_created_at,
              s.updated_at AS s_updated_at
       FROM project_sources ps
       JOIN sources s ON s.id = ps.source_id
       WHERE ps.project_id = $1 AND s.owner_user_id = $2
       ORDER BY ps.created_at DESC`,
      [projectId, userId]
    );
    return result.rows.map((row) => mapProjectSource(row, mapSource({
      id: row.s_id,
      owner_user_id: row.owner_user_id,
      title: row.title,
      original_filename: row.original_filename,
      mime_type: row.mime_type,
      source_type: row.source_type,
      scope: row.scope,
      project_id: row.project_id,
      authority_classification: row.authority_classification,
      user_confirmed_classification: row.user_confirmed_classification,
      ai_suggested_classification: row.ai_suggested_classification,
      storage_key: row.storage_key,
      original_url: row.original_url,
      size_bytes: row.size_bytes,
      processing_status: row.processing_status,
      extraction_status: row.extraction_status,
      extraction_version: row.extraction_version,
      failure_reason: row.failure_reason,
      metadata: row.metadata,
      uploaded_at: row.uploaded_at,
      created_at: row.s_created_at,
      updated_at: row.s_updated_at
    })));
  }

  async updateProjectSourceActivation(
    userId: string,
    projectId: string,
    sourceId: string,
    input: ProjectSourceActivationInput
  ): Promise<ProjectSourceLink | null> {
    if (!(await this.getProject(userId, projectId))) return null;
    const result = await this.pool.query(
      `UPDATE project_sources
       SET activation_status = $3, updated_at = now()
       WHERE project_id = $1 AND source_id = $2
       RETURNING *`,
      [projectId, sourceId, input.activationStatus]
    );
    if (!result.rows[0]) return null;
    const source = await this.getSource(userId, sourceId);
    return mapProjectSource(result.rows[0], source ?? undefined);
  }

  async removeSourceFromProject(userId: string, projectId: string, sourceId: string): Promise<void> {
    if (!(await this.getProject(userId, projectId))) return;
    await this.pool.query("DELETE FROM project_sources WHERE project_id = $1 AND source_id = $2", [projectId, sourceId]);
  }

  async searchSourceChunks(userId: string, filters: SourceSearchInput): Promise<SourceChunk[]> {
    const sources = await this.listSources(userId, { ...filters, q: undefined });
    if (sources.length === 0) return [];
    const sourceIds = sources.map((source) => source.id);
    const values: unknown[] = [sourceIds];
    const clauses = ["source_id = ANY($1::uuid[])"];
    if (filters.q) {
      values.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(`lower(text) LIKE $${values.length}`);
    }
    const result = await this.pool.query(`SELECT * FROM source_chunks WHERE ${clauses.join(" AND ")} ORDER BY source_id, chunk_index LIMIT 50`, values);
    return result.rows.map(mapChunk);
  }

  async listReadinessRequirements(userId: string, projectId: string): Promise<ReadinessRequirement[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    const result = await this.pool.query("SELECT * FROM readiness_requirements WHERE project_id = $1 ORDER BY created_at DESC", [projectId]);
    return result.rows.map(mapReadinessRequirement);
  }

  async createReadinessRequirement(userId: string, projectId: string, input: ReadinessRequirementCreateInput): Promise<ReadinessRequirement> {
    if (!(await this.getProject(userId, projectId))) throw new Error("Project not found");
    if (input.sourceId && !(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const result = await this.pool.query(
      `INSERT INTO readiness_requirements
       (project_id, title, description, category, source_id, source_chunk_id, citation_label, required, blocking, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        projectId,
        input.title.trim(),
        clean(input.description),
        input.category?.trim() || "Other",
        clean(input.sourceId),
        clean(input.sourceChunkId),
        clean(input.citationLabel),
        input.required,
        input.blocking,
        clean(input.dueDate)
      ]
    );
    return mapReadinessRequirement(result.rows[0]);
  }

  async updateReadinessRequirement(
    userId: string,
    projectId: string,
    requirementId: string,
    input: ReadinessRequirementUpdateInput
  ): Promise<ReadinessRequirement | null> {
    const current = (await this.listReadinessRequirements(userId, projectId)).find((requirement) => requirement.id === requirementId);
    if (!current) return null;
    if (input.sourceId && !(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const result = await this.pool.query(
      `UPDATE readiness_requirements
       SET title = $3, description = $4, category = $5, source_id = $6, source_chunk_id = $7,
           citation_label = $8, required = $9, blocking = $10, due_date = $11, updated_at = now()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        requirementId,
        input.title ?? current.title,
        input.description === undefined ? current.description : clean(input.description),
        input.category ?? current.category,
        input.sourceId === undefined ? current.sourceId : clean(input.sourceId),
        input.sourceChunkId === undefined ? current.sourceChunkId : clean(input.sourceChunkId),
        input.citationLabel === undefined ? current.citationLabel : clean(input.citationLabel),
        input.required ?? current.required,
        input.blocking ?? current.blocking,
        input.dueDate === undefined ? current.dueDate : clean(input.dueDate)
      ]
    );
    return result.rows[0] ? mapReadinessRequirement(result.rows[0]) : null;
  }

  async applyRequirementToEngagement(
    userId: string,
    engagementId: string,
    input: ContractorRequirementApplyInput
  ): Promise<ContractorRequirementStatus> {
    const engagement = await this.getEngagementForUser(userId, engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    const requirement = (await this.listReadinessRequirements(userId, engagement.projectId)).find((item) => item.id === input.requirementId);
    if (!requirement) throw new Error("Readiness requirement not found");
    try {
      const result = await this.pool.query(
        `INSERT INTO contractor_requirement_statuses (requirement_id, engagement_id, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.requirementId, engagementId, requirement.required ? "required" : "not_applicable"]
      );
      const status = mapRequirementStatus(result.rows[0], requirement);
      await this.addAudit(userId, engagementId, status.id, null, "requirement_applied", `Applied requirement: ${requirement.title}`);
      return status;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateRequirementApplicationError();
      throw error;
    }
  }

  async listContractorRequirementStatuses(userId: string, engagementId: string): Promise<ContractorRequirementStatus[]> {
    const engagement = await this.getEngagementForUser(userId, engagementId);
    if (!engagement) return [];
    const result = await this.pool.query(
      `SELECT crs.*, rr.id AS rr_id, rr.project_id, rr.title, rr.description, rr.category, rr.source_id,
              rr.source_chunk_id, rr.citation_label, rr.required, rr.blocking, rr.due_date,
              rr.created_at AS rr_created_at, rr.updated_at AS rr_updated_at
       FROM contractor_requirement_statuses crs
       JOIN readiness_requirements rr ON rr.id = crs.requirement_id
       WHERE crs.engagement_id = $1
       ORDER BY rr.created_at DESC`,
      [engagementId]
    );
    return result.rows.map((row) => mapRequirementStatus(row, mapReadinessRequirement({
      id: row.rr_id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      category: row.category,
      source_id: row.source_id,
      source_chunk_id: row.source_chunk_id,
      citation_label: row.citation_label,
      required: row.required,
      blocking: row.blocking,
      due_date: row.due_date,
      created_at: row.rr_created_at,
      updated_at: row.rr_updated_at
    })));
  }

  async updateContractorRequirementStatus(
    userId: string,
    statusId: string,
    input: ContractorRequirementUpdateInput
  ): Promise<ContractorRequirementStatus | null> {
    const current = await this.getRequirementStatusForUser(userId, statusId);
    if (!current) return null;
    const reviewed = input.status && ["accepted", "rejected", "expired", "not_applicable", "replacement_requested"].includes(input.status);
    const result = await this.pool.query(
      `UPDATE contractor_requirement_statuses
       SET status = $2, reviewer_notes = $3, planned_mobilization_date = $4,
           reviewed_at = CASE WHEN $5::boolean THEN now() ELSE reviewed_at END,
           reviewed_by_user_id = CASE WHEN $5::boolean THEN $6 ELSE reviewed_by_user_id END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        statusId,
        input.status ?? current.status,
        input.reviewerNotes === undefined ? current.reviewerNotes : clean(input.reviewerNotes),
        input.plannedMobilizationDate === undefined ? current.plannedMobilizationDate : clean(input.plannedMobilizationDate),
        Boolean(reviewed),
        userId
      ]
    );
    const updated = mapRequirementStatus(result.rows[0], current.requirement);
    await this.addAudit(userId, updated.engagementId, statusId, null, "status_changed", `Requirement status changed to ${updated.status}`);
    return updated;
  }

  async attachReadinessEvidence(userId: string, input: ReadinessEvidenceCreateInput): Promise<ReadinessEvidence> {
    const status = await this.getRequirementStatusForUser(userId, input.requirementStatusId);
    if (!status) throw new Error("Requirement status not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    try {
      const result = await this.pool.query(
        `INSERT INTO readiness_evidence
         (requirement_status_id, source_id, source_chunk_id, evidence_role, review_status, extracted_metadata, reviewer_notes)
         VALUES ($1, $2, $3, $4, 'needs_review', $5, $6)
         RETURNING *`,
        [input.requirementStatusId, input.sourceId, clean(input.sourceChunkId), input.evidenceRole, input.extractedMetadata, clean(input.reviewerNotes)]
      );
      await this.updateContractorRequirementStatus(userId, status.id, { status: "received" });
      await this.addAudit(userId, status.engagementId, status.id, result.rows[0].id, "evidence_received", "Evidence attached; review still required");
      return mapReadinessEvidence(result.rows[0], source);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateEvidenceAssociationError();
      throw error;
    }
  }

  async reviewReadinessEvidence(userId: string, evidenceId: string, input: ReadinessEvidenceReviewInput): Promise<ReadinessEvidence | null> {
    const current = await this.getReadinessEvidenceForUser(userId, evidenceId);
    if (!current) return null;
    const result = await this.pool.query(
      `UPDATE readiness_evidence
       SET review_status = $2, reviewer_notes = $3, reviewed_at = now(), reviewed_by_user_id = $4, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [evidenceId, input.reviewStatus, input.reviewerNotes === undefined ? current.reviewerNotes : clean(input.reviewerNotes), userId]
    );
    const status = await this.getRequirementStatusForUser(userId, current.requirementStatusId);
    if (status) {
      await this.updateContractorRequirementStatus(userId, status.id, { status: input.reviewStatus });
      await this.addAudit(userId, status.engagementId, status.id, evidenceId, "evidence_reviewed", `Evidence marked ${input.reviewStatus}`);
    }
    const source = await this.getSource(userId, current.sourceId);
    return mapReadinessEvidence(result.rows[0], source ?? undefined);
  }

  async createSafetyMetric(userId: string, input: SafetyMetricCreateInput): Promise<SafetyMetric> {
    const engagement = await this.getEngagementForUser(userId, input.engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    if (!(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const result = await this.pool.query(
      `INSERT INTO safety_metrics
       (contractor_id, engagement_id, metric_type, metric_name, period_year, value, source_id, evidence_id, review_status, reviewer_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        engagement.contractorId,
        engagement.id,
        input.metricType,
        clean(input.metricName),
        input.periodYear,
        input.value,
        input.sourceId,
        clean(input.evidenceId),
        input.reviewStatus,
        clean(input.reviewerNotes)
      ]
    );
    const metric = mapSafetyMetric(result.rows[0]);
    await this.addAudit(userId, engagement.id, null, metric.evidenceId, "metric_recorded", `Recorded ${metric.metricType.toUpperCase()} ${metric.periodYear}`);
    return metric;
  }

  async createCompetentPersonEvidence(userId: string, input: CompetentPersonCreateInput): Promise<CompetentPersonEvidence> {
    const engagement = await this.getEngagementForUser(userId, input.engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    if (!(await this.getSource(userId, input.authorizationSourceId))) throw new Error("Source not found");
    if (input.trainingSourceId && !(await this.getSource(userId, input.trainingSourceId))) throw new Error("Source not found");
    const result = await this.pool.query(
      `INSERT INTO competent_person_evidence
       (engagement_id, contractor_id, person_name, designation, authorization_source_id, training_source_id,
        effective_date, expiration_date, review_status, reviewer_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        engagement.id,
        engagement.contractorId,
        input.personName.trim(),
        input.designation.trim(),
        input.authorizationSourceId,
        clean(input.trainingSourceId),
        clean(input.effectiveDate),
        clean(input.expirationDate),
        input.reviewStatus,
        clean(input.reviewerNotes)
      ]
    );
    const record = mapCompetentPerson(result.rows[0]);
    await this.addAudit(userId, engagement.id, null, null, "competent_person_recorded", `${record.personName} - ${record.designation}`);
    return record;
  }

  async getContractorReadiness(
    userId: string,
    engagementId: string,
    filters: { status?: string; category?: string } = {}
  ): Promise<ContractorReadinessDetail | null> {
    const engagement = await this.getEngagementForUser(userId, engagementId);
    if (!engagement) return null;
    const allRequirements = await this.listContractorRequirementStatuses(userId, engagementId);
    let requirements = allRequirements;
    if (filters.status) requirements = requirements.filter((status) => status.status === filters.status);
    if (filters.category) requirements = requirements.filter((status) => status.requirement?.category === filters.category);
    const statusIds = requirements.map((status) => status.id);
    const evidence = statusIds.length
      ? (await this.pool.query(
          `SELECT re.*, s.id AS s_id, s.owner_user_id, s.title, s.original_filename, s.mime_type, s.source_type, s.scope,
                  s.project_id, s.authority_classification, s.user_confirmed_classification, s.ai_suggested_classification,
                  s.storage_key, s.original_url, s.size_bytes, s.processing_status, s.extraction_status, s.extraction_version,
                  s.failure_reason, s.metadata, s.uploaded_at, s.created_at AS s_created_at, s.updated_at AS s_updated_at
           FROM readiness_evidence re
           JOIN sources s ON s.id = re.source_id
           WHERE re.requirement_status_id = ANY($1::uuid[])
           ORDER BY re.created_at DESC`,
          [statusIds]
        )).rows.map((row) => mapReadinessEvidence(row, mapSource({
          id: row.s_id,
          owner_user_id: row.owner_user_id,
          title: row.title,
          original_filename: row.original_filename,
          mime_type: row.mime_type,
          source_type: row.source_type,
          scope: row.scope,
          project_id: row.project_id,
          authority_classification: row.authority_classification,
          user_confirmed_classification: row.user_confirmed_classification,
          ai_suggested_classification: row.ai_suggested_classification,
          storage_key: row.storage_key,
          original_url: row.original_url,
          size_bytes: row.size_bytes,
          processing_status: row.processing_status,
          extraction_status: row.extraction_status,
          extraction_version: row.extraction_version,
          failure_reason: row.failure_reason,
          metadata: row.metadata,
          uploaded_at: row.uploaded_at,
          created_at: row.s_created_at,
          updated_at: row.s_updated_at
        })))
      : [];
    const metrics = (await this.pool.query("SELECT * FROM safety_metrics WHERE engagement_id = $1 ORDER BY created_at DESC", [engagementId])).rows.map(mapSafetyMetric);
    const competentPersons = (await this.pool.query("SELECT * FROM competent_person_evidence WHERE engagement_id = $1 ORDER BY created_at DESC", [engagementId])).rows.map(mapCompetentPerson);
    const auditEvents = (await this.pool.query("SELECT * FROM readiness_audit_events WHERE engagement_id = $1 ORDER BY created_at DESC LIMIT 100", [engagementId])).rows.map(mapAuditEvent);
    return { summary: this.summarizeReadiness(engagement, allRequirements), requirements, evidence, metrics, competentPersons, auditEvents };
  }

  async listProjectReadinessSummaries(userId: string, projectId: string): Promise<ContractorReadinessSummary[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    const engagements = await this.listProjectEngagements(userId, projectId);
    const summaries: ContractorReadinessSummary[] = [];
    for (const engagement of engagements) {
      summaries.push(this.summarizeReadiness(engagement, await this.listContractorRequirementStatuses(userId, engagement.id)));
    }
    return summaries;
  }

  async listSafetyPlans(userId: string, engagementId: string): Promise<SafetyPlan[]> {
    const engagement = await this.getEngagementForUser(userId, engagementId);
    if (!engagement) return [];
    const result = await this.pool.query("SELECT * FROM safety_plans WHERE engagement_id = $1 ORDER BY created_at DESC", [engagementId]);
    return result.rows.map(mapSafetyPlan);
  }

  async createSafetyPlan(userId: string, input: SafetyPlanCreateInput): Promise<SafetyPlanDetail> {
    const engagement = await this.getEngagementForUser(userId, input.engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    if (!(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const planResult = await this.pool.query(
      `INSERT INTO safety_plans (project_id, engagement_id, contractor_id, title, plan_type, custom_plan_type, reviewer_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [engagement.projectId, engagement.id, engagement.contractorId, input.title.trim(), input.planType, clean(input.customPlanType), clean(input.reviewerNotes)]
    );
    const plan = mapSafetyPlan(planResult.rows[0]);
    const revision = await this.insertPlanRevision(plan.id, input.sourceId, input.revisionIdentifier ?? "Rev 0", input.submittedDate, input.priorRevisionId);
    await this.pool.query("UPDATE safety_plans SET current_revision_id = $2, updated_at = now() WHERE id = $1", [plan.id, revision.id]);
    await this.addPlanAudit(userId, plan.id, null, "plan_created", `Created plan ${plan.title} ${revision.revisionIdentifier}`);
    return (await this.getSafetyPlanDetail(userId, plan.id)) as SafetyPlanDetail;
  }

  async createSafetyPlanRevision(userId: string, planId: string, input: SafetyPlanRevisionCreateInput): Promise<SafetyPlanDetail | null> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) return null;
    if (!(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    try {
      const revision = await this.insertPlanRevision(planId, input.sourceId, input.revisionIdentifier, input.submittedDate, input.priorRevisionId);
      await this.pool.query(
        `UPDATE safety_plans
         SET current_revision_id = $2, review_status = 'pending', approved_at = NULL, approved_by_user_id = NULL, updated_at = now()
         WHERE id = $1`,
        [planId, revision.id]
      );
      await this.addPlanAudit(userId, planId, null, "revision_received", `Received ${revision.revisionIdentifier}`);
      return this.getSafetyPlanDetail(userId, planId);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicatePlanRevisionSourceError();
      throw error;
    }
  }

  async getSafetyPlanDetail(userId: string, planId: string): Promise<SafetyPlanDetail | null> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) return null;
    const revisionRows = await this.pool.query("SELECT * FROM safety_plan_revisions WHERE plan_id = $1 ORDER BY created_at", [planId]);
    const revisions: SafetyPlanRevision[] = [];
    for (const row of revisionRows.rows) {
      revisions.push(mapSafetyPlanRevision(row, (await this.getSource(userId, row.source_id)) ?? undefined));
    }
    const reviewResult = plan.currentRevisionId
      ? await this.pool.query("SELECT * FROM plan_reviews WHERE revision_id = $1 ORDER BY created_at DESC LIMIT 1", [plan.currentRevisionId])
      : { rows: [] };
    const review = reviewResult.rows[0] ? mapPlanReview(reviewResult.rows[0]) : null;
    const references: PlanReviewReference[] = [];
    const findings = review
      ? (await this.pool.query("SELECT * FROM plan_findings WHERE review_id = $1 ORDER BY sort_order, created_at", [review.id])).rows.map(mapPlanFinding)
      : [];
    if (review) {
      const refRows = await this.pool.query("SELECT * FROM plan_review_references WHERE review_id = $1 ORDER BY created_at", [review.id]);
      for (const row of refRows.rows) references.push(mapPlanReference(row, (await this.getSource(userId, row.source_id)) ?? undefined));
    }
    const comparisons = (await this.pool.query("SELECT * FROM plan_resubmission_comparisons WHERE plan_id = $1 ORDER BY created_at DESC", [planId])).rows.map(mapComparison);
    const auditEvents = (await this.pool.query("SELECT * FROM plan_review_audit_events WHERE plan_id = $1 ORDER BY created_at DESC LIMIT 100", [planId])).rows.map(mapPlanAuditEvent);
    return { plan, revisions, review, references, findings, comparisons, auditEvents };
  }

  async runPlanReview(userId: string, planId: string, input: PlanReviewRunInput): Promise<SafetyPlanDetail> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan || !plan.currentRevisionId) throw new Error("Safety plan not found");
    const revisionRows = await this.pool.query("SELECT * FROM safety_plan_revisions WHERE id = $1 AND plan_id = $2", [plan.currentRevisionId, planId]);
    const revision = revisionRows.rows[0] ? mapSafetyPlanRevision(revisionRows.rows[0]) : null;
    if (!revision) throw new Error("Safety plan revision not found");
    const planSource = await this.getSource(userId, revision.sourceId);
    if (!planSource) throw new Error("Source not found");
    if (planSource.extractionStatus === "failed") throw new Error("Plan extraction failed");
    const existing = await this.pool.query("SELECT * FROM plan_reviews WHERE revision_id = $1 ORDER BY created_at DESC LIMIT 1", [revision.id]);
    if (existing.rows[0] && await this.hasHumanPlanReviewWork(existing.rows[0].id)) {
      const preserved = mapPlanReview(existing.rows[0]);
      await this.addPlanAudit(userId, planId, preserved.id, "review_run_skipped", "Existing reviewer-edited review was preserved; no draft overwrite occurred");
      return (await this.getSafetyPlanDetail(userId, planId)) as SafetyPlanDetail;
    }
    await this.pool.query("DELETE FROM plan_reviews WHERE revision_id = $1", [revision.id]);
    const reviewResult = await this.pool.query(
      `INSERT INTO plan_reviews
       (plan_id, revision_id, status, processing_status)
       VALUES ($1, $2, 'pending', 'running')
       RETURNING *`,
      [planId, revision.id]
    );
    const review = mapPlanReview(reviewResult.rows[0]);
    const references: PlanReviewReference[] = [];
    const referenceContexts: ReviewReferenceContext[] = [];
    for (const referenceInput of input.selectedReferences) {
      const source = await this.getSource(userId, referenceInput.sourceId);
      if (!source) throw new Error("Source not found");
      await this.ensureSelectableReviewReference(plan.projectId, source);
      const refResult = await this.pool.query(
        `INSERT INTO plan_review_references (review_id, source_id, source_chunk_id, authority_classification, citation_label)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [review.id, source.id, clean(referenceInput.sourceChunkId), referenceInput.authorityClassification, clean(referenceInput.citationLabel)]
      );
      references.push(mapPlanReference(refResult.rows[0], source));
      referenceContexts.push({ ...referenceInput, source });
    }
    const assistant = await runPlanReviewAssistant({ planSource, references: referenceContexts });
    const findings = assistant.findings.map((finding, index) => ({
      id: randomUUID(),
      reviewId: review.id,
      title: finding.title,
      findingType: finding.findingType,
      authority: finding.authority,
      planSourceId: planSource.id,
      planSourceChunkId: finding.planSourceChunkId,
      referenceSourceId: finding.referenceSourceId,
      referenceSourceChunkId: finding.referenceSourceChunkId,
      referenceCitationLabel: finding.referenceCitationLabel,
      aiExplanation: finding.aiExplanation,
      reviewerExplanation: finding.reviewerExplanation,
      reviewerNotes: null,
      contractorFacingRecommendation: finding.contractorFacingRecommendation,
      recommendedRevisionText: finding.recommendedRevisionText,
      reviewerDecision: finding.reviewerDecision,
      resolved: false,
      notApplicable: false,
      origin: "assistant" as const,
      sortOrder: index,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    for (const finding of findings) await this.insertPlanFinding(finding);
    await this.pool.query(
      `UPDATE plan_reviews
       SET assistant_provider = $2, assistant_model = $3, processing_status = $4, error_state = $5,
           prompt_config_version = $6, contractor_facing_summary = $7, updated_at = now()
       WHERE id = $1`,
      [
        review.id,
        assistant.provider,
        assistant.model,
        assistant.processingStatus,
        assistant.errorState,
        assistant.promptConfigVersion,
        assistant.contractorFacingSummary
      ]
    );
    await this.addPlanAudit(userId, planId, review.id, "review_run_completed", `Generated ${findings.length} draft findings from selected sources`);
    return (await this.getSafetyPlanDetail(userId, planId)) as SafetyPlanDetail;
  }

  async createPlanFinding(userId: string, input: PlanFindingCreateInput): Promise<PlanFinding> {
    const review = await this.getReviewForUser(userId, input.reviewId);
    if (!review) throw new Error("Plan review not found");
    const finding = this.materializeFinding(input, review.id, "reviewer");
    await this.insertPlanFinding(finding);
    await this.addPlanAudit(userId, review.planId, review.id, "finding_created", `Reviewer created finding: ${finding.title}`);
    return finding;
  }

  async updatePlanFinding(userId: string, findingId: string, input: PlanFindingUpdateInput): Promise<PlanFinding | null> {
    const current = await this.getFindingForUser(userId, findingId);
    if (!current) return null;
    const result = await this.pool.query(
      `UPDATE plan_findings
       SET title = $2, finding_type = $3, authority = $4, plan_source_id = $5, plan_source_chunk_id = $6,
           reference_source_id = $7, reference_source_chunk_id = $8, reference_citation_label = $9,
           reviewer_explanation = $10, reviewer_notes = $11, contractor_facing_recommendation = $12,
           recommended_revision_text = $13, reviewer_decision = $14, resolved = $15, not_applicable = $16,
           sort_order = $17, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        findingId,
        input.title ?? current.title,
        input.findingType ?? current.findingType,
        input.authority ?? current.authority,
        input.planSourceId === undefined ? current.planSourceId : clean(input.planSourceId),
        input.planSourceChunkId === undefined ? current.planSourceChunkId : clean(input.planSourceChunkId),
        input.referenceSourceId === undefined ? current.referenceSourceId : clean(input.referenceSourceId),
        input.referenceSourceChunkId === undefined ? current.referenceSourceChunkId : clean(input.referenceSourceChunkId),
        input.referenceCitationLabel === undefined ? current.referenceCitationLabel : clean(input.referenceCitationLabel),
        input.reviewerExplanation === undefined ? current.reviewerExplanation : clean(input.reviewerExplanation),
        input.reviewerNotes === undefined ? current.reviewerNotes : clean(input.reviewerNotes),
        input.contractorFacingRecommendation === undefined ? current.contractorFacingRecommendation : clean(input.contractorFacingRecommendation),
        input.recommendedRevisionText === undefined ? current.recommendedRevisionText : clean(input.recommendedRevisionText),
        input.reviewerDecision === undefined ? current.reviewerDecision : clean(input.reviewerDecision),
        input.resolved ?? current.resolved,
        input.notApplicable ?? current.notApplicable,
        input.sortOrder ?? current.sortOrder
      ]
    );
    const updated = mapPlanFinding(result.rows[0]);
    const review = await this.getReviewForUser(userId, updated.reviewId);
    if (review) await this.addPlanAudit(userId, review.planId, review.id, "finding_edited", `Edited finding: ${updated.title}`);
    return updated;
  }

  async deletePlanFinding(userId: string, findingId: string): Promise<void> {
    const current = await this.getFindingForUser(userId, findingId);
    if (!current) return;
    const review = await this.getReviewForUser(userId, current.reviewId);
    await this.pool.query("DELETE FROM plan_findings WHERE id = $1", [findingId]);
    if (review) await this.addPlanAudit(userId, review.planId, review.id, "finding_removed", `Removed finding: ${current.title}`);
  }

  async updatePlanRecommendation(userId: string, reviewId: string, input: PlanRecommendationUpdateInput): Promise<PlanReview | null> {
    const review = await this.getReviewForUser(userId, reviewId);
    if (!review) return null;
    const result = await this.pool.query(
      `UPDATE plan_reviews
       SET contractor_facing_summary = $2, internal_reviewer_notes = $3, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [reviewId, input.contractorFacingSummary, clean(input.internalReviewerNotes)]
    );
    await this.addPlanAudit(userId, review.planId, reviewId, "recommendation_edited", "Edited contractor-facing recommendation artifact");
    return mapPlanReview(result.rows[0]);
  }

  async updatePlanApproval(userId: string, planId: string, input: PlanApprovalInput): Promise<SafetyPlanDetail | null> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) return null;
    const approved = input.status === "approved";
    await this.pool.query(
      `UPDATE safety_plans
       SET review_status = $2, approved_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
           approved_by_user_id = CASE WHEN $3::boolean THEN $4 ELSE NULL END,
           reviewer_notes = $5, updated_at = now()
       WHERE id = $1`,
      [planId, input.status, approved, userId, clean(input.reviewerNotes) ?? plan.reviewerNotes]
    );
    if (plan.currentRevisionId) {
      await this.pool.query("UPDATE plan_reviews SET status = $2, updated_at = now() WHERE revision_id = $1", [plan.currentRevisionId, input.status]);
    }
    await this.addPlanAudit(userId, planId, null, approved ? "plan_approved" : "plan_marked_pending", `Reviewer marked plan ${input.status}`);
    return this.getSafetyPlanDetail(userId, planId);
  }

  async createResubmissionComparison(userId: string, planId: string, input: ResubmissionComparisonCreateInput): Promise<ResubmissionComparison[]> {
    if (!(await this.getPlanForUser(userId, planId))) throw new Error("Safety plan not found");
    const comparisons: ResubmissionComparison[] = [];
    for (const resolution of input.findingResolutions) {
      const result = await this.pool.query(
        `INSERT INTO plan_resubmission_comparisons
         (plan_id, prior_revision_id, new_revision_id, finding_id, resolution_status, reviewer_notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [planId, input.priorRevisionId, input.newRevisionId, resolution.findingId, resolution.resolutionStatus, clean(resolution.reviewerNotes)]
      );
      comparisons.push(mapComparison(result.rows[0]));
    }
    await this.addPlanAudit(userId, planId, null, "resubmission_compared", `Compared ${input.priorRevisionId} to ${input.newRevisionId}`);
    return comparisons;
  }

  async listObservations(userId: string, filters: ObservationSearchInput): Promise<FieldObservation[]> {
    if (!(await this.getProject(userId, filters.projectId))) return [];
    const clauses = ["project_id = $1"];
    const values: unknown[] = [filters.projectId];
    if (filters.engagementId) { values.push(filters.engagementId); clauses.push(`engagement_id = $${values.length}`); }
    if (filters.classification) { values.push(filters.classification); clauses.push(`derived_classification = $${values.length}`); }
    if (filters.category) { values.push(filters.category); clauses.push(`category = $${values.length}`); }
    if (filters.followUpStatus) { values.push(filters.followUpStatus); clauses.push(`follow_up_status = $${values.length}`); }
    if (filters.dateFrom) { values.push(filters.dateFrom); clauses.push(`observed_at::date >= $${values.length}`); }
    if (filters.dateTo) { values.push(filters.dateTo); clauses.push(`observed_at::date <= $${values.length}`); }
    const result = await this.pool.query(`SELECT * FROM field_observations WHERE ${clauses.join(" AND ")} ORDER BY observed_at DESC`, values);
    return Promise.all(result.rows.map((row) => this.mapObservationWithContext(row)));
  }

  async createObservation(userId: string, input: ObservationCreateInput): Promise<ObservationDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const engagement = input.engagementId ? await this.getEngagementForUser(userId, input.engagementId) : null;
    if (input.engagementId && (!engagement || engagement.projectId !== input.projectId)) throw new Error("Observation engagement must belong to the selected project");
    const result = await this.pool.query(
      `INSERT INTO field_observations
       (project_id, engagement_id, contractor_id, creator_user_id, original_text, observed_at, location, activity,
        derived_classification, category, reviewer_note, follow_up_status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [input.projectId, engagement?.id ?? null, engagement?.contractorId ?? null, userId, input.originalText.trim(), clean(input.observedAt), clean(input.location), clean(input.activity), input.classification ?? null, clean(input.category), clean(input.reviewerNote), input.followUpNeeded ? "needed" : "none"]
    );
    await this.refreshObservationRecurrence(result.rows[0].id);
    await this.addObservationAudit(userId, result.rows[0].id, "created", `Created observation: ${input.originalText.trim()}`);
    return (await this.getObservation(userId, result.rows[0].id)) as ObservationDetail;
  }

  async getObservation(userId: string, observationId: string): Promise<ObservationDetail | null> {
    const result = await this.pool.query(
      `SELECT fo.*
       FROM field_observations fo
       JOIN projects p ON p.id = fo.project_id
       WHERE p.owner_user_id = $1 AND fo.id = $2`,
      [userId, observationId]
    );
    if (!result.rows[0]) return null;
    return this.buildObservationDetail(userId, result.rows[0]);
  }

  async updateObservation(userId: string, observationId: string, input: ObservationUpdateInput): Promise<ObservationDetail | null> {
    const current = await this.getObservation(userId, observationId);
    if (!current) return null;
    const closing = input.followUpStatus === "verified_closed" && current.followUpStatus !== "verified_closed";
    const result = await this.pool.query(
      `UPDATE field_observations
       SET derived_classification = $2, category = $3, activity = $4, location = $5, derived_summary = $6,
           reviewer_note = $7, follow_up_status = $8, follow_up_note = $9, follow_up_due_date = $10,
           follow_up_verified_at = CASE WHEN $11 THEN now() ELSE follow_up_verified_at END,
           follow_up_verified_by_user_id = CASE WHEN $11 THEN $12 ELSE follow_up_verified_by_user_id END,
           ai_suggestions_rejected = $13, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        observationId,
        input.derivedClassification ?? current.derivedClassification,
        input.category === undefined ? current.category : clean(input.category),
        input.activity === undefined ? current.activity : clean(input.activity),
        input.location === undefined ? current.location : clean(input.location),
        input.derivedSummary === undefined ? current.derivedSummary : clean(input.derivedSummary),
        input.reviewerNote === undefined ? current.reviewerNote : clean(input.reviewerNote),
        input.followUpStatus ?? current.followUpStatus,
        input.followUpNote === undefined ? current.followUpNote : clean(input.followUpNote),
        input.followUpDueDate === undefined ? current.followUpDueDate : clean(input.followUpDueDate),
        closing,
        userId,
        input.aiSuggestionsRejected ?? current.aiSuggestionsRejected
      ]
    );
    await this.refreshObservationRecurrence(observationId);
    await this.addObservationAudit(userId, observationId, "updated", "Updated observation classification, category, location, activity, or follow-up fields");
    if (closing) await this.addObservationAudit(userId, observationId, "closed_verified", "Verified and closed observation follow-up");
    return this.buildObservationDetail(userId, result.rows[0]);
  }

  async attachObservationPhoto(userId: string, observationId: string, input: ObservationPhotoAttachInput): Promise<ObservationPhoto> {
    const observation = await this.getObservation(userId, observationId);
    if (!observation) throw new Error("Observation not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    if (source.sourceType !== "image") throw new Error("Observation photos must use image sources");
    if (source.projectId && source.projectId !== observation.projectId) throw new Error("Photo source must belong to the observation project");
    try {
      const result = await this.pool.query("INSERT INTO observation_photos (observation_id, source_id, caption) VALUES ($1, $2, $3) RETURNING *", [observationId, source.id, clean(input.caption)]);
      await this.addObservationAudit(userId, observationId, "photo_added", `Added photo source: ${source.title}`);
      return mapObservationPhoto(result.rows[0], source);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateObservationPhotoError();
      throw error;
    }
  }

  async updateObservationPhoto(userId: string, photoId: string, input: ObservationPhotoUpdateInput): Promise<ObservationPhoto | null> {
    const current = await this.pool.query("SELECT * FROM observation_photos WHERE id = $1", [photoId]);
    if (!current.rows[0] || !(await this.getObservation(userId, current.rows[0].observation_id))) return null;
    const result = await this.pool.query("UPDATE observation_photos SET caption = $2, updated_at = now() WHERE id = $1 RETURNING *", [photoId, input.caption === undefined ? current.rows[0].caption : clean(input.caption)]);
    await this.addObservationAudit(userId, current.rows[0].observation_id, "photo_caption_updated", "Updated observation photo caption");
    return mapObservationPhoto(result.rows[0], (await this.getSource(userId, result.rows[0].source_id)) ?? undefined);
  }

  async removeObservationPhoto(userId: string, photoId: string): Promise<void> {
    const current = await this.pool.query("SELECT * FROM observation_photos WHERE id = $1", [photoId]);
    if (!current.rows[0] || !(await this.getObservation(userId, current.rows[0].observation_id))) return;
    await this.pool.query("DELETE FROM observation_photos WHERE id = $1", [photoId]);
    await this.addObservationAudit(userId, current.rows[0].observation_id, "photo_removed", "Removed photo association; original source was preserved");
  }

  async runObservationEnrichment(userId: string, observationId: string): Promise<ObservationDetail | null> {
    const current = await this.getObservation(userId, observationId);
    if (!current) return null;
    await this.pool.query("UPDATE field_observations SET ai_suggestion_status = 'processing', ai_error_state = NULL, updated_at = now() WHERE id = $1", [observationId]);
    await this.addObservationAudit(userId, observationId, "ai_processing_run", "Started observation suggestion processing");
    try {
      const chunks = await this.searchSourceChunks(userId, { q: buildObservationReferenceQuery(current), projectId: current.projectId, activeOnly: true });
      const assistant = await runObservationAssistant({ originalText: current.originalText, activity: current.activity, category: current.category, existingReferences: chunks });
      await this.pool.query(
        `UPDATE field_observations
         SET ai_suggestion_status = 'ready', suggested_classification = $2, suggested_category = $3,
             suggested_activity = $4, suggested_summary = $5, suggested_follow_up_status = $6,
             derived_classification = COALESCE(derived_classification, CASE WHEN ai_suggestions_rejected THEN NULL ELSE $2 END),
             category = COALESCE(category, CASE WHEN ai_suggestions_rejected THEN NULL ELSE $3 END),
             activity = COALESCE(activity, CASE WHEN ai_suggestions_rejected THEN NULL ELSE $4 END),
             derived_summary = COALESCE(derived_summary, CASE WHEN ai_suggestions_rejected THEN NULL ELSE $5 END),
             follow_up_status = CASE WHEN follow_up_status = 'none' AND NOT ai_suggestions_rejected THEN $6 ELSE follow_up_status END,
             ai_error_state = NULL, updated_at = now()
         WHERE id = $1`,
        [observationId, assistant.classification, assistant.category, assistant.activity, assistant.summary, assistant.followUpStatus]
      );
      for (const reference of assistant.referenceSuggestions) {
        await this.pool.query(
          `INSERT INTO observation_reference_links (observation_id, source_id, source_chunk_id, citation_label, suggested, accepted)
           VALUES ($1, $2, $3, $4, true, false) ON CONFLICT DO NOTHING`,
          [observationId, reference.sourceId, reference.sourceChunkId, reference.citationLabel]
        );
      }
      await this.addObservationAudit(userId, observationId, "ai_processing_result", `Suggestions ready from ${assistant.provider}`);
    } catch (error) {
      await this.pool.query("UPDATE field_observations SET ai_suggestion_status = 'failed', ai_error_state = $2, updated_at = now() WHERE id = $1", [observationId, error instanceof Error ? error.message : "Observation suggestion processing failed"]);
      await this.addObservationAudit(userId, observationId, "ai_processing_failed", "Observation was saved, but suggestions failed");
    }
    return this.getObservation(userId, observationId);
  }

  async linkObservationReference(userId: string, observationId: string, input: ObservationReferenceLinkInput): Promise<ObservationReferenceLink> {
    const observation = await this.getObservation(userId, observationId);
    if (!observation) throw new Error("Observation not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    await this.ensureSelectableReviewReference(observation.projectId, source);
    try {
      const result = await this.pool.query(
        "INSERT INTO observation_reference_links (observation_id, source_id, source_chunk_id, citation_label, suggested, accepted) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [observationId, source.id, clean(input.sourceChunkId), clean(input.citationLabel), input.suggested, input.accepted]
      );
      await this.addObservationAudit(userId, observationId, "reference_link_added", `Linked reference: ${source.title}`);
      return mapObservationReference(result.rows[0], source);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateObservationReferenceError();
      throw error;
    }
  }

  async unlinkObservationReference(userId: string, linkId: string): Promise<void> {
    const current = await this.pool.query("SELECT * FROM observation_reference_links WHERE id = $1", [linkId]);
    if (!current.rows[0] || !(await this.getObservation(userId, current.rows[0].observation_id))) return;
    await this.pool.query("DELETE FROM observation_reference_links WHERE id = $1", [linkId]);
    await this.addObservationAudit(userId, current.rows[0].observation_id, "reference_link_removed", "Removed observation reference link");
  }

  async linkObservationPlanFinding(userId: string, observationId: string, input: ObservationPlanFindingLinkInput): Promise<ObservationPlanFindingLink> {
    const observation = await this.getObservation(userId, observationId);
    if (!observation) throw new Error("Observation not found");
    const finding = await this.getPlanFindingForProject(userId, input.findingId, observation.projectId);
    if (!finding) throw new Error("Plan finding not found");
    try {
      const result = await this.pool.query(
        "INSERT INTO observation_plan_finding_links (observation_id, finding_id, suggested, accepted, note) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [observationId, finding.id, input.suggested, input.accepted, clean(input.note)]
      );
      await this.addObservationAudit(userId, observationId, "plan_finding_link_added", `Linked plan finding: ${finding.title}`);
      return mapObservationPlanFindingLink(result.rows[0], finding);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateObservationPlanFindingLinkError();
      throw error;
    }
  }

  async unlinkObservationPlanFinding(userId: string, linkId: string): Promise<void> {
    const current = await this.pool.query("SELECT * FROM observation_plan_finding_links WHERE id = $1", [linkId]);
    if (!current.rows[0] || !(await this.getObservation(userId, current.rows[0].observation_id))) return;
    await this.pool.query("DELETE FROM observation_plan_finding_links WHERE id = $1", [linkId]);
    await this.addObservationAudit(userId, current.rows[0].observation_id, "plan_finding_link_removed", "Removed plan finding link");
  }

  async listIncidents(userId: string, filters: IncidentSearchInput): Promise<IncidentRecord[]> {
    if (!(await this.getProject(userId, filters.projectId))) return [];
    const clauses = ["project_id = $1"];
    const values: unknown[] = [filters.projectId];
    if (filters.engagementId) { values.push(filters.engagementId); clauses.push(`engagement_id = $${values.length}`); }
    if (filters.category) { values.push(filters.category); clauses.push(`incident_category = $${values.length}`); }
    if (filters.oversightStatus) { values.push(filters.oversightStatus); clauses.push(`oversight_status = $${values.length}`); }
    if (filters.openOnly) clauses.push("oversight_status <> 'closed'");
    if (filters.followUpRequired !== undefined) clauses.push(filters.followUpRequired ? "oversight_status IN ('follow_up_required','verification_pending')" : "oversight_status NOT IN ('follow_up_required','verification_pending')");
    if (filters.dateFrom) { values.push(filters.dateFrom); clauses.push(`incident_date_time::date >= $${values.length}`); }
    if (filters.dateTo) { values.push(filters.dateTo); clauses.push(`incident_date_time::date <= $${values.length}`); }
    const result = await this.pool.query(`SELECT * FROM incidents WHERE ${clauses.join(" AND ")} ORDER BY incident_date_time DESC`, values);
    return Promise.all(result.rows.map((row) => this.mapIncidentWithContext(row)));
  }

  async createIncident(userId: string, input: IncidentCreateInput): Promise<IncidentDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const engagement = input.engagementId ? await this.getEngagementForUser(userId, input.engagementId) : null;
    if (input.engagementId && (!engagement || engagement.projectId !== input.projectId)) throw new Error("Incident engagement must belong to the selected project");
    const result = await this.pool.query(
      `INSERT INTO incidents
       (project_id, engagement_id, contractor_id, creator_user_id, incident_date_time, reported_at, location, activity,
        factual_description, incident_category, contractor_reported_classification, contractor_investigation_status, affected_work_scope)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [input.projectId, engagement?.id ?? null, engagement?.contractorId ?? null, userId, input.incidentDateTime, clean(input.reportedAt), clean(input.location), clean(input.activity), input.factualDescription.trim(), input.incidentCategory ?? "other", clean(input.contractorReportedClassification), input.contractorInvestigationStatus ?? "unknown", clean(input.affectedWorkScope)]
    );
    await this.addIncidentAudit(userId, result.rows[0].id, "incident_created", "Created incident oversight record");
    return (await this.getIncident(userId, result.rows[0].id)) as IncidentDetail;
  }

  async getIncident(userId: string, incidentId: string): Promise<IncidentDetail | null> {
    const result = await this.pool.query(
      `SELECT i.* FROM incidents i JOIN projects p ON p.id = i.project_id WHERE p.owner_user_id = $1 AND i.id = $2`,
      [userId, incidentId]
    );
    return result.rows[0] ? this.buildIncidentDetail(userId, result.rows[0]) : null;
  }

  async updateIncident(userId: string, incidentId: string, input: IncidentUpdateInput): Promise<IncidentDetail | null> {
    const current = await this.getIncident(userId, incidentId);
    if (!current) return null;
    const result = await this.pool.query(
      `UPDATE incidents SET incident_date_time = $2, reported_at = $3, location = $4, activity = $5,
       factual_description = $6, incident_category = $7, contractor_reported_classification = $8,
       contractor_investigation_status = $9, affected_work_disposition = $10, affected_work_scope = $11,
       oversight_status = $12, updated_at = now() WHERE id = $1 RETURNING *`,
      [incidentId, input.incidentDateTime ?? current.incidentDateTime, input.reportedAt === undefined ? current.reportedAt : clean(input.reportedAt) ?? current.reportedAt, input.location === undefined ? current.location : clean(input.location), input.activity === undefined ? current.activity : clean(input.activity), input.factualDescription?.trim() || current.factualDescription, input.incidentCategory ?? current.incidentCategory, input.contractorReportedClassification === undefined ? current.contractorReportedClassification : clean(input.contractorReportedClassification), input.contractorInvestigationStatus ?? current.contractorInvestigationStatus, input.affectedWorkDisposition ?? current.affectedWorkDisposition, input.affectedWorkScope === undefined ? current.affectedWorkScope : clean(input.affectedWorkScope), input.oversightStatus ?? current.oversightStatus]
    );
    await this.addIncidentAudit(userId, incidentId, "incident_updated", "Updated incident factual or oversight fields");
    return this.buildIncidentDetail(userId, result.rows[0]);
  }

  async attachIncidentSource(userId: string, incidentId: string, input: IncidentAttachmentInput): Promise<IncidentAttachment> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) throw new Error("Incident not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    if (source.projectId && source.projectId !== incident.projectId) throw new Error("Incident source must belong to the selected project");
    try {
      const result = await this.pool.query("INSERT INTO incident_attachments (incident_id, source_id, role, received_at, notes) VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5) RETURNING *", [incidentId, source.id, input.role, clean(input.receivedAt), clean(input.notes)]);
      await this.addIncidentAudit(userId, incidentId, input.role === "contractor_report" ? "contractor_report_received" : "attachment_added", `Attached incident source: ${source.title}`);
      return mapIncidentAttachment(result.rows[0], source);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateIncidentAttachmentError();
      throw error;
    }
  }

  async removeIncidentAttachment(userId: string, attachmentId: string): Promise<void> {
    const current = await this.pool.query("SELECT * FROM incident_attachments WHERE id = $1", [attachmentId]);
    if (!current.rows[0] || !(await this.getIncident(userId, current.rows[0].incident_id))) return;
    await this.pool.query("DELETE FROM incident_attachments WHERE id = $1", [attachmentId]);
    await this.addIncidentAudit(userId, current.rows[0].incident_id, "attachment_removed", "Removed incident-source association; original source was preserved");
  }

  async createContractorCorrectiveAction(userId: string, incidentId: string, input: ContractorCorrectiveActionInput): Promise<ContractorCorrectiveAction> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    const source = input.sourceId ? await this.getSource(userId, input.sourceId) : null;
    if (input.sourceId && !source) throw new Error("Source not found");
    const result = await this.pool.query("INSERT INTO contractor_corrective_actions (incident_id, description, source_id, target_date, contractor_status, evidence_received) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [incidentId, input.description.trim(), clean(input.sourceId), clean(input.targetDate), input.contractorStatus ?? "provided", input.evidenceReceived ?? false]);
    await this.addIncidentAudit(userId, incidentId, "contractor_corrective_action_recorded", "Recorded contractor-provided corrective action");
    return mapCorrectiveAction(result.rows[0], source ?? undefined);
  }

  async updateContractorCorrectiveAction(userId: string, actionId: string, input: ContractorCorrectiveActionUpdateInput): Promise<ContractorCorrectiveAction | null> {
    const current = await this.pool.query("SELECT * FROM contractor_corrective_actions WHERE id = $1", [actionId]);
    if (!current.rows[0] || !(await this.getIncident(userId, current.rows[0].incident_id))) return null;
    const result = await this.pool.query("UPDATE contractor_corrective_actions SET description = $2, source_id = $3, target_date = $4, contractor_status = $5, evidence_received = $6, updated_at = now() WHERE id = $1 RETURNING *", [actionId, input.description ?? current.rows[0].description, input.sourceId === undefined ? current.rows[0].source_id : clean(input.sourceId), input.targetDate === undefined ? current.rows[0].target_date : clean(input.targetDate), input.contractorStatus ?? current.rows[0].contractor_status, input.evidenceReceived ?? current.rows[0].evidence_received]);
    await this.addIncidentAudit(userId, current.rows[0].incident_id, "contractor_corrective_action_updated", "Updated contractor-provided corrective action");
    return mapCorrectiveAction(result.rows[0], result.rows[0].source_id ? (await this.getSource(userId, result.rows[0].source_id)) ?? undefined : undefined);
  }

  async upsertIncidentProjectReview(userId: string, incidentId: string, input: IncidentProjectReviewInput): Promise<IncidentProjectReview> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    const result = await this.pool.query(
      `INSERT INTO incident_project_reviews (incident_id, reviewer_analysis, remaining_exposure, plan_procedure_concerns, corrective_action_adequacy, additional_information_needed, management_review_needed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (incident_id) DO UPDATE SET reviewer_analysis = EXCLUDED.reviewer_analysis, remaining_exposure = EXCLUDED.remaining_exposure,
       plan_procedure_concerns = EXCLUDED.plan_procedure_concerns, corrective_action_adequacy = EXCLUDED.corrective_action_adequacy,
       additional_information_needed = EXCLUDED.additional_information_needed, management_review_needed = EXCLUDED.management_review_needed, updated_at = now()
       RETURNING *`,
      [incidentId, clean(input.reviewerAnalysis), clean(input.remainingExposure), clean(input.planProcedureConcerns), clean(input.correctiveActionAdequacy), clean(input.additionalInformationNeeded), input.managementReviewNeeded ?? false]
    );
    await this.pool.query("UPDATE incidents SET oversight_status = CASE WHEN oversight_status = 'received' THEN 'under_project_review' ELSE oversight_status END, updated_at = now() WHERE id = $1", [incidentId]);
    await this.addIncidentAudit(userId, incidentId, "project_review_edited", "Saved separate GC/project incident review");
    return mapIncidentProjectReview(result.rows[0]);
  }

  async createIncidentRecommendation(userId: string, incidentId: string, input: IncidentRecommendationInput): Promise<IncidentRecommendation> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    const result = await this.pool.query("INSERT INTO incident_recommendations (incident_id, recommendation_type, recommendation_text, status) VALUES ($1, $2, $3, $4) RETURNING *", [incidentId, input.recommendationType, input.recommendationText.trim(), input.status ?? "open"]);
    await this.addIncidentAudit(userId, incidentId, "recommendation_added", "Added human-controlled project recommendation");
    return mapIncidentRecommendation(result.rows[0]);
  }

  async updateIncidentRecommendation(userId: string, recommendationId: string, input: IncidentRecommendationUpdateInput): Promise<IncidentRecommendation | null> {
    const current = await this.pool.query("SELECT * FROM incident_recommendations WHERE id = $1", [recommendationId]);
    if (!current.rows[0] || !(await this.getIncident(userId, current.rows[0].incident_id))) return null;
    const result = await this.pool.query("UPDATE incident_recommendations SET recommendation_type = $2, recommendation_text = $3, status = $4, updated_at = now() WHERE id = $1 RETURNING *", [recommendationId, input.recommendationType ?? current.rows[0].recommendation_type, input.recommendationText ?? current.rows[0].recommendation_text, input.status ?? current.rows[0].status]);
    await this.addIncidentAudit(userId, current.rows[0].incident_id, "recommendation_updated", "Updated project recommendation");
    return mapIncidentRecommendation(result.rows[0]);
  }

  async createProjectSafetyDecision(userId: string, incidentId: string, input: ProjectSafetyDecisionInput): Promise<ProjectSafetyDecision> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) throw new Error("Incident not found");
    const source = input.supportingSourceId ? await this.getSource(userId, input.supportingSourceId) : null;
    if (input.supportingSourceId && !source) throw new Error("Source not found");
    const result = await this.pool.query("INSERT INTO project_safety_decisions (incident_id, project_id, decision_text, applies_to_scope, effective_date, status, decision_maker_user_id, rationale, supporting_source_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *", [incidentId, incident.projectId, input.decisionText.trim(), clean(input.appliesToScope), clean(input.effectiveDate), input.status ?? "active", userId, clean(input.rationale), clean(input.supportingSourceId)]);
    await this.addIncidentAudit(userId, incidentId, "project_decision_created", "Created human-confirmed project safety decision");
    return mapProjectSafetyDecision(result.rows[0], source ?? undefined);
  }

  async createIncidentFollowUp(userId: string, incidentId: string, input: IncidentFollowUpInput): Promise<IncidentFollowUp> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    const source = input.linkedSourceId ? await this.getSource(userId, input.linkedSourceId) : null;
    const observation = input.linkedObservationId ? await this.getObservation(userId, input.linkedObservationId) : null;
    if (input.linkedSourceId && !source) throw new Error("Source not found");
    if (input.linkedObservationId && !observation) throw new Error("Observation not found");
    const result = await this.pool.query("INSERT INTO incident_followups (incident_id, status, verification_note, verified_at, verifier_user_id, linked_source_id, linked_observation_id) VALUES ($1,$2,$3,COALESCE($4::timestamptz, now()),$5,$6,$7) RETURNING *", [incidentId, input.status, clean(input.verificationNote), clean(input.verifiedAt), userId, clean(input.linkedSourceId), clean(input.linkedObservationId)]);
    await this.addIncidentAudit(userId, incidentId, "follow_up_recorded", "Recorded project-level follow-up verification");
    return mapIncidentFollowUp(result.rows[0], source ?? undefined, observation ?? undefined);
  }

  async linkIncidentRecord(userId: string, incidentId: string, input: IncidentLinkInput): Promise<IncidentLink> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) throw new Error("Incident not found");
    const planFindingId = clean(input.planFindingId);
    const observationId = clean(input.observationId);
    const finding = planFindingId ? await this.getPlanFindingForProject(userId, planFindingId, incident.projectId) : null;
    const observation = observationId ? await this.getObservation(userId, observationId) : null;
    if (planFindingId && !finding) throw new Error("Plan finding not found");
    if (observationId && (!observation || observation.projectId !== incident.projectId)) throw new Error("Observation not found");
    try {
      const result = await this.pool.query("INSERT INTO incident_links (incident_id, plan_finding_id, observation_id, suggested, accepted, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [incidentId, planFindingId, observationId, input.suggested ?? false, input.accepted ?? true, clean(input.note)]);
      await this.addIncidentAudit(userId, incidentId, planFindingId ? "plan_finding_link_added" : "observation_link_added", "Linked related plan finding or observation");
      return mapIncidentLink(result.rows[0], finding ?? undefined, observation ?? undefined);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateIncidentLinkError();
      throw error;
    }
  }

  async unlinkIncidentRecord(userId: string, linkId: string): Promise<void> {
    const current = await this.pool.query("SELECT * FROM incident_links WHERE id = $1", [linkId]);
    if (!current.rows[0] || !(await this.getIncident(userId, current.rows[0].incident_id))) return;
    await this.pool.query("DELETE FROM incident_links WHERE id = $1", [linkId]);
    await this.addIncidentAudit(userId, current.rows[0].incident_id, "incident_link_removed", "Removed incident relationship link");
  }

  async runIncidentAiReview(userId: string, incidentId: string): Promise<IncidentDetail | null> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) return null;
    await this.pool.query("UPDATE incidents SET ai_review_status = 'processing', ai_error_state = NULL, updated_at = now() WHERE id = $1", [incidentId]);
    const documents = incident.attachments.map((attachment) => attachment.source).filter(Boolean) as SourceDetail[];
    const assistant = await runIncidentAssistant({ factualDescription: incident.factualDescription, activity: incident.activity, contractorClassification: incident.contractorReportedClassification, documents, findings: incident.links.map((link) => link.finding).filter(Boolean) as PlanFinding[], observations: incident.links.map((link) => link.observation).filter(Boolean) as FieldObservation[] });
    await this.pool.query("UPDATE incidents SET ai_review_status = $2, ai_summary = $3, ai_suggested_concerns = $4, ai_suggested_questions = $5, ai_error_state = $6, updated_at = now() WHERE id = $1", [incidentId, assistant.processingStatus, assistant.processingStatus === "ready" ? assistant.summary : incident.aiSummary, assistant.processingStatus === "ready" ? assistant.suggestedConcerns : incident.aiSuggestedConcerns, assistant.processingStatus === "ready" ? assistant.suggestedQuestions : incident.aiSuggestedQuestions, assistant.errorState]);
    await this.addIncidentAudit(userId, incidentId, assistant.processingStatus === "ready" ? "ai_review_ready" : "ai_review_failed", assistant.processingStatus === "ready" ? "Incident suggestions ready" : "Incident was preserved, but AI suggestions failed");
    return this.getIncident(userId, incidentId);
  }

  async closeIncident(userId: string, incidentId: string, input: IncidentCloseInput): Promise<IncidentDetail | null> {
    if (!(await this.getIncident(userId, incidentId))) return null;
    const result = await this.pool.query("UPDATE incidents SET oversight_status = 'closed', closed_at = now(), closed_by_user_id = $2, closure_note = $3, project_outcome = $4, unresolved_contractor_items = $5, updated_at = now() WHERE id = $1 RETURNING *", [incidentId, userId, input.closureNote.trim(), clean(input.projectOutcome), clean(input.unresolvedContractorItems)]);
    await this.addIncidentAudit(userId, incidentId, "incident_closed", "Closed project oversight record");
    return this.buildIncidentDetail(userId, result.rows[0]);
  }

  async reopenIncident(userId: string, incidentId: string, input: IncidentReopenInput): Promise<IncidentDetail | null> {
    if (!(await this.getIncident(userId, incidentId))) return null;
    const result = await this.pool.query("UPDATE incidents SET oversight_status = 'under_project_review', reopened_at = now(), reopened_by_user_id = $2, reopen_reason = $3, updated_at = now() WHERE id = $1 RETURNING *", [incidentId, userId, input.reason.trim()]);
    await this.addIncidentAudit(userId, incidentId, "incident_reopened", input.reason.trim());
    return this.buildIncidentDetail(userId, result.rows[0]);
  }

  async listReports(userId: string, filters: ReportSearchInput): Promise<SafetyReport[]> {
    if (!(await this.getProject(userId, filters.projectId))) return [];
    const clauses = ["project_id = $1"];
    const values: unknown[] = [filters.projectId];
    if (filters.reportType) { values.push(filters.reportType); clauses.push(`report_type = $${values.length}`); }
    if (filters.status) { values.push(filters.status); clauses.push(`status = $${values.length}`); }
    if (filters.dateFrom) { values.push(filters.dateFrom); clauses.push(`period_end >= $${values.length}`); }
    if (filters.dateTo) { values.push(filters.dateTo); clauses.push(`period_start <= $${values.length}`); }
    const result = await this.pool.query(`SELECT * FROM safety_reports WHERE ${clauses.join(" AND ")} ORDER BY period_end DESC, created_at DESC`, values);
    return result.rows.map(mapReport);
  }

  async createReport(userId: string, input: ReportCreateInput): Promise<SafetyReportDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const result = await this.pool.query(
      `INSERT INTO safety_reports (project_id, report_type, format, period_start, period_end, title, scope, manual_inputs, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [input.projectId, input.reportType, input.format, input.periodStart, input.periodEnd, clean(input.title) ?? `${titleCase(input.reportType)} Safety Report`, normalizeReportScope(input.scope), normalizeManualInputs(input.manualInputs), userId]
    );
    await this.addReportAudit(userId, result.rows[0].id, null, "report_created", "Created safety report shell");
    return (await this.getReport(userId, result.rows[0].id)) as SafetyReportDetail;
  }

  async getReport(userId: string, reportId: string): Promise<SafetyReportDetail | null> {
    const result = await this.pool.query(
      `SELECT r.* FROM safety_reports r JOIN projects p ON p.id = r.project_id WHERE p.owner_user_id = $1 AND r.id = $2`,
      [userId, reportId]
    );
    if (!result.rows[0]) return null;
    return this.buildReportDetail(mapReport(result.rows[0]));
  }

  async updateReport(userId: string, reportId: string, input: ReportUpdateInput): Promise<SafetyReportDetail | null> {
    const current = await this.getReport(userId, reportId);
    if (!current) return null;
    const result = await this.pool.query(
      `UPDATE safety_reports SET title = $2, scope = $3, manual_inputs = $4, updated_at = now() WHERE id = $1 RETURNING *`,
      [reportId, input.title === undefined ? current.title : clean(input.title) ?? current.title, input.scope ? normalizeReportScope(input.scope) : current.scope, input.manualInputs ? normalizeManualInputs(input.manualInputs) : current.manualInputs]
    );
    await this.addReportAudit(userId, reportId, null, "report_updated", "Updated report metadata, scope, or manual inputs");
    return this.buildReportDetail(mapReport(result.rows[0]));
  }

  async generateReportDraft(userId: string, reportId: string, input: ReportGenerateInput): Promise<SafetyReportDetail | null> {
    const detail = await this.getReport(userId, reportId);
    if (!detail) return null;
    await this.pool.query("UPDATE safety_reports SET generation_status = 'generating', error_state = NULL, updated_at = now() WHERE id = $1", [reportId]);
    const context = await this.buildReportEvidenceContext(userId, { ...detail, generationStatus: "generating", errorState: null });
    let draft;
    try {
      draft = await draftSafetyReport(context);
    } catch (error) {
      draft = draftFallbackSafetyReport(context, error);
    }
    const existing = detail.currentRevision;
    const replaceExisting = existing && !input.preserveExisting && existing.status === "draft";
    const revisionNumber = replaceExisting ? existing.revisionNumber : await this.nextReportRevisionNumber(reportId);
    const revisionId = replaceExisting ? existing.id : randomUUID();
    const revisionResult = await this.pool.query(
      `INSERT INTO safety_report_revisions
       (id, report_id, revision_number, status, title, content_markdown, content_json, evidence_manifest, created_by_user_id)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8)
       ON CONFLICT (report_id, revision_number) DO UPDATE SET title = EXCLUDED.title, content_markdown = EXCLUDED.content_markdown,
         content_json = EXCLUDED.content_json, evidence_manifest = EXCLUDED.evidence_manifest, status = 'draft', finalized_at = NULL, finalized_by_user_id = NULL
       RETURNING *`,
      [revisionId, reportId, revisionNumber, detail.title, draft.contentMarkdown, draft.contentJson, context.manifest, userId]
    );
    await this.pool.query(
      `UPDATE safety_reports SET status = 'draft', generation_status = 'ready', generation_provider = $2, generation_model = $3,
       error_state = $4, current_revision_id = $5, finalized_at = NULL, finalized_by_user_id = NULL, updated_at = now() WHERE id = $1`,
      [reportId, draft.provider, draft.model, draft.errorState, revisionResult.rows[0].id]
    );
    await this.addReportAudit(userId, reportId, revisionResult.rows[0].id, draft.errorState ? "report_generated_with_fallback" : "report_generated", "Generated editable report draft from evidence manifest");
    return this.getReport(userId, reportId);
  }

  async updateReportRevision(userId: string, revisionId: string, input: ReportRevisionUpdateInput): Promise<SafetyReportRevision | null> {
    const currentResult = await this.pool.query(
      `SELECT rv.* FROM safety_report_revisions rv
       JOIN safety_reports r ON r.id = rv.report_id
       JOIN projects p ON p.id = r.project_id
       WHERE p.owner_user_id = $1 AND rv.id = $2`,
      [userId, revisionId]
    );
    if (!currentResult.rows[0]) return null;
    const current = mapReportRevision(currentResult.rows[0]);
    const targetId = current.status === "finalized" ? randomUUID() : current.id;
    const targetNumber = current.status === "finalized" ? await this.nextReportRevisionNumber(current.reportId) : current.revisionNumber;
    const result = await this.pool.query(
      `INSERT INTO safety_report_revisions
       (id, report_id, revision_number, status, title, content_markdown, content_json, evidence_manifest, created_by_user_id)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8)
       ON CONFLICT (report_id, revision_number) DO UPDATE SET title = EXCLUDED.title, content_markdown = EXCLUDED.content_markdown, content_json = EXCLUDED.content_json
       RETURNING *`,
      [targetId, current.reportId, targetNumber, input.title === undefined ? current.title : clean(input.title) ?? current.title, input.contentMarkdown ?? current.contentMarkdown, input.contentJson ?? current.contentJson, current.evidenceManifest, userId]
    );
    await this.pool.query("UPDATE safety_reports SET status = 'draft', current_revision_id = $2, finalized_at = NULL, finalized_by_user_id = NULL, updated_at = now() WHERE id = $1", [current.reportId, result.rows[0].id]);
    await this.addReportAudit(userId, current.reportId, result.rows[0].id, "revision_edited", current.status === "finalized" ? "Created draft revision from finalized report edits" : "Edited report draft revision");
    return mapReportRevision(result.rows[0]);
  }

  async finalizeReport(userId: string, reportId: string, input: ReportFinalizeInput): Promise<SafetyReportDetail | null> {
    const detail = await this.getReport(userId, reportId);
    if (!detail?.currentRevision) return null;
    await this.pool.query("UPDATE safety_report_revisions SET status = 'finalized', finalized_at = now(), finalized_by_user_id = $2 WHERE id = $1", [detail.currentRevision.id, userId]);
    await this.pool.query("UPDATE safety_reports SET status = 'finalized', finalized_at = now(), finalized_by_user_id = $2, updated_at = now() WHERE id = $1", [reportId, userId]);
    await this.addReportAudit(userId, reportId, detail.currentRevision.id, "report_finalized", clean(input.reviewerNote) ?? "Finalized safety report");
    return this.getReport(userId, reportId);
  }

  async createReportRevision(userId: string, reportId: string): Promise<SafetyReportDetail | null> {
    const detail = await this.getReport(userId, reportId);
    if (!detail) return null;
    const current = detail.currentRevision;
    const result = await this.pool.query(
      `INSERT INTO safety_report_revisions (report_id, revision_number, status, title, content_markdown, content_json, evidence_manifest, created_by_user_id)
       VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7) RETURNING *`,
      [reportId, await this.nextReportRevisionNumber(reportId), current?.title ?? detail.title, current?.contentMarkdown ?? "", current?.contentJson ?? {}, current?.evidenceManifest ?? emptyReportManifest(detail.periodStart, detail.periodEnd), userId]
    );
    await this.pool.query("UPDATE safety_reports SET status = 'draft', current_revision_id = $2, finalized_at = NULL, finalized_by_user_id = NULL, updated_at = now() WHERE id = $1", [reportId, result.rows[0].id]);
    await this.addReportAudit(userId, reportId, result.rows[0].id, "revision_created", "Created editable report revision");
    return this.getReport(userId, reportId);
  }

  async exportReport(userId: string, reportId: string): Promise<ReportExport | null> {
    const detail = await this.getReport(userId, reportId);
    if (!detail?.currentRevision) return null;
    return {
      filename: `${detail.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "safety-report"}.html`,
      contentType: "text/html; charset=utf-8",
      content: reportHtml(detail)
    };
  }

  async getAssistantDashboard(userId: string, projectId: string): Promise<AssistantDashboard> {
    if (!(await this.getProject(userId, projectId))) throw new Error("Project not found");
    return { conversations: await this.listAssistantConversations(userId, projectId), memoryEntries: await this.listMemoryEntries(userId, { projectId, activeOnly: true }), instructions: await this.listInstructionDocuments(userId, { projectId }), skills: await this.listSkills(userId, { projectId, activeOnly: true }), proposedActions: await this.listProposedActions(userId, { projectId }), actions: this.listAssistantActions() };
  }

  listAssistantActions(): AssistantActionDescriptor[] {
    return assistantActionDescriptors;
  }

  async listAssistantConversations(userId: string, projectId: string): Promise<AssistantConversation[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    const result = await this.pool.query("SELECT * FROM assistant_conversations WHERE owner_user_id = $1 AND project_id = $2 ORDER BY updated_at DESC", [userId, projectId]);
    return result.rows.map(mapAssistantConversation);
  }

  async createAssistantConversation(userId: string, input: AssistantConversationCreateInput): Promise<AssistantConversationDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const context: AssistantContext = { projectId: input.projectId, contractorId: clean(input.contractorId), retrievalScope: input.retrievalScope ?? "current_project", selectedProjectIds: [], activeSkillId: clean(input.activeSkillId) };
    const result = await this.pool.query("INSERT INTO assistant_conversations (project_id, owner_user_id, title, context) VALUES ($1, $2, $3, $4) RETURNING *", [input.projectId, userId, input.title.trim(), context]);
    return this.buildAssistantConversationDetail(mapAssistantConversation(result.rows[0]));
  }

  async getAssistantConversation(userId: string, conversationId: string): Promise<AssistantConversationDetail | null> {
    const result = await this.pool.query("SELECT * FROM assistant_conversations WHERE owner_user_id = $1 AND id = $2", [userId, conversationId]);
    if (!result.rows[0]) return null;
    const conversation = mapAssistantConversation(result.rows[0]);
    if (!(await this.getProject(userId, conversation.projectId))) return null;
    return this.buildAssistantConversationDetail(conversation);
  }

  async updateAssistantConversation(userId: string, conversationId: string, input: AssistantConversationUpdateInput): Promise<AssistantConversationDetail | null> {
    const current = await this.getAssistantConversation(userId, conversationId);
    if (!current) return null;
    for (const projectId of input.selectedProjectIds ?? current.context.selectedProjectIds) if (!(await this.getProject(userId, projectId))) throw new Error("Selected project not found");
    const context: AssistantContext = { ...current.context, contractorId: input.contractorId === undefined ? current.context.contractorId : clean(input.contractorId), retrievalScope: input.retrievalScope ?? current.context.retrievalScope, selectedProjectIds: input.selectedProjectIds ?? current.context.selectedProjectIds, activeSkillId: input.activeSkillId === undefined ? current.context.activeSkillId : clean(input.activeSkillId) };
    const result = await this.pool.query("UPDATE assistant_conversations SET title = $2, context = $3, updated_at = now() WHERE id = $1 RETURNING *", [conversationId, input.title ?? current.title, context]);
    return this.buildAssistantConversationDetail(mapAssistantConversation(result.rows[0]));
  }

  async sendAssistantMessage(userId: string, conversationId: string, input: AssistantMessageSendInput): Promise<AssistantConversationDetail | null> {
    const conversation = await this.getAssistantConversation(userId, conversationId);
    if (!conversation) return null;
    await this.pool.query("INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [conversationId, input.content.trim()]);
    const run = await this.createAssistantRun(userId, conversation, input.content);
    await this.pool.query("INSERT INTO assistant_messages (conversation_id, role, content, provider, model, run_id) VALUES ($1, 'assistant', $2, $3, $4, $5)", [conversationId, this.composeAssistantAnswer(input.content, run), run.provider, run.model, run.id]);
    await this.pool.query("UPDATE assistant_conversations SET updated_at = now() WHERE id = $1", [conversationId]);
    return this.getAssistantConversation(userId, conversationId);
  }

  async listMemoryEntries(userId: string, filters: { projectId?: string; scope?: string; activeOnly?: boolean }): Promise<MemoryEntry[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    const result = await this.pool.query(
      `SELECT * FROM memory_entries WHERE created_by_user_id = $1
       AND ($2::text IS NULL OR scope = $2)
       AND ($3::uuid IS NULL OR scope = 'global' OR project_id = $3)
       AND ($4::boolean = false OR active = true)
       ORDER BY updated_at DESC`,
      [userId, filters.scope ?? null, filters.projectId ?? null, filters.activeOnly ?? false]
    );
    return result.rows.map(mapMemoryEntry);
  }

  async createMemoryEntry(userId: string, input: MemoryEntryCreateInput): Promise<MemoryEntry> {
    const projectId = clean(input.projectId);
    if (input.scope === "project" && (!projectId || !(await this.getProject(userId, projectId)))) throw new Error("Project memory requires an authorized project");
    const result = await this.pool.query("INSERT INTO memory_entries (scope, project_id, content, provenance_type, provenance_id, created_by_user_id, confirmed_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *", [input.scope, input.scope === "project" ? projectId : null, input.content.trim(), clean(input.provenanceType), clean(input.provenanceId), userId]);
    return mapMemoryEntry(result.rows[0]);
  }

  async updateMemoryEntry(userId: string, memoryId: string, input: MemoryEntryUpdateInput): Promise<MemoryEntry | null> {
    const result = await this.pool.query("UPDATE memory_entries SET content = COALESCE($3, content), active = COALESCE($4, active), updated_at = now() WHERE id = $1 AND created_by_user_id = $2 RETURNING *", [memoryId, userId, input.content, input.active]);
    return result.rows[0] ? mapMemoryEntry(result.rows[0]) : null;
  }

  async listInstructionDocuments(userId: string, filters: { projectId?: string; scope?: string }): Promise<InstructionDocument[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    const result = await this.pool.query("SELECT * FROM instruction_documents WHERE created_by_user_id = $1 AND ($2::text IS NULL OR scope = $2) AND ($3::uuid IS NULL OR scope = 'global' OR project_id = $3) ORDER BY scope, area", [userId, filters.scope ?? null, filters.projectId ?? null]);
    return result.rows.map(mapInstructionDocument);
  }

  async saveInstructionDocument(userId: string, input: InstructionDocumentSaveInput): Promise<InstructionDocument> {
    const projectId = clean(input.projectId);
    if (input.scope === "project" && (!projectId || !(await this.getProject(userId, projectId)))) throw new Error("Project instruction requires an authorized project");
    const result = await this.pool.query(
      `INSERT INTO instruction_documents (scope, project_id, area, title, markdown, created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (created_by_user_id, scope, project_id, area) DO UPDATE SET title = EXCLUDED.title, markdown = EXCLUDED.markdown, version = instruction_documents.version + 1, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
       RETURNING *`,
      [input.scope, input.scope === "project" ? projectId : null, input.area.trim(), input.title.trim(), input.markdown.trim(), userId]
    );
    return mapInstructionDocument(result.rows[0]);
  }

  async listSkills(userId: string, filters: { projectId?: string; scope?: string; activeOnly?: boolean }): Promise<AssistantSkill[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    const result = await this.pool.query("SELECT * FROM assistant_skills WHERE created_by_user_id = $1 AND ($2::text IS NULL OR scope = $2) AND ($3::uuid IS NULL OR scope = 'global' OR project_id = $3) AND ($4::boolean = false OR active = true) ORDER BY name", [userId, filters.scope ?? null, filters.projectId ?? null, filters.activeOnly ?? false]);
    return result.rows.map(mapAssistantSkill);
  }

  async saveSkill(userId: string, input: SkillSaveInput): Promise<AssistantSkill> {
    const projectId = clean(input.projectId);
    if (input.scope === "project" && (!projectId || !(await this.getProject(userId, projectId)))) throw new Error("Project skill requires an authorized project");
    const existing = await this.pool.query("SELECT * FROM assistant_skills WHERE created_by_user_id = $1 AND scope = $2 AND COALESCE(project_id::text, '') = COALESCE($3::text, '') AND lower(name) = lower($4) LIMIT 1", [userId, input.scope, input.scope === "project" ? projectId : null, input.name.trim()]);
    if (existing.rows[0]) {
      const result = await this.pool.query(`UPDATE assistant_skills SET description=$2, trigger_description=$3, guided_purpose=$4, guided_inputs=$5, guided_outputs=$6, guided_rules=$7, guided_authority_limits=$8, markdown=$9, active=$10, version=version+1, updated_by_user_id=$11, updated_at=now() WHERE id=$1 RETURNING *`, [existing.rows[0].id, input.description.trim(), input.triggerDescription.trim(), clean(input.guidedPurpose), clean(input.guidedInputs), clean(input.guidedOutputs), clean(input.guidedRules), clean(input.guidedAuthorityLimits), input.markdown.trim(), input.active ?? true, userId]);
      return mapAssistantSkill(result.rows[0]);
    }
    const result = await this.pool.query(`INSERT INTO assistant_skills (scope, project_id, name, description, trigger_description, guided_purpose, guided_inputs, guided_outputs, guided_rules, guided_authority_limits, markdown, active, created_by_user_id, updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING *`, [input.scope, input.scope === "project" ? projectId : null, input.name.trim(), input.description.trim(), input.triggerDescription.trim(), clean(input.guidedPurpose), clean(input.guidedInputs), clean(input.guidedOutputs), clean(input.guidedRules), clean(input.guidedAuthorityLimits), input.markdown.trim(), input.active ?? true, userId]);
    return mapAssistantSkill(result.rows[0]);
  }

  async setActiveSkill(userId: string, conversationId: string, input: SkillActivationInput): Promise<AssistantConversationDetail | null> {
    return this.updateAssistantConversation(userId, conversationId, { activeSkillId: input.activeSkillId ?? "" });
  }

  async invokeAssistantAction(userId: string, input: AssistantActionInvokeInput): Promise<AssistantActionResult> {
    const descriptor = assistantActionDescriptors.find((action) => action.name === input.actionName);
    if (!descriptor) throw new Error("Assistant action is not registered");
    const conversation = input.conversationId ? await this.getAssistantConversation(userId, input.conversationId) : null;
    if (input.conversationId && !conversation) throw new Error("Conversation not found");
    const projectId = String(input.input.projectId ?? conversation?.projectId ?? "");
    if (!projectId || !(await this.getProject(userId, projectId))) throw new Error("Project not found");
    const context = conversation?.context ?? { projectId, contractorId: null, retrievalScope: "current_project" as const, selectedProjectIds: [], activeSkillId: null };
    const run = await this.createAssistantRun(userId, { id: conversation?.id ?? "", projectId, ownerUserId: userId, title: "Action", context, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, input.actionName);
    const result = await this.executeAssistantAction(userId, descriptor, projectId, conversation?.id ?? null, input.input, run.retrievalManifest);
    return { actionName: descriptor.name, actionType: descriptor.actionType, result: result.result, proposal: result.proposal, run };
  }

  async listProposedActions(userId: string, filters: { projectId?: string; conversationId?: string }): Promise<ProposedAction[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    const result = await this.pool.query("SELECT * FROM proposed_actions WHERE created_by_user_id = $1 AND ($2::uuid IS NULL OR conversation_id = $2) ORDER BY updated_at DESC", [userId, filters.conversationId ?? null]);
    return result.rows.map(mapProposedAction).filter((proposal) => !filters.projectId || proposal.evidence.projectIds.includes(filters.projectId));
  }

  async editProposedAction(userId: string, proposalId: string, input: ProposedActionEditInput): Promise<ProposedAction | null> {
    const result = await this.pool.query("UPDATE proposed_actions SET proposed_change = COALESCE($3, proposed_change), rationale = COALESCE($4, rationale), status = 'edited', updated_at = now() WHERE id = $1 AND created_by_user_id = $2 AND status IN ('proposed','edited') RETURNING *", [proposalId, userId, input.proposedChange, clean(input.rationale)]);
    return result.rows[0] ? mapProposedAction(result.rows[0]) : null;
  }

  async confirmProposedAction(userId: string, proposalId: string, input: ProposedActionConfirmInput): Promise<ProposedAction | null> {
    const current = (await this.pool.query("SELECT * FROM proposed_actions WHERE id = $1 AND created_by_user_id = $2", [proposalId, userId])).rows[0];
    if (!current || !["proposed", "edited"].includes(String(current.status))) return null;
    const proposal = mapProposedAction(current);
    try {
      let executedResult: Record<string, unknown>;
      if (proposal.actionName === "propose_save_memory") {
        const saved = await this.createMemoryEntry(userId, proposal.proposedChange as unknown as MemoryEntryCreateInput);
        executedResult = { memoryId: saved.id };
      } else if (proposal.actionName === "propose_update_observation_followup") {
        const updated = await this.updateObservation(userId, String(proposal.targetId), proposal.proposedChange);
        executedResult = { observationId: updated?.id };
      } else {
        throw new Error("No execution handler for proposed action");
      }
      const result = await this.pool.query("UPDATE proposed_actions SET status = 'executed', confirmed_by_user_id = $3, confirmation_note = $4, executed_result = $5, updated_at = now() WHERE id = $1 AND created_by_user_id = $2 RETURNING *", [proposalId, userId, userId, clean(input.confirmationNote), executedResult]);
      return mapProposedAction(result.rows[0]);
    } catch (error) {
      const result = await this.pool.query("UPDATE proposed_actions SET status = 'failed', confirmed_by_user_id = $3, confirmation_note = $4, error_state = $5, updated_at = now() WHERE id = $1 AND created_by_user_id = $2 RETURNING *", [proposalId, userId, userId, clean(input.confirmationNote), error instanceof Error ? error.message : "Proposal execution failed"]);
      return mapProposedAction(result.rows[0]);
    }
  }

  async rejectProposedAction(userId: string, proposalId: string, input: ProposedActionRejectInput): Promise<ProposedAction | null> {
    const result = await this.pool.query("UPDATE proposed_actions SET status = 'rejected', rejection_reason = $3, updated_at = now() WHERE id = $1 AND created_by_user_id = $2 AND status IN ('proposed','edited') RETURNING *", [proposalId, userId, clean(input.rejectionReason)]);
    return result.rows[0] ? mapProposedAction(result.rows[0]) : null;
  }

  private async buildReportDetail(report: SafetyReport): Promise<SafetyReportDetail> {
    const revisions = await this.pool.query("SELECT * FROM safety_report_revisions WHERE report_id = $1 ORDER BY revision_number DESC", [report.id]);
    const audit = await this.pool.query("SELECT * FROM safety_report_audit_events WHERE report_id = $1 ORDER BY created_at ASC", [report.id]);
    const mappedRevisions = revisions.rows.map(mapReportRevision);
    return {
      ...report,
      currentRevision: report.currentRevisionId ? mappedRevisions.find((revision) => revision.id === report.currentRevisionId) ?? null : null,
      revisions: mappedRevisions,
      auditEvents: audit.rows.map(mapReportAudit)
    };
  }

  private async buildReportEvidenceContext(userId: string, report: SafetyReport): Promise<ReportEvidenceContext> {
    const project = (await this.getProject(userId, report.projectId)) as Project;
    const engagements = await this.listProjectEngagements(userId, report.projectId);
    const observations = await this.listObservations(userId, { projectId: report.projectId });
    const incidents = await this.listIncidents(userId, { projectId: report.projectId });
    const inPeriodObservations = observations.filter((item) => item.observedAt.slice(0, 10) >= report.periodStart && item.observedAt.slice(0, 10) <= report.periodEnd);
    const carriedObservations = observations.filter((item) => item.observedAt.slice(0, 10) < report.periodStart && item.followUpStatus === "needed");
    const inPeriodIncidents = incidents.filter((item) => item.incidentDateTime.slice(0, 10) >= report.periodStart && item.incidentDateTime.slice(0, 10) <= report.periodEnd);
    const carriedIncidents = incidents.filter((item) => item.incidentDateTime.slice(0, 10) < report.periodStart && item.oversightStatus !== "closed");
    const plansResult = await this.pool.query("SELECT * FROM safety_plans WHERE project_id = $1 ORDER BY created_at DESC", [report.projectId]);
    const safetyPlans = plansResult.rows.map(mapSafetyPlan);
    const reviewsResult = await this.pool.query("SELECT pr.* FROM plan_reviews pr JOIN safety_plans sp ON sp.id = pr.plan_id WHERE sp.project_id = $1", [report.projectId]);
    const readinessResult = await this.pool.query(
      `SELECT crs.*, rr.id AS rr_id, rr.project_id, rr.title, rr.description, rr.category, rr.source_id, rr.source_chunk_id,
              rr.citation_label, rr.required, rr.blocking, rr.due_date, rr.created_at AS rr_created_at, rr.updated_at AS rr_updated_at
       FROM contractor_requirement_statuses crs
       JOIN readiness_requirements rr ON rr.id = crs.requirement_id
       JOIN project_contractor_engagements e ON e.id = crs.engagement_id
       WHERE e.project_id = $1`,
      [report.projectId]
    );
    const readinessStatuses = readinessResult.rows.map((row) => mapRequirementStatus(row, mapReadinessRequirement({
      id: row.rr_id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      category: row.category,
      source_id: row.source_id,
      source_chunk_id: row.source_chunk_id,
      citation_label: row.citation_label,
      required: row.required,
      blocking: row.blocking,
      due_date: row.due_date,
      created_at: row.rr_created_at,
      updated_at: row.rr_updated_at
    })));
    const decisionsResult = await this.pool.query("SELECT * FROM project_safety_decisions WHERE project_id = $1 AND status = 'active' ORDER BY created_at DESC", [report.projectId]);
    const projectDecisions = decisionsResult.rows.map((row) => mapProjectSafetyDecision(row));
    const inPeriodDecisions = projectDecisions.filter((decision) => decision.effectiveDate ? decision.effectiveDate >= report.periodStart && decision.effectiveDate <= report.periodEnd : decision.createdAt.slice(0, 10) >= report.periodStart && decision.createdAt.slice(0, 10) <= report.periodEnd);
    const sourceResult = await this.pool.query(
      `SELECT source_id FROM incident_attachments ia JOIN incidents i ON i.id = ia.incident_id WHERE i.project_id = $1
       UNION SELECT source_id FROM safety_plan_revisions spr JOIN safety_plans sp ON sp.id = spr.plan_id WHERE sp.project_id = $1
       UNION SELECT source_id FROM observation_reference_links orl JOIN field_observations fo ON fo.id = orl.observation_id WHERE fo.project_id = $1`,
      [report.projectId]
    );
    const manifest: ReportEvidenceManifest = {
      generatedAt: new Date().toISOString(),
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      newDuringPeriod: {
        observationIds: inPeriodObservations.map((item) => item.id),
        incidentIds: inPeriodIncidents.map((item) => item.id),
        planReviewIds: reviewsResult.rows.filter((row) => new Date(row.created_at as string).toISOString().slice(0, 10) >= report.periodStart && new Date(row.created_at as string).toISOString().slice(0, 10) <= report.periodEnd).map((row) => String(row.id)),
        readinessStatusIds: readinessStatuses.filter((status) => status.updatedAt.slice(0, 10) >= report.periodStart && status.updatedAt.slice(0, 10) <= report.periodEnd).map((status) => status.id),
        projectDecisionIds: inPeriodDecisions.map((decision) => decision.id)
      },
      carriedOpen: {
        observationIds: report.scope.includeOpenFollowUp ? carriedObservations.map((item) => item.id) : [],
        incidentIds: report.scope.includeOpenFollowUp ? carriedIncidents.map((item) => item.id) : [],
        planReviewIds: reviewsResult.rows.filter((row) => new Date(row.created_at as string).toISOString().slice(0, 10) < report.periodStart && row.status !== "approved").map((row) => String(row.id)),
        readinessStatusIds: readinessStatuses.filter((status) => status.updatedAt.slice(0, 10) < report.periodStart && !["accepted", "not_applicable"].includes(status.status)).map((status) => status.id),
        projectDecisionIds: projectDecisions.filter((decision) => !inPeriodDecisions.some((item) => item.id === decision.id)).map((decision) => decision.id)
      },
      sourceIds: sourceResult.rows.map((row) => String(row.source_id))
    };
    return { project, reportType: report.reportType, format: report.format, periodStart: report.periodStart, periodEnd: report.periodEnd, scope: report.scope, manualInputs: report.manualInputs, engagements, observations: inPeriodObservations, carriedObservations, incidents: inPeriodIncidents, carriedIncidents, safetyPlans, readinessStatuses, projectDecisions, manifest };
  }

  private async nextReportRevisionNumber(reportId: string): Promise<number> {
    const result = await this.pool.query("SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision FROM safety_report_revisions WHERE report_id = $1", [reportId]);
    return Number(result.rows[0].next_revision);
  }

  private async addReportAudit(userId: string, reportId: string, revisionId: string | null, eventType: string, message: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO safety_report_audit_events (report_id, revision_id, event_type, message, actor_user_id) VALUES ($1, $2, $3, $4, $5)",
      [reportId, revisionId, eventType, message, userId]
    );
  }

  private async buildAssistantConversationDetail(conversation: AssistantConversation): Promise<AssistantConversationDetail> {
    const messages = await this.pool.query("SELECT * FROM assistant_messages WHERE conversation_id = $1 ORDER BY created_at ASC", [conversation.id]);
    const runs = await this.pool.query("SELECT * FROM assistant_runs WHERE conversation_id = $1 ORDER BY created_at ASC", [conversation.id]);
    return { ...conversation, messages: messages.rows.map(mapAssistantMessage), runs: runs.rows.map(mapAssistantRun) };
  }

  private async createAssistantRun(userId: string, conversation: AssistantConversation, query: string): Promise<AssistantRun> {
    const manifest = await this.buildAssistantRetrievalManifest(userId, conversation.context, query);
    const skill = conversation.context.activeSkillId ? (await this.getSkillForContext(userId, conversation.context.activeSkillId, conversation.projectId)) : null;
    const summary: AssistantContextSummary = { scope: conversation.context.retrievalScope, sources: manifest.sourceIds.length, sourceChunks: manifest.sourceChunkIds.length, operationalRecords: manifest.operationalRecords.length, memoryEntries: manifest.memoryIds.length, instructions: manifest.instructionIds, activeSkill: skill?.name ?? null, activeSkillVersion: skill?.version ?? null };
    const result = await this.pool.query(
      "INSERT INTO assistant_runs (conversation_id, status, provider, model, context_summary, retrieval_manifest, error_state, completed_at) VALUES ($1, 'completed', $2, $3, $4, $5, $6, now()) RETURNING *",
      [conversation.id || null, process.env.ASSISTANT_AI_PROVIDER === "openai" ? "openai-unconfigured" : "local-assistant-orchestrator", process.env.ASSISTANT_AI_PROVIDER === "openai" ? process.env.OPENAI_ASSISTANT_MODEL ?? null : "deterministic-context-orchestrator-v1", summary, manifest, process.env.ASSISTANT_AI_PROVIDER === "fail-test" ? "Assistant provider test failure; deterministic read/draft actions remain available." : null]
    );
    return mapAssistantRun(result.rows[0]);
  }

  private composeAssistantAnswer(prompt: string, run: AssistantRun): string {
    const records = run.retrievalManifest.operationalRecords.slice(0, 6).map((record) => `- ${record.type}: ${record.label}`).join("\n") || "- No matching operational records found in the selected scope.";
    const providerLine = run.errorState ? `\n\nProvider note: ${run.errorState}` : "";
    const suggested = prompt.toLowerCase().includes("meeting") ? "\n\nSuggested actions:\n- Draft project meeting brief\n- Review open follow-up\n- Check pending proposed actions" : "\n\nSuggested actions:\n- Retrieve sources\n- Draft project meeting brief\n- Propose memory update";
    return ["Context used", `Scope: ${run.contextSummary.scope}`, `Sources: ${run.contextSummary.sources}`, `Operational records: ${run.contextSummary.operationalRecords}`, `Project Memory: ${run.contextSummary.memoryEntries} entries`, `Instructions: ${run.contextSummary.instructions.length}`, `Active Skill: ${run.contextSummary.activeSkill ?? "None"}`, "", "Grounded summary", records, providerLine, suggested].join("\n");
  }

  private async buildAssistantRetrievalManifest(userId: string, context: AssistantContext, query: string): Promise<AssistantRetrievalManifest> {
    const projectIds = await this.authorizedAssistantProjectIds(userId, context);
    const chunks = await this.searchSourceChunks(userId, { q: query || "safety", projectId: context.projectId, activeOnly: context.retrievalScope !== "global_library" });
    const operationalRecords: Array<{ type: string; id: string; label: string }> = [];
    for (const projectId of projectIds) {
      const observations = await this.listObservations(userId, { projectId });
      const incidents = await this.listIncidents(userId, { projectId });
      const reports = await this.listReports(userId, { projectId });
      observations.filter((item) => !context.contractorId || item.contractorId === context.contractorId).slice(0, 8).forEach((item) => operationalRecords.push({ type: "observation", id: item.id, label: item.derivedSummary ?? item.originalText }));
      incidents.filter((item) => !context.contractorId || item.contractorId === context.contractorId).slice(0, 8).forEach((item) => operationalRecords.push({ type: "incident", id: item.id, label: item.factualDescription }));
      reports.slice(0, 4).forEach((item) => operationalRecords.push({ type: "report", id: item.id, label: item.title }));
    }
    const memories = await this.listMemoryEntries(userId, { projectId: context.projectId, activeOnly: true });
    const instructions = await this.listInstructionDocuments(userId, { projectId: context.projectId });
    const skill = context.activeSkillId ? await this.getSkillForContext(userId, context.activeSkillId, context.projectId) : null;
    return { scope: context.retrievalScope, projectIds, contractorId: context.contractorId, sourceIds: [...new Set(chunks.map((chunk) => chunk.sourceId))], sourceChunkIds: chunks.map((chunk) => chunk.id), operationalRecords, memoryIds: memories.map((entry) => entry.id), instructionIds: instructions.map((doc) => doc.id), skillId: skill?.id ?? null, skillVersion: skill?.version ?? null };
  }

  private async authorizedAssistantProjectIds(userId: string, context: AssistantContext): Promise<string[]> {
    if (context.retrievalScope === "selected_projects") {
      const allowed: string[] = [];
      for (const projectId of context.selectedProjectIds) if (await this.getProject(userId, projectId)) allowed.push(projectId);
      return allowed.length ? allowed : [context.projectId];
    }
    if (context.retrievalScope === "entire_workspace") return (await this.listProjects(userId)).map((project) => project.id);
    return [context.projectId];
  }

  private async getSkillForContext(userId: string, skillId: string, projectId: string): Promise<AssistantSkill | null> {
    const result = await this.pool.query("SELECT * FROM assistant_skills WHERE id = $1 AND created_by_user_id = $2 AND active = true", [skillId, userId]);
    if (!result.rows[0]) return null;
    const skill = mapAssistantSkill(result.rows[0]);
    return skill.scope === "project" && skill.projectId !== projectId ? null : skill;
  }

  private async executeAssistantAction(userId: string, descriptor: AssistantActionDescriptor, projectId: string, conversationId: string | null, input: Record<string, unknown>, evidence: AssistantRetrievalManifest): Promise<{ result: unknown; proposal?: ProposedAction }> {
    if (descriptor.name === "get_project_status") return { result: { summaries: await this.listProjectReadinessSummaries(userId, projectId), observations: await this.listObservations(userId, { projectId }), incidents: await this.listIncidents(userId, { projectId }), reports: await this.listReports(userId, { projectId }) } };
    if (descriptor.name === "get_open_observation_followup") return { result: { observations: await this.listObservations(userId, { projectId, followUpStatus: "needed" }) } };
    if (descriptor.name === "get_open_incident_followup") return { result: { incidents: await this.listIncidents(userId, { projectId, openOnly: true }) } };
    if (descriptor.name === "get_reports") return { result: { reports: await this.listReports(userId, { projectId }) } };
    if (descriptor.name === "retrieve_sources") return { result: { chunks: await this.searchSourceChunks(userId, { q: String(input.q ?? ""), projectId, activeOnly: true }) } };
    if (descriptor.name === "draft_project_meeting_brief") {
      const observations = await this.listObservations(userId, { projectId, followUpStatus: "needed" });
      const incidents = await this.listIncidents(userId, { projectId, openOnly: true });
      const reports = await this.listReports(userId, { projectId });
      return { result: { markdown: ["# Project Meeting Brief", "", `Open observation follow-up: ${observations.length}`, `Open incidents: ${incidents.length}`, `Recent reports: ${reports.length}`, "", "This is a draft artifact and does not modify operational records."].join("\n") } };
    }
    if (descriptor.name === "draft_contractor_followup") return { result: { markdown: "Draft contractor follow-up:\n\nPlease review the open project safety items and provide updated evidence or status before the next coordination meeting.\n\nThis is draft wording only." } };
    if (descriptor.name === "propose_save_memory") {
      const proposal = await this.createProposal(userId, conversationId, descriptor.name, "memory", null, {}, { scope: input.scope ?? "project", projectId, content: String(input.content ?? ""), provenanceType: input.provenanceType ?? "assistant_proposal", provenanceId: input.provenanceId ?? "" }, String(input.rationale ?? "Assistant proposed memory for human review."), evidence);
      return { result: { proposalId: proposal.id }, proposal };
    }
    if (descriptor.name === "propose_update_observation_followup") {
      const observation = await this.getObservation(userId, String(input.observationId ?? ""));
      if (!observation || observation.projectId !== projectId) throw new Error("Observation not found");
      const proposal = await this.createProposal(userId, conversationId, descriptor.name, "observation", observation.id, { snapshotLength: JSON.stringify(observation).length }, { followUpStatus: input.followUpStatus ?? "verified_closed", followUpNote: input.followUpNote ?? "Updated by confirmed assistant proposal." }, String(input.rationale ?? "Assistant proposed follow-up update for human review."), evidence);
      return { result: { proposalId: proposal.id }, proposal };
    }
    throw new Error("Assistant action handler unavailable");
  }

  private async createProposal(userId: string, conversationId: string | null, actionName: string, targetType: string, targetId: string | null, currentState: Record<string, unknown>, proposedChange: Record<string, unknown>, rationale: string, evidence: AssistantRetrievalManifest): Promise<ProposedAction> {
    const result = await this.pool.query("INSERT INTO proposed_actions (conversation_id, action_name, target_type, target_id, current_state, proposed_change, rationale, evidence, created_by_user_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'proposed') RETURNING *", [conversationId, actionName, targetType, targetId, currentState, proposedChange, rationale, evidence, userId]);
    return mapProposedAction(result.rows[0]);
  }

  private async getEngagementForUser(userId: string, engagementId: string): Promise<ProjectContractorEngagement | null> {
    const result = await this.pool.query(
      `SELECT e.*
       FROM project_contractor_engagements e
       JOIN projects p ON p.id = e.project_id
       WHERE p.owner_user_id = $1 AND e.id = $2`,
      [userId, engagementId]
    );
    return result.rows[0] ? mapEngagement(result.rows[0]) : null;
  }

  private async getPlanForUser(userId: string, planId: string): Promise<SafetyPlan | null> {
    const result = await this.pool.query(
      `SELECT sp.*
       FROM safety_plans sp
       JOIN projects p ON p.id = sp.project_id
       WHERE p.owner_user_id = $1 AND sp.id = $2`,
      [userId, planId]
    );
    return result.rows[0] ? mapSafetyPlan(result.rows[0]) : null;
  }

  private async getReviewForUser(userId: string, reviewId: string): Promise<PlanReview | null> {
    const result = await this.pool.query(
      `SELECT pr.*
       FROM plan_reviews pr
       JOIN safety_plans sp ON sp.id = pr.plan_id
       JOIN projects p ON p.id = sp.project_id
       WHERE p.owner_user_id = $1 AND pr.id = $2`,
      [userId, reviewId]
    );
    return result.rows[0] ? mapPlanReview(result.rows[0]) : null;
  }

  private async hasHumanPlanReviewWork(reviewId: string): Promise<boolean> {
    const review = await this.pool.query("SELECT * FROM plan_reviews WHERE id = $1", [reviewId]);
    const findings = await this.pool.query("SELECT * FROM plan_findings WHERE review_id = $1", [reviewId]);
    const currentReview = review.rows[0] ? mapPlanReview(review.rows[0]) : null;
    return Boolean(
      currentReview?.internalReviewerNotes ||
      findings.rows.map(mapPlanFinding).some((finding) =>
        finding.origin === "reviewer" ||
        finding.reviewerNotes ||
        finding.resolved ||
        finding.notApplicable ||
        (finding.reviewerExplanation && finding.reviewerExplanation !== finding.aiExplanation)
      )
    );
  }

  private async getFindingForUser(userId: string, findingId: string): Promise<PlanFinding | null> {
    const result = await this.pool.query(
      `SELECT pf.*
       FROM plan_findings pf
       JOIN plan_reviews pr ON pr.id = pf.review_id
       JOIN safety_plans sp ON sp.id = pr.plan_id
       JOIN projects p ON p.id = sp.project_id
       WHERE p.owner_user_id = $1 AND pf.id = $2`,
      [userId, findingId]
    );
    return result.rows[0] ? mapPlanFinding(result.rows[0]) : null;
  }

  private async getPlanFindingForProject(userId: string, findingId: string, projectId: string): Promise<PlanFinding | null> {
    const result = await this.pool.query(
      `SELECT pf.*
       FROM plan_findings pf
       JOIN plan_reviews pr ON pr.id = pf.review_id
       JOIN safety_plans sp ON sp.id = pr.plan_id
       JOIN projects p ON p.id = sp.project_id
       WHERE p.owner_user_id = $1 AND p.id = $2 AND pf.id = $3`,
      [userId, projectId, findingId]
    );
    return result.rows[0] ? mapPlanFinding(result.rows[0]) : null;
  }

  private async mapIncidentWithContext(row: Record<string, unknown>): Promise<IncidentRecord> {
    const engagement = row.engagement_id ? await this.getEngagementById(String(row.engagement_id)) : undefined;
    return mapIncident(row, engagement ?? undefined);
  }

  private async buildIncidentDetail(userId: string, row: Record<string, unknown>): Promise<IncidentDetail> {
    const incident = await this.mapIncidentWithContext(row);
    const attachments = await this.pool.query("SELECT * FROM incident_attachments WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    const actions = await this.pool.query("SELECT * FROM contractor_corrective_actions WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    const review = await this.pool.query("SELECT * FROM incident_project_reviews WHERE incident_id = $1", [incident.id]);
    const recommendations = await this.pool.query("SELECT * FROM incident_recommendations WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    const decisions = await this.pool.query("SELECT * FROM project_safety_decisions WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    const followUps = await this.pool.query("SELECT * FROM incident_followups WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    const links = await this.pool.query("SELECT * FROM incident_links WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    const audit = await this.pool.query("SELECT * FROM incident_audit_events WHERE incident_id = $1 ORDER BY created_at", [incident.id]);
    return {
      ...incident,
      attachments: await Promise.all(attachments.rows.map(async (attachment) => mapIncidentAttachment(attachment, (await this.getSource(userId, attachment.source_id)) ?? undefined))),
      contractorCorrectiveActions: await Promise.all(actions.rows.map(async (action) => mapCorrectiveAction(action, action.source_id ? (await this.getSource(userId, action.source_id)) ?? undefined : undefined))),
      projectReview: review.rows[0] ? mapIncidentProjectReview(review.rows[0]) : null,
      recommendations: recommendations.rows.map(mapIncidentRecommendation),
      projectDecisions: await Promise.all(decisions.rows.map(async (decision) => mapProjectSafetyDecision(decision, decision.supporting_source_id ? (await this.getSource(userId, decision.supporting_source_id)) ?? undefined : undefined))),
      followUps: await Promise.all(followUps.rows.map(async (followUp) => mapIncidentFollowUp(followUp, followUp.linked_source_id ? (await this.getSource(userId, followUp.linked_source_id)) ?? undefined : undefined, followUp.linked_observation_id ? (await this.getObservation(userId, followUp.linked_observation_id)) ?? undefined : undefined))),
      links: await Promise.all(links.rows.map(async (link) => mapIncidentLink(link, link.plan_finding_id ? (await this.getFindingForUser(userId, link.plan_finding_id)) ?? undefined : undefined, link.observation_id ? (await this.getObservation(userId, link.observation_id)) ?? undefined : undefined))),
      auditEvents: audit.rows.map(mapIncidentAudit)
    };
  }

  private async mapObservationWithContext(row: Record<string, unknown>): Promise<FieldObservation> {
    const engagement = row.engagement_id ? await this.getEngagementById(String(row.engagement_id)) : undefined;
    return mapObservation(row, engagement ?? undefined);
  }

  private async buildObservationDetail(userId: string, row: Record<string, unknown>): Promise<ObservationDetail> {
    const observation = await this.mapObservationWithContext(row);
    const photos = await this.pool.query("SELECT * FROM observation_photos WHERE observation_id = $1 ORDER BY created_at", [observation.id]);
    const references = await this.pool.query("SELECT * FROM observation_reference_links WHERE observation_id = $1 ORDER BY created_at", [observation.id]);
    const findingLinks = await this.pool.query("SELECT * FROM observation_plan_finding_links WHERE observation_id = $1 ORDER BY created_at", [observation.id]);
    const audit = await this.pool.query("SELECT * FROM observation_audit_events WHERE observation_id = $1 ORDER BY created_at", [observation.id]);
    return {
      ...observation,
      photos: await Promise.all(photos.rows.map(async (photo) => mapObservationPhoto(photo, (await this.getSource(userId, photo.source_id)) ?? undefined))),
      referenceLinks: await Promise.all(references.rows.map(async (link) => mapObservationReference(link, (await this.getSource(userId, link.source_id)) ?? undefined))),
      planFindingLinks: await Promise.all(findingLinks.rows.map(async (link) => mapObservationPlanFindingLink(link, (await this.getFindingForUser(userId, link.finding_id)) ?? undefined))),
      auditEvents: audit.rows.map(mapObservationAudit)
    };
  }

  private async refreshObservationRecurrence(observationId: string): Promise<void> {
    const current = await this.pool.query("SELECT * FROM field_observations WHERE id = $1", [observationId]);
    const observation = current.rows[0];
    if (!observation || !observation.category) return;
    const result = await this.pool.query(
      `SELECT count(*)::int AS count
       FROM field_observations
       WHERE id <> $1 AND project_id = $2 AND category = $3 AND ($4::uuid IS NULL OR engagement_id = $4)`,
      [observationId, observation.project_id, observation.category, observation.engagement_id]
    );
    const recurrenceCount = Number(result.rows[0]?.count ?? 0);
    await this.pool.query(
      "UPDATE field_observations SET recurrence_count = $2, recurrence_summary = $3 WHERE id = $1",
      [
        observationId,
        recurrenceCount,
        recurrenceCount > 0 ? `${recurrenceCount} prior observation${recurrenceCount === 1 ? "" : "s"} share this project/category context.` : null
      ]
    );
  }

  private async getEngagementById(engagementId: string): Promise<ProjectContractorEngagement | null> {
    const result = await this.pool.query("SELECT * FROM project_contractor_engagements WHERE id = $1", [engagementId]);
    if (!result.rows[0]) return null;
    const contractor = await this.pool.query("SELECT * FROM contractors WHERE id = $1", [result.rows[0].contractor_id]);
    return mapEngagement(result.rows[0], contractor.rows[0] ? mapContractor(contractor.rows[0]) : undefined);
  }

  private async addObservationAudit(userId: string, observationId: string, eventType: string, message: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO observation_audit_events (observation_id, event_type, message, actor_user_id) VALUES ($1, $2, $3, $4)",
      [observationId, eventType, message, userId]
    );
  }

  private async addIncidentAudit(userId: string, incidentId: string, eventType: string, message: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO incident_audit_events (incident_id, event_type, message, actor_user_id) VALUES ($1, $2, $3, $4)",
      [incidentId, eventType, message, userId]
    );
  }

  private async insertPlanRevision(
    planId: string,
    sourceId: string,
    revisionIdentifier: string,
    submittedDate?: string,
    priorRevisionId?: string
  ): Promise<SafetyPlanRevision> {
    const result = await this.pool.query(
      `INSERT INTO safety_plan_revisions (plan_id, source_id, revision_identifier, submitted_date, prior_revision_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [planId, sourceId, revisionIdentifier.trim(), clean(submittedDate), clean(priorRevisionId)]
    );
    return mapSafetyPlanRevision(result.rows[0]);
  }

  private async ensureSelectableReviewReference(projectId: string, source: SourceRecord): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM project_sources
       WHERE project_id = $1 AND source_id = $2 AND activation_status = 'active'
       LIMIT 1`,
      [projectId, source.id]
    );
    if (source.scope === "global" || source.projectId === projectId || result.rows[0]) return;
    throw new Error("Review source is not available to this project");
  }

  private generateDraftFindings(review: PlanReview, planSource: SourceDetail, references: PlanReviewReference[]): PlanFinding[] {
    const planText = planSource.chunks.map((chunk) => chunk.text).join(" ").toLowerCase();
    const firstPlanChunk = planSource.chunks[0];
    return references.map((reference, index) => {
      const referenceChunks = reference.source ? this.chunksFromDetail(reference.source, reference.sourceChunkId) : [];
      const referenceText = referenceChunks[0]?.text ?? reference.source?.title ?? "Selected reference";
      const keywords = referenceText.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4).slice(0, 8);
      const matched = keywords.some((word) => planText.includes(word));
      const authority = reference.authorityClassification === "regulatory_requirement" ? "regulatory_requirement" : "project_requirement";
      return {
        id: randomUUID(),
        reviewId: review.id,
        title: matched ? `Plan addresses ${reference.source?.title ?? "selected reference"}` : `Review needed for ${reference.source?.title ?? "selected reference"}`,
        findingType: matched ? "compliant" : "deficiency",
        authority,
        planSourceId: planSource.id,
        planSourceChunkId: firstPlanChunk?.id ?? null,
        referenceSourceId: reference.sourceId,
        referenceSourceChunkId: reference.sourceChunkId,
        referenceCitationLabel: reference.citationLabel ?? reference.source?.title ?? null,
        aiExplanation: matched
          ? "The submitted plan appears to address language found in the selected reference. Reviewer confirmation is still required."
          : "The selected reference contains terms that were not clearly found in the submitted plan extraction. This is a draft deficiency for reviewer evaluation.",
        reviewerExplanation: matched ? "Accepted for reviewer confirmation." : "Clarify or revise the plan to address the selected review source.",
        reviewerNotes: null,
        contractorFacingRecommendation: matched ? null : `Revise the plan to address ${reference.source?.title ?? "the selected reference"}.`,
        recommendedRevisionText: matched ? null : "Add project-specific language describing how this requirement will be met before the work begins.",
        reviewerDecision: null,
        resolved: false,
        notApplicable: false,
        origin: "assistant",
        sortOrder: index,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  }

  private chunksFromDetail(source: SourceRecord, sourceChunkId: string | null): SourceChunk[] {
    void source;
    void sourceChunkId;
    return [];
  }

  private materializeFinding(input: PlanFindingCreateInput, reviewId: string, origin: "assistant" | "reviewer"): PlanFinding {
    const timestamp = new Date().toISOString();
    return {
      id: randomUUID(),
      reviewId,
      title: input.title.trim(),
      findingType: input.findingType,
      authority: input.authority,
      planSourceId: clean(input.planSourceId),
      planSourceChunkId: clean(input.planSourceChunkId),
      referenceSourceId: clean(input.referenceSourceId),
      referenceSourceChunkId: clean(input.referenceSourceChunkId),
      referenceCitationLabel: clean(input.referenceCitationLabel),
      aiExplanation: clean(input.aiExplanation),
      reviewerExplanation: clean(input.reviewerExplanation),
      reviewerNotes: clean(input.reviewerNotes),
      contractorFacingRecommendation: clean(input.contractorFacingRecommendation),
      recommendedRevisionText: clean(input.recommendedRevisionText),
      reviewerDecision: clean(input.reviewerDecision),
      resolved: false,
      notApplicable: false,
      origin,
      sortOrder: input.sortOrder ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  private async insertPlanFinding(finding: PlanFinding): Promise<void> {
    await this.pool.query(
      `INSERT INTO plan_findings
       (id, review_id, title, finding_type, authority, plan_source_id, plan_source_chunk_id, reference_source_id,
        reference_source_chunk_id, reference_citation_label, ai_explanation, reviewer_explanation, reviewer_notes,
        contractor_facing_recommendation, recommended_revision_text, reviewer_decision, resolved, not_applicable,
        origin, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        finding.id,
        finding.reviewId,
        finding.title,
        finding.findingType,
        finding.authority,
        finding.planSourceId,
        finding.planSourceChunkId,
        finding.referenceSourceId,
        finding.referenceSourceChunkId,
        finding.referenceCitationLabel,
        finding.aiExplanation,
        finding.reviewerExplanation,
        finding.reviewerNotes,
        finding.contractorFacingRecommendation,
        finding.recommendedRevisionText,
        finding.reviewerDecision,
        finding.resolved,
        finding.notApplicable,
        finding.origin,
        finding.sortOrder
      ]
    );
  }

  private buildRecommendationSummary(plan: SafetyPlan, findings: PlanFinding[], references: PlanReviewReference[]): string {
    const required = findings.filter((finding) => ["deficiency", "conflict"].includes(finding.findingType));
    const recommended = findings.filter((finding) => finding.findingType === "revision_recommended");
    return [
      `Plan reviewed: ${plan.title}`,
      `Review basis: ${references.length} selected source${references.length === 1 ? "" : "s"}.`,
      "",
      "Required revisions:",
      ...(required.length ? required.map((finding) => `- ${finding.contractorFacingRecommendation ?? finding.title}`) : ["- None drafted."]),
      "",
      "Recommended revisions:",
      ...(recommended.length ? recommended.map((finding) => `- ${finding.contractorFacingRecommendation ?? finding.title}`) : ["- None drafted."]),
      "",
      "Reviewer comments:",
      "- Pending human review."
    ].join("\n");
  }

  private async addPlanAudit(
    userId: string,
    planId: string,
    reviewId: string | null,
    eventType: string,
    message: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO plan_review_audit_events (plan_id, review_id, event_type, message, actor_user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [planId, reviewId, eventType, message, userId]
    );
  }

  private async getRequirementStatusForUser(userId: string, statusId: string): Promise<ContractorRequirementStatus | null> {
    const result = await this.pool.query(
      `SELECT crs.*, rr.id AS rr_id, rr.project_id, rr.title, rr.description, rr.category, rr.source_id,
              rr.source_chunk_id, rr.citation_label, rr.required, rr.blocking, rr.due_date,
              rr.created_at AS rr_created_at, rr.updated_at AS rr_updated_at
       FROM contractor_requirement_statuses crs
       JOIN readiness_requirements rr ON rr.id = crs.requirement_id
       JOIN project_contractor_engagements e ON e.id = crs.engagement_id
       JOIN projects p ON p.id = e.project_id
       WHERE p.owner_user_id = $1 AND crs.id = $2`,
      [userId, statusId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return mapRequirementStatus(row, mapReadinessRequirement({
      id: row.rr_id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      category: row.category,
      source_id: row.source_id,
      source_chunk_id: row.source_chunk_id,
      citation_label: row.citation_label,
      required: row.required,
      blocking: row.blocking,
      due_date: row.due_date,
      created_at: row.rr_created_at,
      updated_at: row.rr_updated_at
    }));
  }

  private async getReadinessEvidenceForUser(userId: string, evidenceId: string): Promise<ReadinessEvidence | null> {
    const result = await this.pool.query(
      `SELECT re.*
       FROM readiness_evidence re
       JOIN contractor_requirement_statuses crs ON crs.id = re.requirement_status_id
       JOIN project_contractor_engagements e ON e.id = crs.engagement_id
       JOIN projects p ON p.id = e.project_id
       WHERE p.owner_user_id = $1 AND re.id = $2`,
      [userId, evidenceId]
    );
    return result.rows[0] ? mapReadinessEvidence(result.rows[0]) : null;
  }

  private summarizeReadiness(
    engagement: ProjectContractorEngagement,
    statuses: ContractorRequirementStatus[]
  ): ContractorReadinessSummary {
    const required = statuses.filter((status) => status.requirement?.required !== false && status.requirement?.blocking !== false);
    const accepted = required.filter((status) => status.status === "accepted").length;
    const notApplicable = required.filter((status) => status.status === "not_applicable").length;
    const missingStatuses: ReadinessStatus[] = ["required", "requested"];
    const missing = required.filter((status) => missingStatuses.includes(status.status)).length;
    const needsReview = required.filter((status) => ["received", "needs_review"].includes(status.status)).length;
    const rejectedOrExpired = required.filter((status) => ["rejected", "expired", "replacement_requested"].includes(status.status)).length;
    const timingWarnings = required
      .filter((status) => status.plannedMobilizationDate && !["accepted", "not_applicable"].includes(status.status))
      .map((status) => `${status.requirement?.title ?? "Requirement"} unresolved before ${status.plannedMobilizationDate}`);
    const totalRequired = required.length;
    const overallStatus =
      totalRequired === 0
        ? "not_started"
        : rejectedOrExpired > 0
          ? "attention_required"
          : accepted + notApplicable === totalRequired
            ? "ready"
            : "in_progress";
    return {
      engagementId: engagement.id,
      contractorId: engagement.contractorId,
      overallStatus,
      totalRequired,
      accepted,
      notApplicable,
      missing,
      needsReview,
      rejectedOrExpired,
      outstandingItems: required.filter((status) => !["accepted", "not_applicable"].includes(status.status)).map((status) => status.requirement?.title ?? "Requirement"),
      timingWarnings
    };
  }

  private async addAudit(
    userId: string,
    engagementId: string,
    requirementStatusId: string | null,
    evidenceId: string | null,
    eventType: string,
    message: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO readiness_audit_events
       (engagement_id, requirement_status_id, evidence_id, event_type, message, actor_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [engagementId, requirementStatusId, evidenceId, eventType, message, userId]
    );
  }
}
