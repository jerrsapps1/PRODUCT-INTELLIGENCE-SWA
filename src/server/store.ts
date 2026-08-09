import type {
  Contractor,
  ContractorCreateInput,
  EngagementCreateInput,
  Project,
  ProjectContractorEngagement,
  ProjectCreateInput,
  ProjectSourceActivationInput,
  ProjectSourceInput,
  ProjectSourceLink,
  CompetentPersonCreateInput,
  CompetentPersonEvidence,
  ContractorReadinessDetail,
  ContractorReadinessSummary,
  ContractorRequirementApplyInput,
  ContractorRequirementUpdateInput,
  ContractorRequirementStatus,
  SourceChunk,
  SourceDetail,
  SourceRecord,
  SourceSearchInput,
  SourceUpdateInput,
  ReadinessAuditEvent,
  ReadinessEvidence,
  ReadinessEvidenceCreateInput,
  ReadinessEvidenceReviewInput,
  ReadinessRequirement,
  ReadinessRequirementCreateInput,
  ReadinessRequirementUpdateInput,
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
  PlanReviewRunInput,
  ResubmissionComparison,
  ResubmissionComparisonCreateInput,
  FieldObservation,
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
  ReportCreateInput,
  ReportExport,
  ReportFinalizeInput,
  ReportGenerateInput,
  ReportRevisionUpdateInput,
  ReportSearchInput,
  ReportUpdateInput,
  SafetyReport,
  SafetyReportDetail,
  SafetyReportRevision,
  AssistantActionDescriptor,
  AssistantActionInvokeInput,
  AssistantActionResult,
  AssistantConversation,
  AssistantConversationCreateInput,
  AssistantConversationDetail,
  AssistantConversationUpdateInput,
  AssistantDashboard,
  AssistantMessageSendInput,
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
  SkillActivationInput,
  SkillSaveInput,
  UserSummary
} from "../shared/contracts";

export interface StoredUser extends UserSummary {
  passwordHash: string;
}

