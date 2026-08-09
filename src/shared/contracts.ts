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
export const safetyPlanStatuses = ["pending", "approved"] as const;
export const safetyPlanTypes = [
  "site_specific_safety_plan",
  "fall_protection_plan",
  "excavation_plan",
  "demolition_plan",
  "confined_space_plan",
  "respiratory_protection_plan",
  "lift_plan",
  "other"
] as const;
export const planFindingTypes = ["compliant", "revision_recommended", "deficiency", "conflict", "reviewer_decision"] as const;
export const planFindingAuthorities = ["regulatory_requirement", "project_requirement", "recommendation", "reviewer_decision"] as const;
export const resubmissionResolutionStatuses = ["addressed", "partially_addressed", "unresolved", "reviewer_decision"] as const;
export const observationClassifications = ["positive", "neutral", "concern", "corrected_in_field", "follow_up_required"] as const;
export const observationFollowUpStatuses = ["none", "needed", "verified_closed"] as const;
export const observationSuggestionStatuses = ["saved", "processing", "ready", "failed"] as const;
export const incidentCategories = [
  "injury_illness",
  "first_aid",
  "recordable_reported_by_contractor",
  "near_miss",
  "property_damage",
  "vehicle",
  "environmental",
  "equipment_damage",
  "other"
] as const;
export const contractorInvestigationStatuses = ["not_started", "in_progress", "complete", "unknown"] as const;
export const incidentOversightStatuses = ["received", "under_project_review", "awaiting_contractor_information", "follow_up_required", "verification_pending", "closed"] as const;
export const affectedWorkDispositions = ["no_restriction", "additional_monitoring", "affected_activity_paused", "documentation_required", "plan_revision_required", "management_review", "cleared_to_resume"] as const;
export const incidentAttachmentRoles = ["contractor_report", "photo", "witness_statement", "supporting_file", "investigation_attachment", "corrective_action_documentation", "revised_contractor_documentation"] as const;
export const contractorCorrectiveActionStatuses = ["provided", "in_progress", "completed", "rejected_by_reviewer", "needs_clarification"] as const;
export const incidentRecommendationTypes = ["accept_contractor_actions", "request_clarification", "request_additional_corrective_action", "request_workforce_communication", "require_plan_revision", "require_supporting_documentation", "perform_field_verification", "pause_affected_activity", "escalate_to_management", "no_additional_project_action"] as const;
export const projectDecisionStatuses = ["draft", "active", "superseded", "closed"] as const;
export const incidentFollowUpStatuses = ["needed", "verified", "not_applicable"] as const;
export const incidentAiStatuses = ["not_run", "processing", "ready", "failed"] as const;
export const reportTypes = ["daily", "weekly", "monthly", "custom"] as const;
export const reportFormats = ["narrative", "structured"] as const;
export const reportStatuses = ["draft", "finalized"] as const;
export const reportGenerationStatuses = ["not_generated", "generating", "ready", "failed"] as const;

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

export const safetyPlanCreateSchema = z.object({
  engagementId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  planType: z.enum(safetyPlanTypes),
  customPlanType: z.string().trim().max(120).optional().or(z.literal("")),
  sourceId: z.string().uuid(),
  revisionIdentifier: z.string().trim().min(1).max(80).default("Rev 0"),
  submittedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  reviewerNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  priorRevisionId: z.string().uuid().optional().or(z.literal(""))
});

export const safetyPlanRevisionCreateSchema = z.object({
  sourceId: z.string().uuid(),
  revisionIdentifier: z.string().trim().min(1).max(80),
  submittedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  priorRevisionId: z.string().uuid().optional().or(z.literal(""))
});

export const planReviewReferenceSchema = z.object({
  sourceId: z.string().uuid(),
  sourceChunkId: z.string().uuid().optional().or(z.literal("")),
  authorityClassification: z.enum(authorityClassifications),
  citationLabel: z.string().trim().max(220).optional().or(z.literal(""))
});

