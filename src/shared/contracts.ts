import { z } from "zod";

export const federalClassifications = ["Federal", "Non-Federal"] as const;
export const sourceScopes = ["global", "project", "contractor"] as const;
export const sourceTypes = ["pdf", "docx", "xlsx", "pptx", "txt", "markdown", "csv", "image", "url", "other"] as const;
export const authorityClassifications = [
  "regulatory_requirement",
  "project_requirement",
  "owner_requirement",
  "gc_policy",
  "general_reference",
  "contractor_submission",
  "working_document",
  "generated_artifact"
] as const;
export const processingStatuses = ["uploaded", "processing", "ready", "partial", "failed"] as const;
export const activationStatuses = ["available", "associated", "active"] as const;
export const readinessStatuses = [
  "required",
  "requested",
  "received",
  "needs_review",
  "accepted",
  "rejected",
  "expired",
  "replacement_requested",
  "not_applicable"
] as const;
export const overallReadinessStatuses = ["not_started", "in_progress", "ready", "attention_required"] as const;
export const safetyMetricTypes = ["emr", "trir", "dart", "other"] as const;

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(160),
  projectIdentifier: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().min(1, "Location is required").max(180),
  federalClassification: z.enum(federalClassifications),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
});

export const contractorCreateSchema = z.object({
  legalName: z.string().trim().min(1, "Legal name is required").max(180),
  trade: z.string().trim().max(120).optional().or(z.literal("")),
  primaryContactName: z.string().trim().max(140).optional().or(z.literal("")),
  primaryContactEmail: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal(""))
});

export const engagementCreateSchema = z.object({
  contractorId: z.string().uuid().optional(),
  contractor: contractorCreateSchema.optional(),
  scopeSummary: z.string().trim().max(1000).optional().or(z.literal(""))
}).refine((value) => value.contractorId || value.contractor, {
  message: "Choose an existing contractor or create a new contractor"
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export const sourceMetadataBaseSchema = z.object({
  title: z.string().trim().min(1).max(220),
  scope: z.enum(sourceScopes),
  projectId: z.string().uuid().optional().or(z.literal("")),
  authorityClassification: z.enum(authorityClassifications),
  userConfirmedClassification: z.coerce.boolean().default(false)
});

export const sourceMetadataSchema = sourceMetadataBaseSchema.refine((value) => value.scope !== "project" || Boolean(value.projectId), {
  message: "Project sources require a project"
});

export const sourceUpdateSchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  authorityClassification: z.enum(authorityClassifications).optional(),
  userConfirmedClassification: z.boolean().optional()
});

export const sourceSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  scope: z.enum(sourceScopes).optional(),
  sourceType: z.enum(sourceTypes).optional(),
  authorityClassification: z.enum(authorityClassifications).optional(),
  projectId: z.string().uuid().optional(),
  activeOnly: z.coerce.boolean().optional()
});

export const projectSourceSchema = z.object({
  sourceId: z.string().uuid(),
  activationStatus: z.enum(activationStatuses)
});

export const projectSourceActivationSchema = z.object({
  activationStatus: z.enum(activationStatuses)
});

export const urlSourceCreateSchema = sourceMetadataBaseSchema.extend({
  url: z.string().trim().url()
}).refine((value) => value.scope !== "project" || Boolean(value.projectId), {
  message: "Project sources require a project"
});

export const readinessRequirementCreateSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(120).default("Other"),
  sourceId: z.string().uuid().optional().or(z.literal("")),
  sourceChunkId: z.string().uuid().optional().or(z.literal("")),
  citationLabel: z.string().trim().max(220).optional().or(z.literal("")),
  required: z.coerce.boolean().default(true),
  blocking: z.coerce.boolean().default(true),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
});

export const readinessRequirementUpdateSchema = readinessRequirementCreateSchema.partial();

export const contractorRequirementApplySchema = z.object({
  requirementId: z.string().uuid()
});

export const contractorRequirementUpdateSchema = z.object({
  status: z.enum(readinessStatuses).optional(),
  reviewerNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  plannedMobilizationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
});