export interface AppStore {
  migrate(): Promise<void>;
  ensureBootstrapUser(user: { email: string; displayName: string; passwordHash: string }): Promise<void>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserBySessionTokenHash(tokenHash: string): Promise<StoredUser | null>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  listProjects(userId: string): Promise<Project[]>;
  createProject(userId: string, input: ProjectCreateInput): Promise<Project>;
  getProject(userId: string, projectId: string): Promise<Project | null>;
  listContractors(userId: string): Promise<Contractor[]>;
  createContractor(userId: string, input: ContractorCreateInput): Promise<Contractor>;
  getContractor(userId: string, contractorId: string): Promise<Contractor | null>;
  listProjectEngagements(userId: string, projectId: string): Promise<ProjectContractorEngagement[]>;
  createProjectEngagement(
    userId: string,
    projectId: string,
    input: EngagementCreateInput
  ): Promise<ProjectContractorEngagement>;
  getProjectEngagement(
    userId: string,
    projectId: string,
    engagementId: string
  ): Promise<ProjectContractorEngagement | null>;
  listSources(userId: string, filters: SourceSearchInput): Promise<SourceRecord[]>;
  createSource(
    userId: string,
    input: Omit<SourceRecord, "ownerUserId" | "createdAt" | "updatedAt" | "uploadedAt">
  ): Promise<SourceRecord>;
  updateSourceProcessing(
    userId: string,
    sourceId: string,
    input: Pick<SourceRecord, "processingStatus" | "extractionStatus" | "extractionVersion" | "failureReason" | "metadata">
  ): Promise<SourceRecord>;
  updateSource(userId: string, sourceId: string, input: SourceUpdateInput): Promise<SourceRecord | null>;
  getSource(userId: string, sourceId: string): Promise<SourceDetail | null>;
  addSourceChunks(userId: string, sourceId: string, chunks: SourceChunk[]): Promise<void>;
  associateSourceToProject(userId: string, projectId: string, input: ProjectSourceInput): Promise<ProjectSourceLink>;
  listProjectSources(userId: string, projectId: string): Promise<ProjectSourceLink[]>;
  updateProjectSourceActivation(
    userId: string,
    projectId: string,
    sourceId: string,
    input: ProjectSourceActivationInput
  ): Promise<ProjectSourceLink | null>;
  removeSourceFromProject(userId: string, projectId: string, sourceId: string): Promise<void>;
  searchSourceChunks(userId: string, filters: SourceSearchInput): Promise<SourceChunk[]>;
  listReadinessRequirements(userId: string, projectId: string): Promise<ReadinessRequirement[]>;
  createReadinessRequirement(userId: string, projectId: string, input: ReadinessRequirementCreateInput): Promise<ReadinessRequirement>;
  updateReadinessRequirement(userId: string, projectId: string, requirementId: string, input: ReadinessRequirementUpdateInput): Promise<ReadinessRequirement | null>;
  applyRequirementToEngagement(userId: string, engagementId: string, input: ContractorRequirementApplyInput): Promise<ContractorRequirementStatus>;
  listContractorRequirementStatuses(userId: string, engagementId: string): Promise<ContractorRequirementStatus[]>;
  updateContractorRequirementStatus(userId: string, statusId: string, input: ContractorRequirementUpdateInput): Promise<ContractorRequirementStatus | null>;
  attachReadinessEvidence(userId: string, input: ReadinessEvidenceCreateInput): Promise<ReadinessEvidence>;
  reviewReadinessEvidence(userId: string, evidenceId: string, input: ReadinessEvidenceReviewInput): Promise<ReadinessEvidence | null>;
  createSafetyMetric(userId: string, input: SafetyMetricCreateInput): Promise<SafetyMetric>;
  createCompetentPersonEvidence(userId: string, input: CompetentPersonCreateInput): Promise<CompetentPersonEvidence>;
  getContractorReadiness(userId: string, engagementId: string, filters?: { status?: string; category?: string }): Promise<ContractorReadinessDetail | null>;
  listProjectReadinessSummaries(userId: string, projectId: string): Promise<ContractorReadinessSummary[]>;
  listSafetyPlans(userId: string, engagementId: string): Promise<SafetyPlan[]>;
  createSafetyPlan(userId: string, input: SafetyPlanCreateInput): Promise<SafetyPlanDetail>;
  createSafetyPlanRevision(userId: string, planId: string, input: SafetyPlanRevisionCreateInput): Promise<SafetyPlanDetail | null>;
  getSafetyPlanDetail(userId: string, planId: string): Promise<SafetyPlanDetail | null>;
  runPlanReview(userId: string, planId: string, input: PlanReviewRunInput): Promise<SafetyPlanDetail>;
  createPlanFinding(userId: string, input: PlanFindingCreateInput): Promise<PlanFinding>;
  updatePlanFinding(userId: string, findingId: string, input: PlanFindingUpdateInput): Promise<PlanFinding | null>;
  deletePlanFinding(userId: string, findingId: string): Promise<void>;
  updatePlanRecommendation(userId: string, reviewId: string, input: PlanRecommendationUpdateInput): Promise<PlanReview | null>;
  updatePlanApproval(userId: string, planId: string, input: PlanApprovalInput): Promise<SafetyPlanDetail | null>;
  createResubmissionComparison(userId: string, planId: string, input: ResubmissionComparisonCreateInput): Promise<ResubmissionComparison[]>;
  listObservations(userId: string, filters: ObservationSearchInput): Promise<FieldObservation[]>;
  createObservation(userId: string, input: ObservationCreateInput): Promise<ObservationDetail>;
  getObservation(userId: string, observationId: string): Promise<ObservationDetail | null>;
  updateObservation(userId: string, observationId: string, input: ObservationUpdateInput): Promise<ObservationDetail | null>;
  attachObservationPhoto(userId: string, observationId: string, input: ObservationPhotoAttachInput): Promise<ObservationPhoto>;
  updateObservationPhoto(userId: string, photoId: string, input: ObservationPhotoUpdateInput): Promise<ObservationPhoto | null>;
  removeObservationPhoto(userId: string, photoId: string): Promise<void>;
  runObservationEnrichment(userId: string, observationId: string): Promise<ObservationDetail | null>;
  linkObservationReference(userId: string, observationId: string, input: ObservationReferenceLinkInput): Promise<ObservationReferenceLink>;
  unlinkObservationReference(userId: string, linkId: string): Promise<void>;
  linkObservationPlanFinding(userId: string, observationId: string, input: ObservationPlanFindingLinkInput): Promise<ObservationPlanFindingLink>;
  unlinkObservationPlanFinding(userId: string, linkId: string): Promise<void>;
  listIncidents(userId: string, filters: IncidentSearchInput): Promise<IncidentRecord[]>;
  createIncident(userId: string, input: IncidentCreateInput): Promise<IncidentDetail>;
  getIncident(userId: string, incidentId: string): Promise<IncidentDetail | null>;
  updateIncident(userId: string, incidentId: string, input: IncidentUpdateInput): Promise<IncidentDetail | null>;
  attachIncidentSource(userId: string, incidentId: string, input: IncidentAttachmentInput): Promise<IncidentAttachment>;
  removeIncidentAttachment(userId: string, attachmentId: string): Promise<void>;
  createContractorCorrectiveAction(userId: string, incidentId: string, input: ContractorCorrectiveActionInput): Promise<ContractorCorrectiveAction>;
  updateContractorCorrectiveAction(userId: string, actionId: string, input: ContractorCorrectiveActionUpdateInput): Promise<ContractorCorrectiveAction | null>;
  upsertIncidentProjectReview(userId: string, incidentId: string, input: IncidentProjectReviewInput): Promise<IncidentProjectReview>;
  createIncidentRecommendation(userId: string, incidentId: string, input: IncidentRecommendationInput): Promise<IncidentRecommendation>;
  updateIncidentRecommendation(userId: string, recommendationId: string, input: IncidentRecommendationUpdateInput): Promise<IncidentRecommendation | null>;
  createProjectSafetyDecision(userId: string, incidentId: string, input: ProjectSafetyDecisionInput): Promise<ProjectSafetyDecision>;
  createIncidentFollowUp(userId: string, incidentId: string, input: IncidentFollowUpInput): Promise<IncidentFollowUp>;
  linkIncidentRecord(userId: string, incidentId: string, input: IncidentLinkInput): Promise<IncidentLink>;
  unlinkIncidentRecord(userId: string, linkId: string): Promise<void>;
  runIncidentAiReview(userId: string, incidentId: string): Promise<IncidentDetail | null>;
  closeIncident(userId: string, incidentId: string, input: IncidentCloseInput): Promise<IncidentDetail | null>;
  reopenIncident(userId: string, incidentId: string, input: IncidentReopenInput): Promise<IncidentDetail | null>;
  listReports(userId: string, filters: ReportSearchInput): Promise<SafetyReport[]>;
  createReport(userId: string, input: ReportCreateInput): Promise<SafetyReportDetail>;
  getReport(userId: string, reportId: string): Promise<SafetyReportDetail | null>;
  updateReport(userId: string, reportId: string, input: ReportUpdateInput): Promise<SafetyReportDetail | null>;
  generateReportDraft(userId: string, reportId: string, input: ReportGenerateInput): Promise<SafetyReportDetail | null>;
  updateReportRevision(userId: string, revisionId: string, input: ReportRevisionUpdateInput): Promise<SafetyReportRevision | null>;
  finalizeReport(userId: string, reportId: string, input: ReportFinalizeInput): Promise<SafetyReportDetail | null>;
  createReportRevision(userId: string, reportId: string): Promise<SafetyReportDetail | null>;
  exportReport(userId: string, reportId: string): Promise<ReportExport | null>;
  getAssistantDashboard(userId: string, projectId: string): Promise<AssistantDashboard>;
  listAssistantActions(): AssistantActionDescriptor[];
  listAssistantConversations(userId: string, projectId: string): Promise<AssistantConversation[]>;
  createAssistantConversation(userId: string, input: AssistantConversationCreateInput): Promise<AssistantConversationDetail>;
  getAssistantConversation(userId: string, conversationId: string): Promise<AssistantConversationDetail | null>;
  updateAssistantConversation(userId: string, conversationId: string, input: AssistantConversationUpdateInput): Promise<AssistantConversationDetail | null>;
  sendAssistantMessage(userId: string, conversationId: string, input: AssistantMessageSendInput): Promise<AssistantConversationDetail | null>;
  listMemoryEntries(userId: string, filters: { projectId?: string; scope?: string; activeOnly?: boolean }): Promise<MemoryEntry[]>;
  createMemoryEntry(userId: string, input: MemoryEntryCreateInput): Promise<MemoryEntry>;
  updateMemoryEntry(userId: string, memoryId: string, input: MemoryEntryUpdateInput): Promise<MemoryEntry | null>;
  listInstructionDocuments(userId: string, filters: { projectId?: string; scope?: string }): Promise<InstructionDocument[]>;
  saveInstructionDocument(userId: string, input: InstructionDocumentSaveInput): Promise<InstructionDocument>;
  listSkills(userId: string, filters: { projectId?: string; scope?: string; activeOnly?: boolean }): Promise<AssistantSkill[]>;
  saveSkill(userId: string, input: SkillSaveInput): Promise<AssistantSkill>;
  setActiveSkill(userId: string, conversationId: string, input: SkillActivationInput): Promise<AssistantConversationDetail | null>;
  invokeAssistantAction(userId: string, input: AssistantActionInvokeInput): Promise<AssistantActionResult>;
  listProposedActions(userId: string, filters: { projectId?: string; conversationId?: string }): Promise<ProposedAction[]>;
  editProposedAction(userId: string, proposalId: string, input: ProposedActionEditInput): Promise<ProposedAction | null>;
  confirmProposedAction(userId: string, proposalId: string, input: ProposedActionConfirmInput): Promise<ProposedAction | null>;
  rejectProposedAction(userId: string, proposalId: string, input: ProposedActionRejectInput): Promise<ProposedAction | null>;
}

