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
  SourceChunk,
  SourceDetail,
  SourceRecord,
  SourceSearchInput,
  SourceUpdateInput
} from "../../shared/contracts";
import {
  DuplicateEngagementError,
  DuplicateEvidenceAssociationError,
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
`;

function clean(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

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
