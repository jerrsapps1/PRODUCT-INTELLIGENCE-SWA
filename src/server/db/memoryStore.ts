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

  private async getEngagementForUser(userId: string, engagementId: string): Promise<ProjectContractorEngagement | null> {
    const engagement = this.engagements.get(engagementId);
    if (!engagement || !(await this.getProject(userId, engagement.projectId))) return null;
    return engagement;
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
}