export const planReviewRunSchema = z.object({
  selectedReferences: z.array(planReviewReferenceSchema).min(1, "Select at least one review source")
});

export const planFindingCreateSchema = z.object({
  reviewId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  findingType: z.enum(planFindingTypes),
  authority: z.enum(planFindingAuthorities),
  planSourceId: z.string().uuid().optional().or(z.literal("")),
  planSourceChunkId: z.string().uuid().optional().or(z.literal("")),
  referenceSourceId: z.string().uuid().optional().or(z.literal("")),
  referenceSourceChunkId: z.string().uuid().optional().or(z.literal("")),
  referenceCitationLabel: z.string().trim().max(220).optional().or(z.literal("")),
  aiExplanation: z.string().trim().max(4000).optional().or(z.literal("")),
  reviewerExplanation: z.string().trim().max(4000).optional().or(z.literal("")),
  reviewerNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  contractorFacingRecommendation: z.string().trim().max(4000).optional().or(z.literal("")),
  recommendedRevisionText: z.string().trim().max(4000).optional().or(z.literal("")),
  reviewerDecision: z.string().trim().max(2000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).default(0)
});

export const planFindingUpdateSchema = planFindingCreateSchema.omit({ reviewId: true }).partial().extend({
  resolved: z.boolean().optional(),
  notApplicable: z.boolean().optional()
});

export const planRecommendationUpdateSchema = z.object({
  contractorFacingSummary: z.string().trim().max(12000),
  internalReviewerNotes: z.string().trim().max(12000).optional().or(z.literal(""))
});

export const planApprovalSchema = z.object({
  status: z.enum(safetyPlanStatuses),
  reviewerNotes: z.string().trim().max(4000).optional().or(z.literal(""))
});

export const resubmissionComparisonCreateSchema = z.object({
  priorRevisionId: z.string().uuid(),
  newRevisionId: z.string().uuid(),
  findingResolutions: z.array(z.object({
    findingId: z.string().uuid(),
    resolutionStatus: z.enum(resubmissionResolutionStatuses),
    reviewerNotes: z.string().trim().max(2000).optional().or(z.literal(""))
  })).default([])
});

