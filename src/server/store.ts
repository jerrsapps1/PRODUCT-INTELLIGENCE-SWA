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