export const readinessEvidenceCreateSchema = z.object({
  requirementStatusId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceChunkId: z.string().uuid().optional().or(z.literal("")),
  evidenceRole: z.string().trim().max(120).default("supporting_evidence"),
  extractedMetadata: z.record(z.unknown()).default({}),
  reviewerNotes: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const readinessEvidenceReviewSchema = z.object({
  reviewStatus: z.enum(["needs_review", "accepted", "rejected", "expired", "replacement_requested"]),
  reviewerNotes: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const safetyMetricCreateSchema = z.object({
  engagementId: z.string().uuid(),
  metricType: z.enum(safetyMetricTypes),
  metricName: z.string().trim().max(80).optional().or(z.literal("")),
  periodYear: z.coerce.number().int().min(1900).max(2200),
  value: z.coerce.number().nonnegative(),
  sourceId: z.string().uuid(),
  evidenceId: z.string().uuid().optional().or(z.literal("")),
  reviewStatus: z.enum(readinessStatuses).default("needs_review"),
  reviewerNotes: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const competentPersonCreateSchema = z.object({
  engagementId: z.string().uuid(),
  personName: z.string().trim().min(1).max(160),
  designation: z.string().trim().min(1).max(160),
  authorizationSourceId: z.string().uuid(),
  trainingSourceId: z.string().uuid().optional().or(z.literal("")),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  reviewStatus: z.enum(readinessStatuses).default("needs_review"),
  reviewerNotes: z.string().trim().max(2000).optional().or(z.literal(""))
});

export type FederalClassification = (typeof federalClassifications)[number];
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ContractorCreateInput = z.infer<typeof contractorCreateSchema>;
export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SourceScope = (typeof sourceScopes)[number];
export type SourceType = (typeof sourceTypes)[number];
export type AuthorityClassification = (typeof authorityClassifications)[number];
export type ProcessingStatus = (typeof processingStatuses)[number];
export type ActivationStatus = (typeof activationStatuses)[number];
export type SourceMetadataInput = z.infer<typeof sourceMetadataSchema>;
export type SourceUpdateInput = z.infer<typeof sourceUpdateSchema>;
export type SourceSearchInput = z.infer<typeof sourceSearchSchema>;
export type ProjectSourceInput = z.infer<typeof projectSourceSchema>;
export type ProjectSourceActivationInput = z.infer<typeof projectSourceActivationSchema>;
export type UrlSourceCreateInput = z.infer<typeof urlSourceCreateSchema>;
export type ReadinessStatus = (typeof readinessStatuses)[number];
export type OverallReadinessStatus = (typeof overallReadinessStatuses)[number];
export type SafetyMetricType = (typeof safetyMetricTypes)[number];
export type ReadinessRequirementCreateInput = z.infer<typeof readinessRequirementCreateSchema>;
export type ReadinessRequirementUpdateInput = z.infer<typeof readinessRequirementUpdateSchema>;
export type ContractorRequirementApplyInput = z.infer<typeof contractorRequirementApplySchema>;
export type ContractorRequirementUpdateInput = z.infer<typeof contractorRequirementUpdateSchema>;
export type ReadinessEvidenceCreateInput = z.infer<typeof readinessEvidenceCreateSchema>;
export type ReadinessEvidenceReviewInput = z.infer<typeof readinessEvidenceReviewSchema>;
export type SafetyMetricCreateInput = z.infer<typeof safetyMetricCreateSchema>;
export type CompetentPersonCreateInput = z.infer<typeof competentPersonCreateSchema>;

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface Project {
  id: string;
  ownerUserId: string;
  name: string;
  projectIdentifier: string | null;
  location: string;
  federalClassification: FederalClassification;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contractor {
  id: string;
  ownerUserId: string;
  legalName: string;
  trade: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContractorEngagement {
  id: string;
  projectId: string;
  contractorId: string;
  scopeSummary: string | null;
  createdAt: string;
  updatedAt: string;
  contractor?: Contractor;
}

export interface SourceRecord {
  id: string;
  ownerUserId: string;
  title: string;
  originalFilename: string | null;
  mimeType: string;
  sourceType: SourceType;
  scope: SourceScope;
  projectId: string | null;
  authorityClassification: AuthorityClassification;
  userConfirmedClassification: boolean;
  aiSuggestedClassification: AuthorityClassification | null;
  storageKey: string | null;
  originalUrl: string | null;
  sizeBytes: number;
  processingStatus: ProcessingStatus;
  extractionStatus: ProcessingStatus;
  extractionVersion: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceChunk {
  id: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
  locationLabel: string | null;
  citation: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectSourceLink {
  id: string;
  projectId: string;
  sourceId: string;
  activationStatus: ActivationStatus;
  createdAt: string;
  updatedAt: string;
  source?: SourceRecord;
}

export interface SourceDetail extends SourceRecord {
  chunks: SourceChunk[];
  projectLinks: ProjectSourceLink[];
}

export interface ReadinessRequirement {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string;
  sourceId: string | null;
  sourceChunkId: string | null;
  citationLabel: string | null;
  required: boolean;
  blocking: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorRequirementStatus {
  id: string;
  requirementId: string;
  engagementId: string;
  status: ReadinessStatus;
  reviewerNotes: string | null;
  plannedMobilizationDate: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  requirement?: ReadinessRequirement;
}

export interface ReadinessEvidence {
  id: string;
  requirementStatusId: string;
  sourceId: string;
  sourceChunkId: string | null;
  evidenceRole: string;
  reviewStatus: ReadinessStatus;
  extractedMetadata: Record<string, unknown>;
  reviewerConfirmedMetadata: Record<string, unknown>;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  source?: SourceRecord;
}

export interface SafetyMetric {
  id: string;
  contractorId: string;
  engagementId: string | null;
  metricType: SafetyMetricType;
  metricName: string | null;
  periodYear: number;
  value: number;
  sourceId: string;
  evidenceId: string | null;
  reviewStatus: ReadinessStatus;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompetentPersonEvidence {
  id: string;
  engagementId: string;
  contractorId: string;
  personName: string;
  designation: string;
  authorizationSourceId: string;
  trainingSourceId: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  reviewStatus: ReadinessStatus;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessAuditEvent {
  id: string;
  engagementId: string;
  requirementStatusId: string | null;
  evidenceId: string | null;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

export interface ContractorReadinessSummary {
  engagementId: string;
  contractorId: string;
  overallStatus: OverallReadinessStatus;
  totalRequired: number;
  accepted: number;
  notApplicable: number;
  missing: number;
  needsReview: number;
  rejectedOrExpired: number;
  outstandingItems: string[];
  timingWarnings: string[];
}

export interface ContractorReadinessDetail {
  summary: ContractorReadinessSummary;
  requirements: ContractorRequirementStatus[];
  evidence: ReadinessEvidence[];
  metrics: SafetyMetric[];
  competentPersons: CompetentPersonEvidence[];
  auditEvents: ReadinessAuditEvent[];
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
