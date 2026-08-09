import { randomUUID } from "node:crypto";
import type {
  Contractor,
  CompetentPersonCreateInput,
  CompetentPersonEvidence,
  ContractorReadinessDetail,
  ContractorReadinessSummary,
  ContractorRequirementApplyInput,
  ContractorRequirementStatus,
  ContractorRequirementUpdateInput,
  ContractorCreateInput,
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
  SourceChunk,
  SourceDetail,
  SourceRecord,
  SourceSearchInput,
  SourceUpdateInput
} from "../../shared/contracts";
import {
  DuplicateEngagementError,
  DuplicateEvidenceAssociationError,
  DuplicateProjectSourceError,
  DuplicatePlanRevisionSourceError,
  DuplicateRequirementApplicationError,
  type AppStore,
  type StoredUser
} from "../store";

function now(): string {
  return new Date().toISOString();
}

function clean(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

export class MemoryStore implements AppStore {
  private users = new Map<string, StoredUser>();
  private sessions = new Map<string, { userId: string; expiresAt: Date }>();
  private projects = new Map<string, Project>();
  private contractors = new Map<string, Contractor>();
  private engagements = new Map<string, ProjectContractorEngagement>();
  private sources = new Map<string, SourceRecord>();
  private chunks = new Map<string, SourceChunk[]>();
  private projectSources = new Map<string, ProjectSourceLink>();
  private readinessRequirements = new Map<string, ReadinessRequirement>();
  private requirementStatuses = new Map<string, ContractorRequirementStatus>();
  private readinessEvidence = new Map<string, ReadinessEvidence>();
  private safetyMetrics = new Map<string, SafetyMetric>();
  private competentPersons = new Map<string, CompetentPersonEvidence>();
  private auditEvents: ReadinessAuditEvent[] = [];
  private safetyPlans = new Map<string, SafetyPlan>();
  private planRevisions = new Map<string, SafetyPlanRevision>();
  private planReviews = new Map<string, PlanReview>();
  private planReferences = new Map<string, PlanReviewReference>();
  private planFindings = new Map<string, PlanFinding>();
  private planComparisons = new Map<string, ResubmissionComparison>();
  private planAuditEvents: PlanReviewAuditEvent[] = [];

  async migrate(): Promise<void> {}

  async ensureBootstrapUser(user: { email: string; displayName: string; passwordHash: string }): Promise<void> {
    const existing = await this.findUserByEmail(user.email);
    if (existing) return;
    const id = randomUUID();
    this.users.set(id, { id, email: user.email.toLowerCase(), displayName: user.displayName, passwordHash: user.passwordHash });
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findUserBySessionTokenHash(tokenHash: string): Promise<StoredUser | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= new Date()) return null;
    return this.users.get(session.userId) ?? null;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.sessions.set(tokenHash, { userId, expiresAt });
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async listProjects(userId: string): Promise<Project[]> {
    return [...this.projects.values()].filter((project) => project.ownerUserId === userId);
  }

  async createProject(userId: string, input: ProjectCreateInput): Promise<Project> {
    const timestamp = now();
    const project: Project = {
      id: randomUUID(),
      ownerUserId: userId,
      name: input.name.trim(),
      projectIdentifier: clean(input.projectIdentifier),
      location: input.location.trim(),
      federalClassification: input.federalClassification,
      description: clean(input.description),
      startDate: clean(input.startDate),
      endDate: clean(input.endDate),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.projects.set(project.id, project);
    return project;
  }

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const project = this.projects.get(projectId);
    return project?.ownerUserId === userId ? project : null;
  }

  async listContractors(userId: string): Promise<Contractor[]> {
    return [...this.contractors.values()].filter((contractor) => contractor.ownerUserId === userId);
  }

  async createContractor(userId: string, input: ContractorCreateInput): Promise<Contractor> {
    const existing = [...this.contractors.values()].find(
      (contractor) => contractor.ownerUserId === userId && contractor.legalName.toLowerCase() === input.legalName.toLowerCase()
    );
    if (existing) return existing;
    const timestamp = now();
    const contractor: Contractor = {
      id: randomUUID(),
      ownerUserId: userId,
      legalName: input.legalName.trim(),
      trade: clean(input.trade),
      primaryContactName: clean(input.primaryContactName),
      primaryContactEmail: clean(input.primaryContactEmail),
      phone: clean(input.phone),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.contractors.set(contractor.id, contractor);
    return contractor;
  }

  async getContractor(userId: string, contractorId: string): Promise<Contractor | null> {
    const contractor = this.contractors.get(contractorId);
    return contractor?.ownerUserId === userId ? contractor : null;
  }

  async listProjectEngagements(userId: string, projectId: string): Promise<ProjectContractorEngagement[]> {
    const project = await this.getProject(userId, projectId);
    if (!project) return [];
    return [...this.engagements.values()]
      .filter((engagement) => engagement.projectId === projectId)
      .map((engagement) => ({ ...engagement, contractor: this.contractors.get(engagement.contractorId) }));
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
      contractorId = (await this.createContractor(userId, input.contractor)).id;
    }
    if (!contractorId || !(await this.getContractor(userId, contractorId))) throw new Error("Contractor not found");
    const duplicate = [...this.engagements.values()].find(
      (engagement) => engagement.projectId === projectId && engagement.contractorId === contractorId
    );
    if (duplicate) throw new DuplicateEngagementError();
    const timestamp = now();
    const engagement: ProjectContractorEngagement = {
      id: randomUUID(),
      projectId,
      contractorId,
      scopeSummary: clean(input.scopeSummary),
      createdAt: timestamp,
      updatedAt: timestamp,
      contractor: this.contractors.get(contractorId)
    };
    this.engagements.set(engagement.id, engagement);
    return engagement;
  }

  async getProjectEngagement(
    userId: string,
    projectId: string,
    engagementId: string
  ): Promise<ProjectContractorEngagement | null> {
    const engagement = this.engagements.get(engagementId);
    if (!engagement || engagement.projectId !== projectId || !(await this.getProject(userId, projectId))) return null;
    return { ...engagement, contractor: this.contractors.get(engagement.contractorId) };
  }

  async listSources(userId: string, filters: SourceSearchInput): Promise<SourceRecord[]> {
    const textMatches = filters.q
      ? new Set((await this.searchSourceChunks(userId, filters)).map((chunk) => chunk.sourceId))
      : null;
    return [...this.sources.values()]
      .filter((source) => source.ownerUserId === userId)
      .filter((source) => !filters.scope || source.scope === filters.scope)
      .filter((source) => !filters.sourceType || source.sourceType === filters.sourceType)
      .filter((source) => !filters.authorityClassification || source.authorityClassification === filters.authorityClassification)
      .filter((source) => !filters.projectId || source.projectId === filters.projectId || [...this.projectSources.values()].some((link) => link.projectId === filters.projectId && link.sourceId === source.id))
      .filter((source) => !filters.activeOnly || [...this.projectSources.values()].some((link) => link.sourceId === source.id && link.activationStatus === "active"))
      .filter((source) => !filters.q || source.title.toLowerCase().includes(filters.q.toLowerCase()) || source.originalFilename?.toLowerCase().includes(filters.q.toLowerCase()) || textMatches?.has(source.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSource(
    userId: string,
    input: Omit<SourceRecord, "ownerUserId" | "createdAt" | "updatedAt" | "uploadedAt">
  ): Promise<SourceRecord> {
    const timestamp = now();
    const source: SourceRecord = {
      ...input,
      ownerUserId: userId,
      uploadedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.sources.set(source.id, source);
    if (source.projectId) {
      await this.associateSourceToProject(userId, source.projectId, { sourceId: source.id, activationStatus: "associated" });
    }
    return source;
  }

  async updateSourceProcessing(
    userId: string,
    sourceId: string,
    input: Pick<SourceRecord, "processingStatus" | "extractionStatus" | "extractionVersion" | "failureReason" | "metadata">
  ): Promise<SourceRecord> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) throw new Error("Source not found");
    const updated = { ...source, ...input, updatedAt: now() };
    this.sources.set(sourceId, updated);
    return updated;
  }

  async updateSource(userId: string, sourceId: string, input: SourceUpdateInput): Promise<SourceRecord | null> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) return null;
    const updated = {
      ...source,
      title: input.title ?? source.title,
      authorityClassification: input.authorityClassification ?? source.authorityClassification,
      userConfirmedClassification: input.userConfirmedClassification ?? source.userConfirmedClassification,
      updatedAt: now()
    };
    this.sources.set(sourceId, updated);
    return updated;
  }

  async getSource(userId: string, sourceId: string): Promise<SourceDetail | null> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) return null;
    return {
      ...source,
      chunks: this.chunks.get(sourceId) ?? [],
      projectLinks: [...this.projectSources.values()]
        .filter((link) => link.sourceId === sourceId)
        .map((link) => ({ ...link, source }))
    };
  }

  async addSourceChunks(userId: string, sourceId: string, chunks: SourceChunk[]): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) throw new Error("Source not found");
    this.chunks.set(sourceId, chunks);
  }

  async associateSourceToProject(userId: string, projectId: string, input: ProjectSourceInput): Promise<ProjectSourceLink> {
    const project = await this.getProject(userId, projectId);
    if (!project) throw new Error("Project not found");
    const source = this.sources.get(input.sourceId);
    if (!source || source.ownerUserId !== userId) throw new Error("Source not found");
    const duplicate = [...this.projectSources.values()].find((link) => link.projectId === projectId && link.sourceId === input.sourceId);
    if (duplicate) throw new DuplicateProjectSourceError();
    const timestamp = now();
    const link: ProjectSourceLink = {
      id: randomUUID(),
      projectId,
      sourceId: input.sourceId,
      activationStatus: input.activationStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
      source
    };
    this.projectSources.set(link.id, link);
    return link;
  }

  async listProjectSources(userId: string, projectId: string): Promise<ProjectSourceLink[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    return [...this.projectSources.values()]
      .filter((link) => link.projectId === projectId)
      .map((link) => ({ ...link, source: this.sources.get(link.sourceId) }))
      .filter((link) => Boolean(link.source));
  }

  async updateProjectSourceActivation(
    userId: string,
    projectId: string,
    sourceId: string,
    input: ProjectSourceActivationInput
  ): Promise<ProjectSourceLink | null> {
    if (!(await this.getProject(userId, projectId))) return null;
    const link = [...this.projectSources.values()].find((item) => item.projectId === projectId && item.sourceId === sourceId);
    if (!link) return null;
    const updated = { ...link, activationStatus: input.activationStatus, updatedAt: now(), source: this.sources.get(sourceId) };
    this.projectSources.set(link.id, updated);
    return updated;
  }

  async removeSourceFromProject(userId: string, projectId: string, sourceId: string): Promise<void> {
    if (!(await this.getProject(userId, projectId))) return;
    const link = [...this.projectSources.values()].find((item) => item.projectId === projectId && item.sourceId === sourceId);
    if (link) this.projectSources.delete(link.id);
  }

  async searchSourceChunks(userId: string, filters: SourceSearchInput): Promise<SourceChunk[]> {
    const query = filters.q?.toLowerCase() ?? "";
    const sources = await this.listSources(userId, { ...filters, q: undefined });
    const sourceIds = new Set(sources.map((source) => source.id));
    return [...this.chunks.values()]
      .flat()
      .filter((chunk) => sourceIds.has(chunk.sourceId))
      .filter((chunk) => !query || chunk.text.toLowerCase().includes(query))
      .slice(0, 50);
  }

  async listReadinessRequirements(userId: string, projectId: string): Promise<ReadinessRequirement[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    return [...this.readinessRequirements.values()].filter((requirement) => requirement.projectId === projectId);
  }

  async createReadinessRequirement(userId: string, projectId: string, input: ReadinessRequirementCreateInput): Promise<ReadinessRequirement> {
    if (!(await this.getProject(userId, projectId))) throw new Error("Project not found");
    if (input.sourceId && !(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const timestamp = now();
    const requirement: ReadinessRequirement = {
      id: randomUUID(),
      projectId,
      title: input.title.trim(),
      description: clean(input.description),
      category: input.category?.trim() || "Other",
      sourceId: clean(input.sourceId),
      sourceChunkId: clean(input.sourceChunkId),
      citationLabel: clean(input.citationLabel),
      required: input.required,
      blocking: input.blocking,
      dueDate: clean(input.dueDate),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.readinessRequirements.set(requirement.id, requirement);
    return requirement;
  }

  async updateReadinessRequirement(
    userId: string,
    projectId: string,
    requirementId: string,
    input: ReadinessRequirementUpdateInput
  ): Promise<ReadinessRequirement | null> {
    if (!(await this.getProject(userId, projectId))) return null;
    const current = this.readinessRequirements.get(requirementId);
    if (!current || current.projectId !== projectId) return null;
    const updated: ReadinessRequirement = {
      ...current,
      title: input.title ?? current.title,
      description: input.description === undefined ? current.description : clean(input.description),
      category: input.category ?? current.category,
      sourceId: input.sourceId === undefined ? current.sourceId : clean(input.sourceId),
      sourceChunkId: input.sourceChunkId === undefined ? current.sourceChunkId : clean(input.sourceChunkId),
      citationLabel: input.citationLabel === undefined ? current.citationLabel : clean(input.citationLabel),
      required: input.required ?? current.required,
      blocking: input.blocking ?? current.blocking,
      dueDate: input.dueDate === undefined ? current.dueDate : clean(input.dueDate),
      updatedAt: now()
    };
    this.readinessRequirements.set(requirementId, updated);
    return updated;
  }

  async applyRequirementToEngagement(
    userId: string,
    engagementId: string,
    input: ContractorRequirementApplyInput
  ): Promise<ContractorRequirementStatus> {
    const engagement = await this.getEngagementForUser(userId, engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    const requirement = this.readinessRequirements.get(input.requirementId);
    if (!requirement || requirement.projectId !== engagement.projectId) throw new Error("Readiness requirement not found");
    const duplicate = [...this.requirementStatuses.values()].find(
      (status) => status.engagementId === engagementId && status.requirementId === input.requirementId
    );
    if (duplicate) throw new DuplicateRequirementApplicationError();
    const timestamp = now();
    const status: ContractorRequirementStatus = {
      id: randomUUID(),
      requirementId: input.requirementId,
      engagementId,
      status: requirement.required ? "required" : "not_applicable",
      reviewerNotes: null,
      plannedMobilizationDate: null,
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      requirement
    };
    this.requirementStatuses.set(status.id, status);
    this.addAudit(userId, engagementId, status.id, null, "requirement_applied", `Applied requirement: ${requirement.title}`);
    return status;
  }

  async listContractorRequirementStatuses(userId: string, engagementId: string): Promise<ContractorRequirementStatus[]> {
    if (!(await this.getEngagementForUser(userId, engagementId))) return [];
    return [...this.requirementStatuses.values()]
      .filter((status) => status.engagementId === engagementId)
      .map((status) => ({ ...status, requirement: this.readinessRequirements.get(status.requirementId) }));
  }

  async updateContractorRequirementStatus(
    userId: string,
    statusId: string,
    input: ContractorRequirementUpdateInput
  ): Promise<ContractorRequirementStatus | null> {
    const current = this.requirementStatuses.get(statusId);
    if (!current || !(await this.getEngagementForUser(userId, current.engagementId))) return null;
    const reviewed = input.status && ["accepted", "rejected", "expired", "not_applicable", "replacement_requested"].includes(input.status);
    const updated: ContractorRequirementStatus = {
      ...current,
      status: input.status ?? current.status,
      reviewerNotes: input.reviewerNotes === undefined ? current.reviewerNotes : clean(input.reviewerNotes),
      plannedMobilizationDate: input.plannedMobilizationDate === undefined ? current.plannedMobilizationDate : clean(input.plannedMobilizationDate),
      reviewedAt: reviewed ? now() : current.reviewedAt,
      reviewedByUserId: reviewed ? userId : current.reviewedByUserId,
      updatedAt: now(),
      requirement: this.readinessRequirements.get(current.requirementId)
    };
    this.requirementStatuses.set(statusId, updated);
    this.addAudit(userId, updated.engagementId, statusId, null, "status_changed", `Requirement status changed to ${updated.status}`);
    return updated;
  }

  async attachReadinessEvidence(userId: string, input: ReadinessEvidenceCreateInput): Promise<ReadinessEvidence> {
    const status = this.requirementStatuses.get(input.requirementStatusId);
    if (!status || !(await this.getEngagementForUser(userId, status.engagementId))) throw new Error("Requirement status not found");
    if (!(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const duplicate = [...this.readinessEvidence.values()].find(
      (evidence) => evidence.requirementStatusId === input.requirementStatusId && evidence.sourceId === input.sourceId
    );
    if (duplicate) throw new DuplicateEvidenceAssociationError();
    const timestamp = now();
    const evidence: ReadinessEvidence = {
      id: randomUUID(),
      requirementStatusId: input.requirementStatusId,
      sourceId: input.sourceId,
      sourceChunkId: clean(input.sourceChunkId),
      evidenceRole: input.evidenceRole,
      reviewStatus: "needs_review",
      extractedMetadata: input.extractedMetadata,
      reviewerConfirmedMetadata: {},
      reviewerNotes: clean(input.reviewerNotes),
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: this.sources.get(input.sourceId)
    };
    this.readinessEvidence.set(evidence.id, evidence);
    await this.updateContractorRequirementStatus(userId, status.id, { status: "received" });
    this.addAudit(userId, status.engagementId, status.id, evidence.id, "evidence_received", "Evidence attached; review still required");
    return evidence;
  }

  async reviewReadinessEvidence(userId: string, evidenceId: string, input: ReadinessEvidenceReviewInput): Promise<ReadinessEvidence | null> {
    const current = this.readinessEvidence.get(evidenceId);
    if (!current) return null;
    const status = this.requirementStatuses.get(current.requirementStatusId);
    if (!status || !(await this.getEngagementForUser(userId, status.engagementId))) return null;
    const updated: ReadinessEvidence = {
      ...current,
      reviewStatus: input.reviewStatus,
      reviewerNotes: input.reviewerNotes === undefined ? current.reviewerNotes : clean(input.reviewerNotes),
      reviewedAt: now(),
      reviewedByUserId: userId,
      updatedAt: now(),
      source: this.sources.get(current.sourceId)
    };
    this.readinessEvidence.set(evidenceId, updated);
    await this.updateContractorRequirementStatus(userId, status.id, { status: input.reviewStatus });
    this.addAudit(userId, status.engagementId, status.id, evidenceId, "evidence_reviewed", `Evidence marked ${input.reviewStatus}`);
    return updated;
  }

  async createSafetyMetric(userId: string, input: SafetyMetricCreateInput): Promise<SafetyMetric> {
    const engagement = await this.getEngagementForUser(userId, input.engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    if (!(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const timestamp = now();
    const metric: SafetyMetric = {
      id: randomUUID(),
      contractorId: engagement.contractorId,
      engagementId: engagement.id,
      metricType: input.metricType,
      metricName: clean(input.metricName),
      periodYear: input.periodYear,
      value: input.value,
      sourceId: input.sourceId,
      evidenceId: clean(input.evidenceId),
      reviewStatus: input.reviewStatus,
      reviewerNotes: clean(input.reviewerNotes),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.safetyMetrics.set(metric.id, metric);
    this.addAudit(userId, engagement.id, null, metric.evidenceId, "metric_recorded", `Recorded ${metric.metricType.toUpperCase()} ${metric.periodYear}`);
    return metric;
  }

  async createCompetentPersonEvidence(userId: string, input: CompetentPersonCreateInput): Promise<CompetentPersonEvidence> {
    const engagement = await this.getEngagementForUser(userId, input.engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    if (!(await this.getSource(userId, input.authorizationSourceId))) throw new Error("Source not found");
    const timestamp = now();
    const record: CompetentPersonEvidence = {
      id: randomUUID(),
      engagementId: engagement.id,
      contractorId: engagement.contractorId,
      personName: input.personName,
      designation: input.designation,
      authorizationSourceId: input.authorizationSourceId,
      trainingSourceId: clean(input.trainingSourceId),
      effectiveDate: clean(input.effectiveDate),
      expirationDate: clean(input.expirationDate),
      reviewStatus: input.reviewStatus,
      reviewerNotes: clean(input.reviewerNotes),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.competentPersons.set(record.id, record);
    this.addAudit(userId, engagement.id, null, null, "competent_person_recorded", `${record.personName} - ${record.designation}`);
    return record;
  }

  async getContractorReadiness(
    userId: string,
    engagementId: string,
    filters: { status?: string; category?: string } = {}
  ): Promise<ContractorReadinessDetail | null> {
    const engagement = await this.getEngagementForUser(userId, engagementId);
    if (!engagement) return null;
    let requirements = await this.listContractorRequirementStatuses(userId, engagementId);
    if (filters.status) requirements = requirements.filter((status) => status.status === filters.status);
    if (filters.category) requirements = requirements.filter((status) => status.requirement?.category === filters.category);
    const statusIds = new Set(requirements.map((status) => status.id));
    const evidence = [...this.readinessEvidence.values()]
      .filter((item) => statusIds.has(item.requirementStatusId))
      .map((item) => ({ ...item, source: this.sources.get(item.sourceId) }));
    const metrics = [...this.safetyMetrics.values()].filter((metric) => metric.engagementId === engagementId);
    const competentPersons = [...this.competentPersons.values()].filter((record) => record.engagementId === engagementId);
    const auditEvents = this.auditEvents.filter((event) => event.engagementId === engagementId).slice(-100).reverse();
    return { summary: this.summarizeReadiness(engagement, await this.listContractorRequirementStatuses(userId, engagementId)), requirements, evidence, metrics, competentPersons, auditEvents };
  }

  async listProjectReadinessSummaries(userId: string, projectId: string): Promise<ContractorReadinessSummary[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    const engagements = [...this.engagements.values()].filter((engagement) => engagement.projectId === projectId);
    const summaries: ContractorReadinessSummary[] = [];
    for (const engagement of engagements) {
      summaries.push(this.summarizeReadiness(engagement, await this.listContractorRequirementStatuses(userId, engagement.id)));
    }
    return summaries;
  }

  async listSafetyPlans(userId: string, engagementId: string): Promise<SafetyPlan[]> {
    if (!(await this.getEngagementForUser(userId, engagementId))) return [];
    return [...this.safetyPlans.values()]
      .filter((plan) => plan.engagementId === engagementId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSafetyPlan(userId: string, input: SafetyPlanCreateInput): Promise<SafetyPlanDetail> {
    const engagement = await this.getEngagementForUser(userId, input.engagementId);
    if (!engagement) throw new Error("Contractor engagement not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    const timestamp = now();
    const plan: SafetyPlan = {
      id: randomUUID(),
      projectId: engagement.projectId,
      engagementId: engagement.id,
      contractorId: engagement.contractorId,
      title: input.title.trim(),
      planType: input.planType,
      customPlanType: clean(input.customPlanType),
      currentRevisionId: null,
      reviewStatus: "pending",
      approvedAt: null,
      approvedByUserId: null,
      reviewerNotes: clean(input.reviewerNotes),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.safetyPlans.set(plan.id, plan);
    const revision = this.createRevisionRecord(plan.id, input.sourceId, input.revisionIdentifier ?? "Rev 0", input.submittedDate, input.priorRevisionId);
    this.planRevisions.set(revision.id, { ...revision, source });
    const updated = { ...plan, currentRevisionId: revision.id };
    this.safetyPlans.set(plan.id, updated);
    this.addPlanAudit(userId, plan.id, null, "plan_created", `Created plan ${plan.title} ${revision.revisionIdentifier}`);
    return (await this.getSafetyPlanDetail(userId, plan.id)) as SafetyPlanDetail;
  }

  async createSafetyPlanRevision(userId: string, planId: string, input: SafetyPlanRevisionCreateInput): Promise<SafetyPlanDetail | null> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) return null;
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    if ([...this.planRevisions.values()].some((revision) => revision.planId === planId && revision.sourceId === input.sourceId)) {
      throw new DuplicatePlanRevisionSourceError();
    }
    const revision = this.createRevisionRecord(planId, input.sourceId, input.revisionIdentifier, input.submittedDate, input.priorRevisionId);
    this.planRevisions.set(revision.id, { ...revision, source });
    const updated = {
      ...plan,
      currentRevisionId: revision.id,
      reviewStatus: "pending" as const,
      approvedAt: null,
      approvedByUserId: null,
      updatedAt: now()
    };
    this.safetyPlans.set(planId, updated);
    this.addPlanAudit(userId, planId, null, "revision_received", `Received ${revision.revisionIdentifier}`);
    return this.getSafetyPlanDetail(userId, planId);
  }

  async getSafetyPlanDetail(userId: string, planId: string): Promise<SafetyPlanDetail | null> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) return null;
    const revisions = [...this.planRevisions.values()]
      .filter((revision) => revision.planId === planId)
      .map((revision) => ({ ...revision, source: this.sources.get(revision.sourceId) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const review = [...this.planReviews.values()].find((item) => item.revisionId === plan.currentRevisionId) ?? null;
    const references = review
      ? [...this.planReferences.values()]
          .filter((reference) => reference.reviewId === review.id)
          .map((reference) => ({ ...reference, source: this.sources.get(reference.sourceId) }))
      : [];
    const findings = review ? [...this.planFindings.values()].filter((finding) => finding.reviewId === review.id).sort((a, b) => a.sortOrder - b.sortOrder) : [];
    const revisionIds = new Set(revisions.map((revision) => revision.id));
    const comparisons = [...this.planComparisons.values()].filter(
      (comparison) => comparison.planId === planId && revisionIds.has(comparison.priorRevisionId) && revisionIds.has(comparison.newRevisionId)
    );
    const auditEvents = this.planAuditEvents.filter((event) => event.planId === planId).slice(-100).reverse();
    return { plan, revisions, review, references, findings, comparisons, auditEvents };
  }

  async runPlanReview(userId: string, planId: string, input: PlanReviewRunInput): Promise<SafetyPlanDetail> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan || !plan.currentRevisionId) throw new Error("Safety plan not found");
    const revision = this.planRevisions.get(plan.currentRevisionId);
    if (!revision) throw new Error("Safety plan revision not found");
    const planSource = await this.getSource(userId, revision.sourceId);
    if (!planSource) throw new Error("Source not found");
    if (planSource.extractionStatus === "failed") throw new Error("Plan extraction failed");
    if (input.selectedReferences.length === 0) throw new Error("At least one review source is required");
    const timestamp = now();
    const review: PlanReview = {
      id: randomUUID(),
      planId,
      revisionId: revision.id,
      status: "pending",
      assistantProvider: "local-review-assistant",
      assistantModel: "transparent-selected-source-v1",
      processingStatus: "completed",
      errorState: null,
      promptConfigVersion: "phase4-local-v1",
      contractorFacingSummary: "",
      internalReviewerNotes: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    [...this.planReviews.values()].filter((item) => item.revisionId === revision.id).forEach((item) => this.planReviews.delete(item.id));
    this.planReviews.set(review.id, review);
    for (const referenceInput of input.selectedReferences) {
      const source = await this.getSource(userId, referenceInput.sourceId);
      if (!source) throw new Error("Source not found");
      this.ensureSelectableReviewReference(plan.projectId, source);
      const reference: PlanReviewReference = {
        id: randomUUID(),
        reviewId: review.id,
        sourceId: source.id,
        sourceChunkId: clean(referenceInput.sourceChunkId),
        authorityClassification: referenceInput.authorityClassification,
        citationLabel: clean(referenceInput.citationLabel),
        createdAt: timestamp,
        source
      };
      this.planReferences.set(reference.id, reference);
    }
    const generatedFindings = await this.generateDraftFindings(review, planSource, input.selectedReferences);
    generatedFindings.forEach((finding) => this.planFindings.set(finding.id, finding));
    const updatedReview = {
      ...review,
      contractorFacingSummary: this.buildRecommendationSummary(plan, generatedFindings, input.selectedReferences),
      updatedAt: now()
    };
    this.planReviews.set(review.id, updatedReview);
    this.addPlanAudit(userId, planId, review.id, "review_run_completed", `Generated ${generatedFindings.length} draft findings from selected sources`);
    return (await this.getSafetyPlanDetail(userId, planId)) as SafetyPlanDetail;
  }

  async createPlanFinding(userId: string, input: PlanFindingCreateInput): Promise<PlanFinding> {
    const review = await this.getReviewForUser(userId, input.reviewId);
    if (!review) throw new Error("Plan review not found");
    const timestamp = now();
    const finding = this.materializeFinding(input, review.id, "reviewer", timestamp);
    this.planFindings.set(finding.id, finding);
    this.addPlanAudit(userId, review.planId, review.id, "finding_created", `Reviewer created finding: ${finding.title}`);
    return finding;
  }

  async updatePlanFinding(userId: string, findingId: string, input: PlanFindingUpdateInput): Promise<PlanFinding | null> {
    const current = this.planFindings.get(findingId);
    if (!current || !(await this.getReviewForUser(userId, current.reviewId))) return null;
    const updated: PlanFinding = {
      ...current,
      title: input.title ?? current.title,
      findingType: input.findingType ?? current.findingType,
      authority: input.authority ?? current.authority,
      planSourceId: input.planSourceId === undefined ? current.planSourceId : clean(input.planSourceId),
      planSourceChunkId: input.planSourceChunkId === undefined ? current.planSourceChunkId : clean(input.planSourceChunkId),
      referenceSourceId: input.referenceSourceId === undefined ? current.referenceSourceId : clean(input.referenceSourceId),
      referenceSourceChunkId: input.referenceSourceChunkId === undefined ? current.referenceSourceChunkId : clean(input.referenceSourceChunkId),
      referenceCitationLabel: input.referenceCitationLabel === undefined ? current.referenceCitationLabel : clean(input.referenceCitationLabel),
      reviewerExplanation: input.reviewerExplanation === undefined ? current.reviewerExplanation : clean(input.reviewerExplanation),
      reviewerNotes: input.reviewerNotes === undefined ? current.reviewerNotes : clean(input.reviewerNotes),
      contractorFacingRecommendation: input.contractorFacingRecommendation === undefined ? current.contractorFacingRecommendation : clean(input.contractorFacingRecommendation),
      recommendedRevisionText: input.recommendedRevisionText === undefined ? current.recommendedRevisionText : clean(input.recommendedRevisionText),
      reviewerDecision: input.reviewerDecision === undefined ? current.reviewerDecision : clean(input.reviewerDecision),
      resolved: input.resolved ?? current.resolved,
      notApplicable: input.notApplicable ?? current.notApplicable,
      sortOrder: input.sortOrder ?? current.sortOrder,
      updatedAt: now()
    };
    this.planFindings.set(findingId, updated);
    const review = this.planReviews.get(updated.reviewId);
    if (review) this.addPlanAudit(userId, review.planId, review.id, "finding_edited", `Edited finding: ${updated.title}`);
    return updated;
  }

  async deletePlanFinding(userId: string, findingId: string): Promise<void> {
    const current = this.planFindings.get(findingId);
    if (!current) return;
    const review = await this.getReviewForUser(userId, current.reviewId);
    if (!review) return;
    this.planFindings.delete(findingId);
    this.addPlanAudit(userId, review.planId, review.id, "finding_removed", `Removed finding: ${current.title}`);
  }

  async updatePlanRecommendation(userId: string, reviewId: string, input: PlanRecommendationUpdateInput): Promise<PlanReview | null> {
    const review = await this.getReviewForUser(userId, reviewId);
    if (!review) return null;
    const updated = {
      ...review,
      contractorFacingSummary: input.contractorFacingSummary,
      internalReviewerNotes: clean(input.internalReviewerNotes),
      updatedAt: now()
    };
    this.planReviews.set(reviewId, updated);
    this.addPlanAudit(userId, review.planId, reviewId, "recommendation_edited", "Edited contractor-facing recommendation artifact");
    return updated;
  }

  async updatePlanApproval(userId: string, planId: string, input: PlanApprovalInput): Promise<SafetyPlanDetail | null> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) return null;
    const approved = input.status === "approved";
    const updated: SafetyPlan = {
      ...plan,
      reviewStatus: input.status,
      approvedAt: approved ? now() : null,
      approvedByUserId: approved ? userId : null,
      reviewerNotes: input.reviewerNotes === undefined ? plan.reviewerNotes : clean(input.reviewerNotes),
      updatedAt: now()
    };
    this.safetyPlans.set(planId, updated);
    const review = [...this.planReviews.values()].find((item) => item.revisionId === plan.currentRevisionId);
    if (review) this.planReviews.set(review.id, { ...review, status: input.status, updatedAt: now() });
    this.addPlanAudit(userId, planId, review?.id ?? null, approved ? "plan_approved" : "plan_marked_pending", `Reviewer marked plan ${input.status}`);
    return this.getSafetyPlanDetail(userId, planId);
  }

  async createResubmissionComparison(userId: string, planId: string, input: ResubmissionComparisonCreateInput): Promise<ResubmissionComparison[]> {
    const plan = await this.getPlanForUser(userId, planId);
    if (!plan) throw new Error("Safety plan not found");
    const timestamp = now();
    const comparisons = input.findingResolutions.map((resolution) => ({
      id: randomUUID(),
      planId,
      priorRevisionId: input.priorRevisionId,
      newRevisionId: input.newRevisionId,
      findingId: resolution.findingId,
      resolutionStatus: resolution.resolutionStatus,
      reviewerNotes: clean(resolution.reviewerNotes),
      createdAt: timestamp
    }));
    comparisons.forEach((comparison) => this.planComparisons.set(comparison.id, comparison));
    this.addPlanAudit(userId, planId, null, "resubmission_compared", `Compared ${input.priorRevisionId} to ${input.newRevisionId}`);
    return comparisons;
  }

  private async getEngagementForUser(userId: string, engagementId: string): Promise<ProjectContractorEngagement | null> {
    const engagement = this.engagements.get(engagementId);
    if (!engagement || !(await this.getProject(userId, engagement.projectId))) return null;
    return engagement;
  }

  private async getPlanForUser(userId: string, planId: string): Promise<SafetyPlan | null> {
    const plan = this.safetyPlans.get(planId);
    if (!plan || !(await this.getProject(userId, plan.projectId))) return null;
    return plan;
  }

  private async getReviewForUser(userId: string, reviewId: string): Promise<PlanReview | null> {
    const review = this.planReviews.get(reviewId);
    if (!review || !(await this.getPlanForUser(userId, review.planId))) return null;
    return review;
  }

  private createRevisionRecord(
    planId: string,
    sourceId: string,
    revisionIdentifier: string,
    submittedDate?: string,
    priorRevisionId?: string
  ): SafetyPlanRevision {
    return {
      id: randomUUID(),
      planId,
      sourceId,
      revisionIdentifier: revisionIdentifier.trim(),
      submittedDate: clean(submittedDate),
      priorRevisionId: clean(priorRevisionId),
      createdAt: now()
    };
  }

  private ensureSelectableReviewReference(projectId: string, source: SourceRecord): void {
    const activeProjectSource = [...this.projectSources.values()].some(
      (link) => link.projectId === projectId && link.sourceId === source.id && link.activationStatus === "active"
    );
    if (source.scope === "global" || source.projectId === projectId || activeProjectSource) return;
    throw new Error("Review source is not available to this project");
  }

  private async generateDraftFindings(
    review: PlanReview,
    planSource: SourceDetail,
    references: Array<{ sourceId: string; sourceChunkId?: string; authorityClassification: SourceRecord["authorityClassification"]; citationLabel?: string }>
  ): Promise<PlanFinding[]> {
    const planText = planSource.chunks.map((chunk) => chunk.text).join(" ").toLowerCase();
    const firstPlanChunk = planSource.chunks[0];
    const findings: PlanFinding[] = [];
    let order = 0;
    for (const reference of references) {
      const source = await this.getSource(planSource.ownerUserId, reference.sourceId);
      if (!source) continue;
      const selectedChunk = reference.sourceChunkId
        ? source.chunks.find((chunk) => chunk.id === reference.sourceChunkId)
        : source.chunks[0];
      const referenceText = selectedChunk?.text ?? source.title;
      const keywords = referenceText.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4).slice(0, 8);
      const matched = keywords.some((word) => planText.includes(word));
      const authority = reference.authorityClassification === "regulatory_requirement" ? "regulatory_requirement" : "project_requirement";
      const findingType = matched ? "compliant" : "deficiency";
      findings.push({
        id: randomUUID(),
        reviewId: review.id,
        title: matched ? `Plan addresses ${source.title}` : `Review needed for ${source.title}`,
        findingType,
        authority,
        planSourceId: planSource.id,
        planSourceChunkId: firstPlanChunk?.id ?? null,
        referenceSourceId: source.id,
        referenceSourceChunkId: selectedChunk?.id ?? null,
        referenceCitationLabel: clean(reference.citationLabel) ?? selectedChunk?.locationLabel ?? source.title,
        aiExplanation: matched
          ? "The submitted plan appears to address language found in the selected reference. Reviewer confirmation is still required."
          : "The selected reference contains terms that were not clearly found in the submitted plan extraction. This is a draft deficiency for reviewer evaluation.",
        reviewerExplanation: matched
          ? "Accepted for reviewer confirmation."
          : "Clarify or revise the plan to address the selected review source.",
        reviewerNotes: null,
        contractorFacingRecommendation: matched ? null : `Revise the plan to address ${source.title}.`,
        recommendedRevisionText: matched ? null : "Add project-specific language describing how this requirement will be met before the work begins.",
        reviewerDecision: null,
        resolved: false,
        notApplicable: false,
        origin: "assistant",
        sortOrder: order++,
        createdAt: now(),
        updatedAt: now()
      });
    }
    if (findings.length === 0) {
      findings.push({
        id: randomUUID(),
        reviewId: review.id,
        title: "Reviewer decision required",
        findingType: "reviewer_decision",
        authority: "reviewer_decision",
        planSourceId: planSource.id,
        planSourceChunkId: firstPlanChunk?.id ?? null,
        referenceSourceId: null,
        referenceSourceChunkId: null,
        referenceCitationLabel: null,
        aiExplanation: "No selected reference text was available for a grounded comparison.",
        reviewerExplanation: "Select extracted reference sources or complete a manual review.",
        reviewerNotes: null,
        contractorFacingRecommendation: null,
        recommendedRevisionText: null,
        reviewerDecision: null,
        resolved: false,
        notApplicable: false,
        origin: "assistant",
        sortOrder: 0,
        createdAt: now(),
        updatedAt: now()
      });
    }
    return findings;
  }

  private materializeFinding(input: PlanFindingCreateInput, reviewId: string, origin: "assistant" | "reviewer", timestamp: string): PlanFinding {
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

  private buildRecommendationSummary(
    plan: SafetyPlan,
    findings: PlanFinding[],
    references: Array<{ sourceId: string }>
  ): string {
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

  private addAudit(
    userId: string,
    engagementId: string,
    requirementStatusId: string | null,
    evidenceId: string | null,
    eventType: string,
    message: string
  ) {
    this.auditEvents.push({
      id: randomUUID(),
      engagementId,
      requirementStatusId,
      evidenceId,
      eventType,
      message,
      actorUserId: userId,
      createdAt: now()
    });
  }

  private addPlanAudit(
    userId: string,
    planId: string,
    reviewId: string | null,
    eventType: string,
    message: string
  ) {
    this.planAuditEvents.push({
      id: randomUUID(),
      planId,
      reviewId,
      eventType,
      message,
      actorUserId: userId,
      createdAt: now()
    });
  }
}