export class DuplicateEngagementError extends Error {
  constructor() {
    super("Contractor is already engaged on this project");
  }
}

export class DuplicateProjectSourceError extends Error {
  constructor() {
    super("Source is already associated with this project");
  }
}

export class DuplicateRequirementApplicationError extends Error {
  constructor() {
    super("Requirement is already applied to this contractor engagement");
  }
}

export class DuplicateEvidenceAssociationError extends Error {
  constructor() {
    super("Source evidence is already attached to this requirement");
  }
}

export class DuplicatePlanRevisionSourceError extends Error {
  constructor() {
    super("This source is already attached as a revision for the safety plan");
  }
}

export class DuplicateObservationPhotoError extends Error {
  constructor() {
    super("Photo source is already attached to this observation");
  }
}

export class DuplicateObservationReferenceError extends Error {
  constructor() {
    super("Reference source is already linked to this observation");
  }
}

export class DuplicateObservationPlanFindingLinkError extends Error {
  constructor() {
    super("Plan finding is already linked to this observation");
  }
}

export class DuplicateIncidentAttachmentError extends Error {
  constructor() {
    super("Source is already attached to this incident with that role");
  }
}

export class DuplicateIncidentLinkError extends Error {
  constructor() {
    super("Incident link already exists");
  }
}
