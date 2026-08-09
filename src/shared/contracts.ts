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

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