export const observationSearchSchema = z.object({
  projectId: z.string().uuid(),
  engagementId: z.string().uuid().optional(),
  classification: z.enum(observationClassifications).optional(),
  category: z.string().trim().max(120).optional(),
  followUpStatus: z.enum(observationFollowUpStatuses).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const observationCreateSchema = z.object({
  projectId: z.string().uuid(),
  engagementId: z.string().uuid().optional().or(z.literal("")),
  originalText: z.string().trim().min(1, "Observation text is required").max(8000),
  observedAt: z.string().datetime().optional().or(z.literal("")),
  location: z.string().trim().max(240).optional().or(z.literal("")),
  activity: z.string().trim().max(180).optional().or(z.literal("")),
  reviewerNote: z.string().trim().max(4000).optional().or(z.literal("")),
  followUpNeeded: z.coerce.boolean().default(false),
  classification: z.enum(observationClassifications).optional(),
  category: z.string().trim().max(120).optional().or(z.literal(""))
});

export const observationUpdateSchema = z.object({
  derivedClassification: z.enum(observationClassifications).optional(),
  category: z.string().trim().max(120).optional().or(z.literal("")),
  activity: z.string().trim().max(180).optional().or(z.literal("")),
  location: z.string().trim().max(240).optional().or(z.literal("")),
  derivedSummary: z.string().trim().max(4000).optional().or(z.literal("")),
  reviewerNote: z.string().trim().max(4000).optional().or(z.literal("")),
  followUpStatus: z.enum(observationFollowUpStatuses).optional(),
  followUpNote: z.string().trim().max(4000).optional().or(z.literal("")),
  followUpDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  aiSuggestionsRejected: z.boolean().optional()
});

export const observationPhotoAttachSchema = z.object({
  sourceId: z.string().uuid(),
  caption: z.string().trim().max(500).optional().or(z.literal(""))
});

export const observationPhotoUpdateSchema = z.object({
  caption: z.string().trim().max(500).optional().or(z.literal(""))
});

export const observationPlanFindingLinkSchema = z.object({
  findingId: z.string().uuid(),
  suggested: z.boolean().default(false),
  accepted: z.boolean().default(true),
  note: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const observationReferenceLinkSchema = z.object({
  sourceId: z.string().uuid(),
  sourceChunkId: z.string().uuid().optional().or(z.literal("")),
  citationLabel: z.string().trim().max(220).optional().or(z.literal("")),
  suggested: z.boolean().default(false),
  accepted: z.boolean().default(true)
});

export const incidentSearchSchema = z.object({
  projectId: z.string().uuid(),
  engagementId: z.string().uuid().optional(),
  category: z.enum(incidentCategories).optional(),
  oversightStatus: z.enum(incidentOversightStatuses).optional(),
  followUpRequired: z.coerce.boolean().optional(),
  openOnly: z.coerce.boolean().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const incidentCreateSchema = z.object({
  projectId: z.string().uuid(),
  engagementId: z.string().uuid().optional().or(z.literal("")),
  incidentDateTime: z.string().datetime(),
  reportedAt: z.string().datetime().optional().or(z.literal("")),
  location: z.string().trim().max(240).optional().or(z.literal("")),
  activity: z.string().trim().max(180).optional().or(z.literal("")),
  factualDescription: z.string().trim().min(1).max(8000),
  incidentCategory: z.enum(incidentCategories).default("other"),
  contractorReportedClassification: z.string().trim().max(180).optional().or(z.literal("")),
  contractorInvestigationStatus: z.enum(contractorInvestigationStatuses).default("unknown"),
  affectedWorkScope: z.string().trim().max(1000).optional().or(z.literal(""))
});

export const incidentUpdateSchema = z.object({
  incidentDateTime: z.string().datetime().optional(),
  reportedAt: z.string().datetime().optional().or(z.literal("")),
  location: z.string().trim().max(240).optional().or(z.literal("")),
  activity: z.string().trim().max(180).optional().or(z.literal("")),
  factualDescription: z.string().trim().max(8000).optional(),
  incidentCategory: z.enum(incidentCategories).optional(),
  contractorReportedClassification: z.string().trim().max(180).optional().or(z.literal("")),
  contractorInvestigationStatus: z.enum(contractorInvestigationStatuses).optional(),
  affectedWorkDisposition: z.enum(affectedWorkDispositions).optional(),
  affectedWorkScope: z.string().trim().max(1000).optional().or(z.literal("")),
  oversightStatus: z.enum(incidentOversightStatuses).optional()
});

export const incidentAttachmentSchema = z.object({
  sourceId: z.string().uuid(),
  role: z.enum(incidentAttachmentRoles),
  receivedAt: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const contractorCorrectiveActionSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  sourceId: z.string().uuid().optional().or(z.literal("")),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  contractorStatus: z.enum(contractorCorrectiveActionStatuses).default("provided"),
  evidenceReceived: z.boolean().default(false)
});

export const contractorCorrectiveActionUpdateSchema = contractorCorrectiveActionSchema.partial();

export const incidentProjectReviewSchema = z.object({
  reviewerAnalysis: z.string().trim().max(8000).optional().or(z.literal("")),
  remainingExposure: z.string().trim().max(4000).optional().or(z.literal("")),
  planProcedureConcerns: z.string().trim().max(4000).optional().or(z.literal("")),
  correctiveActionAdequacy: z.string().trim().max(4000).optional().or(z.literal("")),
  additionalInformationNeeded: z.string().trim().max(4000).optional().or(z.literal("")),
  managementReviewNeeded: z.boolean().default(false)
});

export const incidentRecommendationSchema = z.object({
  recommendationType: z.enum(incidentRecommendationTypes),
  recommendationText: z.string().trim().min(1).max(4000),
  status: z.enum(["open", "accepted", "rejected", "completed"]).default("open")
});

export const incidentRecommendationUpdateSchema = incidentRecommendationSchema.partial();

export const projectSafetyDecisionSchema = z.object({
  decisionText: z.string().trim().min(1).max(4000),
  appliesToScope: z.string().trim().max(1000).optional().or(z.literal("")),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  status: z.enum(projectDecisionStatuses).default("active"),
  rationale: z.string().trim().max(4000).optional().or(z.literal("")),
  supportingSourceId: z.string().uuid().optional().or(z.literal(""))
});

export const incidentFollowUpSchema = z.object({
  status: z.enum(incidentFollowUpStatuses),
  verificationNote: z.string().trim().max(4000).optional().or(z.literal("")),
  verifiedAt: z.string().datetime().optional().or(z.literal("")),
  linkedSourceId: z.string().uuid().optional().or(z.literal("")),
  linkedObservationId: z.string().uuid().optional().or(z.literal(""))
});

export const incidentLinkSchema = z.object({
  planFindingId: z.string().uuid().optional().or(z.literal("")),
  observationId: z.string().uuid().optional().or(z.literal("")),
  suggested: z.boolean().default(false),
  accepted: z.boolean().default(true),
  note: z.string().trim().max(1000).optional().or(z.literal(""))
}).refine((value) => Boolean(value.planFindingId) !== Boolean(value.observationId), {
  message: "Link exactly one plan finding or observation"
});

export const incidentCloseSchema = z.object({
  closureNote: z.string().trim().min(1).max(4000),
  projectOutcome: z.string().trim().max(4000).optional().or(z.literal("")),
  unresolvedContractorItems: z.string().trim().max(4000).optional().or(z.literal(""))
});

export const incidentReopenSchema = z.object({
  reason: z.string().trim().min(1).max(4000)
});

export const reportScopeSchema = z.object({
  includeContractors: z.boolean().default(true),
  includeReadiness: z.boolean().default(true),
  includePlanReview: z.boolean().default(true),
  includeObservations: z.boolean().default(true),
  includeIncidents: z.boolean().default(true),
  includeOpenFollowUp: z.boolean().default(true),
  includeProjectDecisions: z.boolean().default(true),
  includeUpcomingFocus: z.boolean().default(true)
});

export const reportManualInputsSchema = z.object({
  projectActivity: z.string().trim().max(4000).optional().or(z.literal("")),
  meetingNote: z.string().trim().max(4000).optional().or(z.literal("")),
  plannedWork: z.string().trim().max(4000).optional().or(z.literal("")),
  weather: z.string().trim().max(1000).optional().or(z.literal("")),
  visitorAuditNote: z.string().trim().max(4000).optional().or(z.literal("")),
  milestone: z.string().trim().max(4000).optional().or(z.literal("")),
  safetyEmphasis: z.string().trim().max(4000).optional().or(z.literal("")),
  otherContext: z.string().trim().max(4000).optional().or(z.literal(""))
});

export const reportCreateSchema = z.object({
  projectId: z.string().uuid(),
  reportType: z.enum(reportTypes),
  format: z.enum(reportFormats),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().max(220).optional().or(z.literal("")),
  scope: reportScopeSchema.default({}),
  manualInputs: reportManualInputsSchema.default({})
}).refine((value) => value.periodStart <= value.periodEnd, {
  message: "Report period start must be on or before period end"
});

export const reportSearchSchema = z.object({
  projectId: z.string().uuid(),
  reportType: z.enum(reportTypes).optional(),
  status: z.enum(reportStatuses).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const reportUpdateSchema = z.object({
  title: z.string().trim().max(220).optional().or(z.literal("")),
  scope: reportScopeSchema.optional(),
  manualInputs: reportManualInputsSchema.optional()
});

export const reportRevisionUpdateSchema = z.object({
  title: z.string().trim().max(220).optional().or(z.literal("")),
  contentMarkdown: z.string().max(60000).optional(),
  contentJson: z.record(z.unknown()).optional()
});

export const reportGenerateSchema = z.object({
  preserveExisting: z.boolean().default(true)
});

export const reportFinalizeSchema = z.object({
  reviewerNote: z.string().trim().max(4000).optional().or(z.literal(""))
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
export type SafetyPlanStatus = (typeof safetyPlanStatuses)[number];
export type SafetyPlanType = (typeof safetyPlanTypes)[number];
export type PlanFindingType = (typeof planFindingTypes)[number];
export type PlanFindingAuthority = (typeof planFindingAuthorities)[number];
export type ResubmissionResolutionStatus = (typeof resubmissionResolutionStatuses)[number];
export type ObservationClassification = (typeof observationClassifications)[number];
export type ObservationFollowUpStatus = (typeof observationFollowUpStatuses)[number];
export type ObservationSuggestionStatus = (typeof observationSuggestionStatuses)[number];
export type IncidentCategory = (typeof incidentCategories)[number];
export type ContractorInvestigationStatus = (typeof contractorInvestigationStatuses)[number];
export type IncidentOversightStatus = (typeof incidentOversightStatuses)[number];
export type AffectedWorkDisposition = (typeof affectedWorkDispositions)[number];
export type IncidentAttachmentRole = (typeof incidentAttachmentRoles)[number];
export type ContractorCorrectiveActionStatus = (typeof contractorCorrectiveActionStatuses)[number];
export type IncidentRecommendationType = (typeof incidentRecommendationTypes)[number];
export type ProjectDecisionStatus = (typeof projectDecisionStatuses)[number];
export type IncidentFollowUpStatus = (typeof incidentFollowUpStatuses)[number];
export type IncidentAiStatus = (typeof incidentAiStatuses)[number];
export type ReportType = (typeof reportTypes)[number];
export type ReportFormat = (typeof reportFormats)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type ReportGenerationStatus = (typeof reportGenerationStatuses)[number];
export type ReadinessRequirementCreateInput = z.infer<typeof readinessRequirementCreateSchema>;
export type ReadinessRequirementUpdateInput = z.infer<typeof readinessRequirementUpdateSchema>;
export type ContractorRequirementApplyInput = z.infer<typeof contractorRequirementApplySchema>;
export type ContractorRequirementUpdateInput = z.infer<typeof contractorRequirementUpdateSchema>;
export type ReadinessEvidenceCreateInput = z.infer<typeof readinessEvidenceCreateSchema>;
export type ReadinessEvidenceReviewInput = z.infer<typeof readinessEvidenceReviewSchema>;
export type SafetyMetricCreateInput = z.infer<typeof safetyMetricCreateSchema>;
export type CompetentPersonCreateInput = z.infer<typeof competentPersonCreateSchema>;
export type SafetyPlanCreateInput = z.infer<typeof safetyPlanCreateSchema>;
export type SafetyPlanRevisionCreateInput = z.infer<typeof safetyPlanRevisionCreateSchema>;
export type PlanReviewReferenceInput = z.infer<typeof planReviewReferenceSchema>;
export type PlanReviewRunInput = z.infer<typeof planReviewRunSchema>;
export type PlanFindingCreateInput = z.infer<typeof planFindingCreateSchema>;
export type PlanFindingUpdateInput = z.infer<typeof planFindingUpdateSchema>;
export type PlanRecommendationUpdateInput = z.infer<typeof planRecommendationUpdateSchema>;
export type PlanApprovalInput = z.infer<typeof planApprovalSchema>;
export type ResubmissionComparisonCreateInput = z.infer<typeof resubmissionComparisonCreateSchema>;
export type ObservationSearchInput = z.infer<typeof observationSearchSchema>;
export type ObservationCreateInput = z.infer<typeof observationCreateSchema>;
export type ObservationUpdateInput = z.infer<typeof observationUpdateSchema>;
export type ObservationPhotoAttachInput = z.infer<typeof observationPhotoAttachSchema>;
export type ObservationPhotoUpdateInput = z.infer<typeof observationPhotoUpdateSchema>;
export type ObservationPlanFindingLinkInput = z.infer<typeof observationPlanFindingLinkSchema>;
export type ObservationReferenceLinkInput = z.infer<typeof observationReferenceLinkSchema>;
export type IncidentSearchInput = z.infer<typeof incidentSearchSchema>;
export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
export type IncidentAttachmentInput = z.infer<typeof incidentAttachmentSchema>;
export type ContractorCorrectiveActionInput = z.infer<typeof contractorCorrectiveActionSchema>;
export type ContractorCorrectiveActionUpdateInput = z.infer<typeof contractorCorrectiveActionUpdateSchema>;
export type IncidentProjectReviewInput = z.infer<typeof incidentProjectReviewSchema>;
export type IncidentRecommendationInput = z.infer<typeof incidentRecommendationSchema>;
export type IncidentRecommendationUpdateInput = z.infer<typeof incidentRecommendationUpdateSchema>;
export type ProjectSafetyDecisionInput = z.infer<typeof projectSafetyDecisionSchema>;
export type IncidentFollowUpInput = z.infer<typeof incidentFollowUpSchema>;
export type IncidentLinkInput = z.infer<typeof incidentLinkSchema>;
export type IncidentCloseInput = z.infer<typeof incidentCloseSchema>;
export type IncidentReopenInput = z.infer<typeof incidentReopenSchema>;
export type ReportScopeInput = z.infer<typeof reportScopeSchema>;
export type ReportManualInputs = z.infer<typeof reportManualInputsSchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportSearchInput = z.infer<typeof reportSearchSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
export type ReportRevisionUpdateInput = z.infer<typeof reportRevisionUpdateSchema>;
export type ReportGenerateInput = z.infer<typeof reportGenerateSchema>;
export type ReportFinalizeInput = z.infer<typeof reportFinalizeSchema>;

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

export interface SafetyPlan {
  id: string;
  projectId: string;
  engagementId: string;
  contractorId: string;
  title: string;
  planType: SafetyPlanType;
  customPlanType: string | null;
  currentRevisionId: string | null;
  reviewStatus: SafetyPlanStatus;
  approvedAt: string | null;
  approvedByUserId: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyPlanRevision {
  id: string;
  planId: string;
  sourceId: string;
  revisionIdentifier: string;
  submittedDate: string | null;
  priorRevisionId: string | null;
  createdAt: string;
  source?: SourceRecord;
}

export interface PlanReviewReference {
  id: string;
  reviewId: string;
  sourceId: string;
  sourceChunkId: string | null;
  authorityClassification: AuthorityClassification;
  citationLabel: string | null;
  createdAt: string;
  source?: SourceRecord;
}

export interface PlanReview {
  id: string;
  planId: string;
  revisionId: string;
  status: SafetyPlanStatus;
  assistantProvider: string | null;
  assistantModel: string | null;
  processingStatus: "draft" | "running" | "completed" | "failed" | "partial";
  errorState: string | null;
  promptConfigVersion: string | null;
  contractorFacingSummary: string;
  internalReviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanFinding {
  id: string;
  reviewId: string;
  title: string;
  findingType: PlanFindingType;
  authority: PlanFindingAuthority;
  planSourceId: string | null;
  planSourceChunkId: string | null;
  referenceSourceId: string | null;
  referenceSourceChunkId: string | null;
  referenceCitationLabel: string | null;
  aiExplanation: string | null;
  reviewerExplanation: string | null;
  reviewerNotes: string | null;
  contractorFacingRecommendation: string | null;
  recommendedRevisionText: string | null;
  reviewerDecision: string | null;
  resolved: boolean;
  notApplicable: boolean;
  origin: "assistant" | "reviewer";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResubmissionComparison {
  id: string;
  planId: string;
  priorRevisionId: string;
  newRevisionId: string;
  findingId: string;
  resolutionStatus: ResubmissionResolutionStatus;
  reviewerNotes: string | null;
  createdAt: string;
}

export interface PlanReviewAuditEvent {
  id: string;
  planId: string;
  reviewId: string | null;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

export interface SafetyPlanDetail {
  plan: SafetyPlan;
  revisions: SafetyPlanRevision[];
  review: PlanReview | null;
  references: PlanReviewReference[];
  findings: PlanFinding[];
  comparisons: ResubmissionComparison[];
  auditEvents: PlanReviewAuditEvent[];
}

export interface FieldObservation {
  id: string;
  projectId: string;
  engagementId: string | null;
  contractorId: string | null;
  creatorUserId: string;
  originalText: string;
  observedAt: string;
  location: string | null;
  activity: string | null;
  derivedClassification: ObservationClassification | null;
  category: string | null;
  derivedSummary: string | null;
  reviewerNote: string | null;
  followUpStatus: ObservationFollowUpStatus;
  followUpNote: string | null;
  followUpDueDate: string | null;
  followUpVerifiedAt: string | null;
  followUpVerifiedByUserId: string | null;
  aiSuggestionStatus: ObservationSuggestionStatus;
  suggestedClassification: ObservationClassification | null;
  suggestedCategory: string | null;
  suggestedActivity: string | null;
  suggestedSummary: string | null;
  suggestedFollowUpStatus: ObservationFollowUpStatus | null;
  aiErrorState: string | null;
  aiSuggestionsRejected: boolean;
  recurrenceCount: number;
  recurrenceSummary: string | null;
  createdAt: string;
  updatedAt: string;
  engagement?: ProjectContractorEngagement;
}

export interface ObservationPhoto {
  id: string;
  observationId: string;
  sourceId: string;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
  source?: SourceRecord;
}

export interface ObservationReferenceLink {
  id: string;
  observationId: string;
  sourceId: string;
  sourceChunkId: string | null;
  citationLabel: string | null;
  suggested: boolean;
  accepted: boolean;
  createdAt: string;
  source?: SourceRecord;
}

export interface ObservationPlanFindingLink {
  id: string;
  observationId: string;
  findingId: string;
  suggested: boolean;
  accepted: boolean;
  note: string | null;
  createdAt: string;
  finding?: PlanFinding;
}

export interface ObservationAuditEvent {
  id: string;
  observationId: string;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

export interface ObservationDetail extends FieldObservation {
  photos: ObservationPhoto[];
  referenceLinks: ObservationReferenceLink[];
  planFindingLinks: ObservationPlanFindingLink[];
  auditEvents: ObservationAuditEvent[];
}

export interface IncidentRecord {
  id: string;
  projectId: string;
  engagementId: string | null;
  contractorId: string | null;
  creatorUserId: string;
  incidentDateTime: string;
  reportedAt: string;
  location: string | null;
  activity: string | null;
  factualDescription: string;
  incidentCategory: IncidentCategory;
  contractorReportedClassification: string | null;
  contractorInvestigationStatus: ContractorInvestigationStatus;
  oversightStatus: IncidentOversightStatus;
  affectedWorkDisposition: AffectedWorkDisposition;
  affectedWorkScope: string | null;
  aiReviewStatus: IncidentAiStatus;
  aiSummary: string | null;
  aiSuggestedConcerns: string | null;
  aiSuggestedQuestions: string | null;
  aiErrorState: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  closureNote: string | null;
  projectOutcome: string | null;
  unresolvedContractorItems: string | null;
  reopenedAt: string | null;
  reopenedByUserId: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
  engagement?: ProjectContractorEngagement;
}

export interface IncidentAttachment {
  id: string;
  incidentId: string;
  sourceId: string;
  role: IncidentAttachmentRole;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
  source?: SourceRecord;
}

export interface ContractorCorrectiveAction {
  id: string;
  incidentId: string;
  description: string;
  sourceId: string | null;
  targetDate: string | null;
  contractorStatus: ContractorCorrectiveActionStatus;
  evidenceReceived: boolean;
  createdAt: string;
  updatedAt: string;
  source?: SourceRecord;
}

export interface IncidentProjectReview {
  id: string;
  incidentId: string;
  reviewerAnalysis: string | null;
  remainingExposure: string | null;
  planProcedureConcerns: string | null;
  correctiveActionAdequacy: string | null;
  additionalInformationNeeded: string | null;
  managementReviewNeeded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentRecommendation {
  id: string;
  incidentId: string;
  recommendationType: IncidentRecommendationType;
  recommendationText: string;
  status: "open" | "accepted" | "rejected" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSafetyDecision {
  id: string;
  incidentId: string;
  projectId: string;
  decisionText: string;
  appliesToScope: string | null;
  effectiveDate: string | null;
  status: ProjectDecisionStatus;
  decisionMakerUserId: string;
  rationale: string | null;
  supportingSourceId: string | null;
  createdAt: string;
  updatedAt: string;
  source?: SourceRecord;
}

export interface IncidentFollowUp {
  id: string;
  incidentId: string;
  status: IncidentFollowUpStatus;
  verificationNote: string | null;
  verifiedAt: string | null;
  verifierUserId: string;
  linkedSourceId: string | null;
  linkedObservationId: string | null;
  createdAt: string;
  source?: SourceRecord;
  observation?: FieldObservation;
}

export interface IncidentLink {
  id: string;
  incidentId: string;
  planFindingId: string | null;
  observationId: string | null;
  suggested: boolean;
  accepted: boolean;
  note: string | null;
  createdAt: string;
  finding?: PlanFinding;
  observation?: FieldObservation;
}

export interface IncidentAuditEvent {
  id: string;
  incidentId: string;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

export interface IncidentDetail extends IncidentRecord {
  attachments: IncidentAttachment[];
  contractorCorrectiveActions: ContractorCorrectiveAction[];
  projectReview: IncidentProjectReview | null;
  recommendations: IncidentRecommendation[];
  projectDecisions: ProjectSafetyDecision[];
  followUps: IncidentFollowUp[];
  links: IncidentLink[];
  auditEvents: IncidentAuditEvent[];
}

export interface ReportEvidenceManifest {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  newDuringPeriod: {
    observationIds: string[];
    incidentIds: string[];
    planReviewIds: string[];
    readinessStatusIds: string[];
    projectDecisionIds: string[];
  };
  carriedOpen: {
    observationIds: string[];
    incidentIds: string[];
    planReviewIds: string[];
    readinessStatusIds: string[];
    projectDecisionIds: string[];
  };
  sourceIds: string[];
}

export interface SafetyReport {
  id: string;
  projectId: string;
  reportType: ReportType;
  format: ReportFormat;
  periodStart: string;
  periodEnd: string;
  title: string;
  status: ReportStatus;
  generationStatus: ReportGenerationStatus;
  generationProvider: string | null;
  generationModel: string | null;
  errorState: string | null;
  scope: ReportScopeInput;
  manualInputs: ReportManualInputs;
  currentRevisionId: string | null;
  createdByUserId: string;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyReportRevision {
  id: string;
  reportId: string;
  revisionNumber: number;
  status: ReportStatus;
  title: string;
  contentMarkdown: string;
  contentJson: Record<string, unknown>;
  evidenceManifest: ReportEvidenceManifest;
  createdByUserId: string;
  createdAt: string;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
}

export interface SafetyReportAuditEvent {
  id: string;
  reportId: string;
  revisionId: string | null;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

export interface SafetyReportDetail extends SafetyReport {
  currentRevision: SafetyReportRevision | null;
  revisions: SafetyReportRevision[];
  auditEvents: SafetyReportAuditEvent[];
}

export interface ReportExport {
  filename: string;
  contentType: string;
  content: string;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
