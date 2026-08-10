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
  SourceSummaryGenerateInput,
  SourceTagSuggestionInput,
  SourceUpdateInput
} from "../../shared/contracts";
import {
  DuplicateEngagementError,
  DuplicateEvidenceAssociationError,
  DuplicateObservationPhotoError,
  DuplicateObservationPlanFindingLinkError,
  DuplicateObservationReferenceError,
  DuplicateIncidentAttachmentError,
  DuplicateIncidentLinkError,
  DuplicateProjectSourceError,
  DuplicatePlanRevisionSourceError,
  DuplicateRequirementApplicationError,
  SourceInUseError,
  type AppStore,
  type StoredUser
} from "../store";
import { suggestTagsForSource } from "../sourceOrganization";
import { runPlanReviewAssistant, type ReviewReferenceContext } from "../planReviewAssistant";
import { buildObservationReferenceQuery, runObservationAssistant } from "../observationAssistant";
import { runIncidentAssistant } from "../incidentAssistant";
import { draftFallbackSafetyReport, draftSafetyReport, type ReportEvidenceContext } from "../reportAssistant";

function now(): string {
  return new Date().toISOString();
}

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
    generatedAt: now(),
    periodStart,
    periodEnd,
    newDuringPeriod: { observationIds: [], incidentIds: [], planReviewIds: [], readinessStatusIds: [], projectDecisionIds: [] },
    carriedOpen: { observationIds: [], incidentIds: [], planReviewIds: [], readinessStatusIds: [], projectDecisionIds: [] },
    sourceIds: []
  };
}

function reportHtml(detail: SafetyReportDetail): string {
  const revision = detail.currentRevision;
  const body = escapeHtml(revision?.contentMarkdown ?? "").split("\n").map((line) => line ? `<p>${line}</p>` : "").join("\n");
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(detail.title)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:32px auto;line-height:1.5;color:#17202a}p{white-space:pre-wrap}h1{font-size:28px}header{border-bottom:1px solid #d0d7de;margin-bottom:24px}</style></head>
<body><header><h1>${escapeHtml(detail.title)}</h1><p>${escapeHtml(detail.reportType)} | ${escapeHtml(detail.periodStart)} to ${escapeHtml(detail.periodEnd)} | ${escapeHtml(detail.status)}</p></header>${body}</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
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
  private observations = new Map<string, FieldObservation>();
  private observationPhotos = new Map<string, ObservationPhoto>();
  private observationReferences = new Map<string, ObservationReferenceLink>();
  private observationPlanFindingLinks = new Map<string, ObservationPlanFindingLink>();
  private observationAuditEvents: ObservationAuditEvent[] = [];
  private incidents = new Map<string, IncidentRecord>();
  private incidentAttachments = new Map<string, IncidentAttachment>();
  private contractorCorrectiveActions = new Map<string, ContractorCorrectiveAction>();
  private incidentProjectReviews = new Map<string, IncidentProjectReview>();
  private incidentRecommendations = new Map<string, IncidentRecommendation>();
  private projectSafetyDecisions = new Map<string, ProjectSafetyDecision>();
  private incidentFollowUps = new Map<string, IncidentFollowUp>();
  private incidentLinks = new Map<string, IncidentLink>();
  private incidentAuditEvents: IncidentAuditEvent[] = [];
  private reports = new Map<string, SafetyReport>();
  private reportRevisions = new Map<string, SafetyReportRevision>();
  private reportAuditEvents: SafetyReportAuditEvent[] = [];
  private assistantConversations = new Map<string, AssistantConversation>();
  private assistantMessages = new Map<string, AssistantMessage>();
  private assistantRuns = new Map<string, AssistantRun>();
  private memoryEntries = new Map<string, MemoryEntry>();
  private instructionDocuments = new Map<string, InstructionDocument>();
  private skills = new Map<string, AssistantSkill>();
  private proposedActions = new Map<string, ProposedAction>();

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
      .filter((source) => !source.archivedAt)
      .filter((source) => !filters.scope || source.scope === filters.scope)
      .filter((source) => !filters.sourceType || source.sourceType === filters.sourceType)
      .filter((source) => !filters.authorityClassification || source.authorityClassification === filters.authorityClassification)
      .filter((source) => !filters.projectId || source.projectId === filters.projectId || [...this.projectSources.values()].some((link) => link.projectId === filters.projectId && link.sourceId === source.id))
      .filter((source) => !filters.activeOnly || [...this.projectSources.values()].some((link) => link.sourceId === source.id && link.activationStatus === "active"))
      .filter((source) => !filters.q || source.title.toLowerCase().includes(filters.q.toLowerCase()) || source.originalFilename?.toLowerCase().includes(filters.q.toLowerCase()) || source.tags.some((tag) => tag.toLowerCase().includes(filters.q!.toLowerCase())) || textMatches?.has(source.id))
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
      tags: input.tags ?? [],
      summary: input.summary ?? null,
      summaryStatus: input.summaryStatus ?? "not_generated",
      summaryGeneratedAt: input.summaryGeneratedAt ?? null,
      summaryProvider: input.summaryProvider ?? null,
      summaryModel: input.summaryModel ?? null,
      archivedAt: input.archivedAt ?? null,
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
      tags: input.tags ?? source.tags,
      summary: input.summary !== undefined ? clean(input.summary) : source.summary,
      summaryStatus: input.summary !== undefined ? (clean(input.summary) ? "ready" : "not_generated") : source.summaryStatus,
      summaryGeneratedAt: input.summary !== undefined && clean(input.summary) ? now() : source.summaryGeneratedAt,
      summaryProvider: input.summary !== undefined && clean(input.summary) ? "manual_editor" : source.summaryProvider,
      summaryModel: input.summary !== undefined && clean(input.summary) ? null : source.summaryModel,
      updatedAt: now()
    };
    this.sources.set(sourceId, updated);
    return updated;
  }

  async suggestSourceTags(userId: string, sourceId: string, input: SourceTagSuggestionInput): Promise<SourceRecord | null> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) return null;
    const suggestions = suggestTagsForSource(source);
    const metadata = { ...source.metadata, tagSuggestions: suggestions, tagSuggestionProvider: "deterministic_metadata", tagSuggestionGeneratedAt: now() };
    const updated = input.persist
      ? { ...source, tags: [...new Set([...source.tags, ...suggestions])], metadata, updatedAt: now() }
      : { ...source, metadata, updatedAt: now() };
    this.sources.set(sourceId, updated);
    return updated;
  }

  async generateSourceSummary(userId: string, sourceId: string, _input: SourceSummaryGenerateInput): Promise<SourceRecord | null> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) return null;
    const updated = {
      ...source,
      summaryStatus: "unavailable" as const,
      metadata: {
        ...source.metadata,
        summaryUnavailableReason: "No source-summary AI provider is configured; deterministic fallback will not fabricate summaries."
      },
      updatedAt: now()
    };
    this.sources.set(sourceId, updated);
    return updated;
  }

  async archiveSource(userId: string, sourceId: string): Promise<SourceRecord | null> {
    const source = this.sources.get(sourceId);
    if (!source || source.ownerUserId !== userId) return null;
    if (this.sourceIsReferenced(sourceId)) throw new SourceInUseError();
    const updated = { ...source, archivedAt: now(), updatedAt: now() };
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

  private sourceIsReferenced(sourceId: string): boolean {
    return [...this.projectSources.values()].some((link) => link.sourceId === sourceId) ||
      [...this.readinessRequirements.values()].some((item) => item.sourceId === sourceId) ||
      [...this.readinessEvidence.values()].some((item) => item.sourceId === sourceId) ||
      [...this.safetyMetrics.values()].some((item) => item.sourceId === sourceId) ||
      [...this.competentPersons.values()].some((item) => item.authorizationSourceId === sourceId || item.trainingSourceId === sourceId) ||
      [...this.planRevisions.values()].some((item) => item.sourceId === sourceId) ||
      [...this.planReferences.values()].some((item) => item.sourceId === sourceId) ||
      [...this.observationPhotos.values()].some((item) => item.sourceId === sourceId) ||
      [...this.observationReferences.values()].some((item) => item.sourceId === sourceId) ||
      [...this.incidentAttachments.values()].some((item) => item.sourceId === sourceId) ||
      [...this.contractorCorrectiveActions.values()].some((item) => item.sourceId === sourceId) ||
      [...this.projectSafetyDecisions.values()].some((item) => item.supportingSourceId === sourceId) ||
      [...this.incidentFollowUps.values()].some((item) => item.linkedSourceId === sourceId) ||
      [...this.reportRevisions.values()].some((item) => item.evidenceManifest.sourceIds.includes(sourceId));
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
    const existingReview = [...this.planReviews.values()].find((item) => item.revisionId === revision.id);
    if (existingReview && this.hasHumanPlanReviewWork(existingReview.id)) {
      this.addPlanAudit(userId, planId, existingReview.id, "review_run_skipped", "Existing reviewer-edited review was preserved; no draft overwrite occurred");
      return (await this.getSafetyPlanDetail(userId, planId)) as SafetyPlanDetail;
    }
    const review: PlanReview = {
      id: randomUUID(),
      planId,
      revisionId: revision.id,
      status: "pending",
      assistantProvider: null,
      assistantModel: null,
      processingStatus: "running",
      errorState: null,
      promptConfigVersion: null,
      contractorFacingSummary: "",
      internalReviewerNotes: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    [...this.planReviews.values()].filter((item) => item.revisionId === revision.id).forEach((item) => this.planReviews.delete(item.id));
    this.planReviews.set(review.id, review);
    const referenceContexts: ReviewReferenceContext[] = [];
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
      referenceContexts.push({ ...referenceInput, source });
    }
    const assistant = await runPlanReviewAssistant({ planSource, references: referenceContexts });
    const generatedFindings = assistant.findings.map((finding, index) => ({
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
      createdAt: now(),
      updatedAt: now()
    }));
    generatedFindings.forEach((finding) => this.planFindings.set(finding.id, finding));
    const updatedReview = {
      ...review,
      assistantProvider: assistant.provider,
      assistantModel: assistant.model,
      processingStatus: assistant.processingStatus,
      errorState: assistant.errorState,
      promptConfigVersion: assistant.promptConfigVersion,
      contractorFacingSummary: assistant.contractorFacingSummary,
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

  async listObservations(userId: string, filters: ObservationSearchInput): Promise<FieldObservation[]> {
    if (!(await this.getProject(userId, filters.projectId))) return [];
    return [...this.observations.values()]
      .filter((observation) => observation.projectId === filters.projectId)
      .filter((observation) => !filters.engagementId || observation.engagementId === filters.engagementId)
      .filter((observation) => !filters.classification || observation.derivedClassification === filters.classification)
      .filter((observation) => !filters.category || observation.category === filters.category)
      .filter((observation) => !filters.followUpStatus || observation.followUpStatus === filters.followUpStatus)
      .filter((observation) => !filters.dateFrom || observation.observedAt.slice(0, 10) >= filters.dateFrom)
      .filter((observation) => !filters.dateTo || observation.observedAt.slice(0, 10) <= filters.dateTo)
      .map((observation) => this.withObservationContext(observation))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  }

  async createObservation(userId: string, input: ObservationCreateInput): Promise<ObservationDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const engagement = input.engagementId ? await this.getEngagementForUser(userId, input.engagementId) : null;
    if (input.engagementId && (!engagement || engagement.projectId !== input.projectId)) {
      throw new Error("Observation engagement must belong to the selected project");
    }
    const timestamp = now();
    const observation: FieldObservation = {
      id: randomUUID(),
      projectId: input.projectId,
      engagementId: engagement?.id ?? null,
      contractorId: engagement?.contractorId ?? null,
      creatorUserId: userId,
      originalText: input.originalText.trim(),
      observedAt: clean(input.observedAt) ?? timestamp,
      location: clean(input.location),
      activity: clean(input.activity),
      derivedClassification: input.classification ?? null,
      category: clean(input.category),
      derivedSummary: null,
      reviewerNote: clean(input.reviewerNote),
      followUpStatus: input.followUpNeeded ? "needed" : "none",
      followUpNote: null,
      followUpDueDate: null,
      followUpVerifiedAt: null,
      followUpVerifiedByUserId: null,
      aiSuggestionStatus: "saved",
      suggestedClassification: null,
      suggestedCategory: null,
      suggestedActivity: null,
      suggestedSummary: null,
      suggestedFollowUpStatus: null,
      aiErrorState: null,
      aiSuggestionsRejected: false,
      recurrenceCount: 0,
      recurrenceSummary: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.observations.set(observation.id, observation);
    this.refreshObservationRecurrence(observation.id);
    this.addObservationAudit(userId, observation.id, "created", `Created observation: ${observation.originalText}`);
    return (await this.getObservation(userId, observation.id)) as ObservationDetail;
  }

  async getObservation(userId: string, observationId: string): Promise<ObservationDetail | null> {
    const observation = this.observations.get(observationId);
    if (!observation || !(await this.getProject(userId, observation.projectId))) return null;
    return this.buildObservationDetail(observation);
  }

  async updateObservation(userId: string, observationId: string, input: ObservationUpdateInput): Promise<ObservationDetail | null> {
    const current = this.observations.get(observationId);
    if (!current || !(await this.getProject(userId, current.projectId))) return null;
    const closing = input.followUpStatus === "verified_closed" && current.followUpStatus !== "verified_closed";
    const updated: FieldObservation = {
      ...current,
      derivedClassification: input.derivedClassification ?? current.derivedClassification,
      category: input.category === undefined ? current.category : clean(input.category),
      activity: input.activity === undefined ? current.activity : clean(input.activity),
      location: input.location === undefined ? current.location : clean(input.location),
      derivedSummary: input.derivedSummary === undefined ? current.derivedSummary : clean(input.derivedSummary),
      reviewerNote: input.reviewerNote === undefined ? current.reviewerNote : clean(input.reviewerNote),
      followUpStatus: input.followUpStatus ?? current.followUpStatus,
      followUpNote: input.followUpNote === undefined ? current.followUpNote : clean(input.followUpNote),
      followUpDueDate: input.followUpDueDate === undefined ? current.followUpDueDate : clean(input.followUpDueDate),
      followUpVerifiedAt: closing ? now() : current.followUpVerifiedAt,
      followUpVerifiedByUserId: closing ? userId : current.followUpVerifiedByUserId,
      aiSuggestionsRejected: input.aiSuggestionsRejected ?? current.aiSuggestionsRejected,
      updatedAt: now()
    };
    this.observations.set(observationId, updated);
    this.refreshObservationRecurrence(observationId);
    this.addObservationAudit(userId, observationId, "updated", "Updated observation classification, category, location, activity, or follow-up fields");
    if (closing) this.addObservationAudit(userId, observationId, "closed_verified", "Verified and closed observation follow-up");
    return this.getObservation(userId, observationId);
  }

  async attachObservationPhoto(userId: string, observationId: string, input: ObservationPhotoAttachInput): Promise<ObservationPhoto> {
    const observation = await this.getObservation(userId, observationId);
    if (!observation) throw new Error("Observation not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    if (source.sourceType !== "image") throw new Error("Observation photos must use image sources");
    if (source.projectId && source.projectId !== observation.projectId) throw new Error("Photo source must belong to the observation project");
    const duplicate = [...this.observationPhotos.values()].find((photo) => photo.observationId === observationId && photo.sourceId === input.sourceId);
    if (duplicate) throw new DuplicateObservationPhotoError();
    const timestamp = now();
    const photo: ObservationPhoto = {
      id: randomUUID(),
      observationId,
      sourceId: source.id,
      caption: clean(input.caption),
      createdAt: timestamp,
      updatedAt: timestamp,
      source
    };
    this.observationPhotos.set(photo.id, photo);
    this.addObservationAudit(userId, observationId, "photo_added", `Added photo source: ${source.title}`);
    return photo;
  }

  async updateObservationPhoto(userId: string, photoId: string, input: ObservationPhotoUpdateInput): Promise<ObservationPhoto | null> {
    const current = this.observationPhotos.get(photoId);
    if (!current || !(await this.getObservation(userId, current.observationId))) return null;
    const updated = { ...current, caption: input.caption === undefined ? current.caption : clean(input.caption), updatedAt: now() };
    this.observationPhotos.set(photoId, updated);
    this.addObservationAudit(userId, current.observationId, "photo_caption_updated", "Updated observation photo caption");
    return { ...updated, source: this.sources.get(updated.sourceId) };
  }

  async removeObservationPhoto(userId: string, photoId: string): Promise<void> {
    const current = this.observationPhotos.get(photoId);
    if (!current || !(await this.getObservation(userId, current.observationId))) return;
    this.observationPhotos.delete(photoId);
    this.addObservationAudit(userId, current.observationId, "photo_removed", "Removed photo association; original source was preserved");
  }

  async runObservationEnrichment(userId: string, observationId: string): Promise<ObservationDetail | null> {
    const current = this.observations.get(observationId);
    if (!current || !(await this.getProject(userId, current.projectId))) return null;
    this.observations.set(observationId, { ...current, aiSuggestionStatus: "processing", aiErrorState: null, updatedAt: now() });
    this.addObservationAudit(userId, observationId, "ai_processing_run", "Started observation suggestion processing");
    try {
      const query = buildObservationReferenceQuery(current);
      const chunks = await this.searchSourceChunks(userId, { q: query, projectId: current.projectId, activeOnly: true });
      const assistant = await runObservationAssistant({
        originalText: current.originalText,
        activity: current.activity,
        category: current.category,
        existingReferences: chunks
      });
      const latest = this.observations.get(observationId) as FieldObservation;
      const updated: FieldObservation = {
        ...latest,
        aiSuggestionStatus: "ready",
        suggestedClassification: assistant.classification,
        suggestedCategory: assistant.category,
        suggestedActivity: assistant.activity,
        suggestedSummary: assistant.summary,
        suggestedFollowUpStatus: assistant.followUpStatus,
        aiErrorState: null,
        derivedClassification: latest.derivedClassification ?? (latest.aiSuggestionsRejected ? null : assistant.classification),
        category: latest.category ?? (latest.aiSuggestionsRejected ? null : assistant.category),
        activity: latest.activity ?? (latest.aiSuggestionsRejected ? null : assistant.activity),
        derivedSummary: latest.derivedSummary ?? (latest.aiSuggestionsRejected ? null : assistant.summary),
        followUpStatus: latest.followUpStatus === "none" && !latest.aiSuggestionsRejected ? assistant.followUpStatus : latest.followUpStatus,
        updatedAt: now()
      };
      this.observations.set(observationId, updated);
      for (const suggestion of assistant.referenceSuggestions) {
        if (![...this.observationReferences.values()].some((link) => link.observationId === observationId && link.sourceId === suggestion.sourceId && link.sourceChunkId === suggestion.sourceChunkId)) {
          const link: ObservationReferenceLink = {
            id: randomUUID(),
            observationId,
            sourceId: suggestion.sourceId,
            sourceChunkId: suggestion.sourceChunkId,
            citationLabel: suggestion.citationLabel,
            suggested: true,
            accepted: false,
            createdAt: now(),
            source: this.sources.get(suggestion.sourceId)
          };
          this.observationReferences.set(link.id, link);
        }
      }
      this.addObservationAudit(userId, observationId, "ai_processing_result", `Suggestions ready from ${assistant.provider}`);
      return this.getObservation(userId, observationId);
    } catch (error) {
      const latest = this.observations.get(observationId);
      if (latest) {
        this.observations.set(observationId, {
          ...latest,
          aiSuggestionStatus: "failed",
          aiErrorState: error instanceof Error ? error.message : "Observation suggestion processing failed",
          updatedAt: now()
        });
      }
      this.addObservationAudit(userId, observationId, "ai_processing_failed", "Observation was saved, but suggestions failed");
      return this.getObservation(userId, observationId);
    }
  }

  async linkObservationReference(userId: string, observationId: string, input: ObservationReferenceLinkInput): Promise<ObservationReferenceLink> {
    const observation = await this.getObservation(userId, observationId);
    if (!observation) throw new Error("Observation not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    this.ensureSelectableReviewReference(observation.projectId, source);
    const duplicate = [...this.observationReferences.values()].find((link) => link.observationId === observationId && link.sourceId === input.sourceId && link.sourceChunkId === clean(input.sourceChunkId));
    if (duplicate) throw new DuplicateObservationReferenceError();
    const link: ObservationReferenceLink = {
      id: randomUUID(),
      observationId,
      sourceId: source.id,
      sourceChunkId: clean(input.sourceChunkId),
      citationLabel: clean(input.citationLabel),
      suggested: input.suggested,
      accepted: input.accepted,
      createdAt: now(),
      source
    };
    this.observationReferences.set(link.id, link);
    this.addObservationAudit(userId, observationId, "reference_link_added", `Linked reference: ${source.title}`);
    return link;
  }

  async unlinkObservationReference(userId: string, linkId: string): Promise<void> {
    const link = this.observationReferences.get(linkId);
    if (!link || !(await this.getObservation(userId, link.observationId))) return;
    this.observationReferences.delete(linkId);
    this.addObservationAudit(userId, link.observationId, "reference_link_removed", "Removed observation reference link");
  }

  async linkObservationPlanFinding(userId: string, observationId: string, input: ObservationPlanFindingLinkInput): Promise<ObservationPlanFindingLink> {
    const observation = await this.getObservation(userId, observationId);
    if (!observation) throw new Error("Observation not found");
    const finding = await this.getPlanFindingForObservation(userId, input.findingId, observation.projectId);
    if (!finding) throw new Error("Plan finding not found");
    const duplicate = [...this.observationPlanFindingLinks.values()].find((link) => link.observationId === observationId && link.findingId === input.findingId);
    if (duplicate) throw new DuplicateObservationPlanFindingLinkError();
    const link: ObservationPlanFindingLink = {
      id: randomUUID(),
      observationId,
      findingId: finding.id,
      suggested: input.suggested,
      accepted: input.accepted,
      note: clean(input.note),
      createdAt: now(),
      finding
    };
    this.observationPlanFindingLinks.set(link.id, link);
    this.addObservationAudit(userId, observationId, "plan_finding_link_added", `Linked plan finding: ${finding.title}`);
    return link;
  }

  async unlinkObservationPlanFinding(userId: string, linkId: string): Promise<void> {
    const link = this.observationPlanFindingLinks.get(linkId);
    if (!link || !(await this.getObservation(userId, link.observationId))) return;
    this.observationPlanFindingLinks.delete(linkId);
    this.addObservationAudit(userId, link.observationId, "plan_finding_link_removed", "Removed plan finding link");
  }

  async listIncidents(userId: string, filters: IncidentSearchInput): Promise<IncidentRecord[]> {
    if (!(await this.getProject(userId, filters.projectId))) return [];
    return [...this.incidents.values()]
      .filter((incident) => incident.projectId === filters.projectId)
      .filter((incident) => !filters.engagementId || incident.engagementId === filters.engagementId)
      .filter((incident) => !filters.category || incident.incidentCategory === filters.category)
      .filter((incident) => !filters.oversightStatus || incident.oversightStatus === filters.oversightStatus)
      .filter((incident) => !filters.openOnly || incident.oversightStatus !== "closed")
      .filter((incident) => filters.followUpRequired === undefined || (incident.oversightStatus === "follow_up_required" || incident.oversightStatus === "verification_pending") === filters.followUpRequired)
      .filter((incident) => !filters.dateFrom || incident.incidentDateTime.slice(0, 10) >= filters.dateFrom)
      .filter((incident) => !filters.dateTo || incident.incidentDateTime.slice(0, 10) <= filters.dateTo)
      .map((incident) => this.withIncidentContext(incident))
      .sort((a, b) => b.incidentDateTime.localeCompare(a.incidentDateTime));
  }

  async createIncident(userId: string, input: IncidentCreateInput): Promise<IncidentDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const engagement = input.engagementId ? await this.getEngagementForUser(userId, input.engagementId) : null;
    if (input.engagementId && (!engagement || engagement.projectId !== input.projectId)) {
      throw new Error("Incident engagement must belong to the selected project");
    }
    const timestamp = now();
    const incident: IncidentRecord = {
      id: randomUUID(),
      projectId: input.projectId,
      engagementId: engagement?.id ?? null,
      contractorId: engagement?.contractorId ?? null,
      creatorUserId: userId,
      incidentDateTime: input.incidentDateTime,
      reportedAt: clean(input.reportedAt) ?? timestamp,
      location: clean(input.location),
      activity: clean(input.activity),
      factualDescription: input.factualDescription.trim(),
      incidentCategory: input.incidentCategory ?? "other",
      contractorReportedClassification: clean(input.contractorReportedClassification),
      contractorInvestigationStatus: input.contractorInvestigationStatus ?? "unknown",
      oversightStatus: "received",
      affectedWorkDisposition: "no_restriction",
      affectedWorkScope: clean(input.affectedWorkScope),
      aiReviewStatus: "not_run",
      aiSummary: null,
      aiSuggestedConcerns: null,
      aiSuggestedQuestions: null,
      aiErrorState: null,
      closedAt: null,
      closedByUserId: null,
      closureNote: null,
      projectOutcome: null,
      unresolvedContractorItems: null,
      reopenedAt: null,
      reopenedByUserId: null,
      reopenReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.incidents.set(incident.id, incident);
    this.addIncidentAudit(userId, incident.id, "incident_created", "Created incident oversight record");
    return (await this.getIncident(userId, incident.id)) as IncidentDetail;
  }

  async getIncident(userId: string, incidentId: string): Promise<IncidentDetail | null> {
    const incident = this.incidents.get(incidentId);
    if (!incident || !(await this.getProject(userId, incident.projectId))) return null;
    return this.buildIncidentDetail(incident);
  }

  async updateIncident(userId: string, incidentId: string, input: IncidentUpdateInput): Promise<IncidentDetail | null> {
    const current = this.incidents.get(incidentId);
    if (!current || !(await this.getProject(userId, current.projectId))) return null;
    const updated: IncidentRecord = {
      ...current,
      incidentDateTime: input.incidentDateTime ?? current.incidentDateTime,
      reportedAt: input.reportedAt === undefined ? current.reportedAt : clean(input.reportedAt) ?? current.reportedAt,
      location: input.location === undefined ? current.location : clean(input.location),
      activity: input.activity === undefined ? current.activity : clean(input.activity),
      factualDescription: input.factualDescription?.trim() || current.factualDescription,
      incidentCategory: input.incidentCategory ?? current.incidentCategory,
      contractorReportedClassification: input.contractorReportedClassification === undefined ? current.contractorReportedClassification : clean(input.contractorReportedClassification),
      contractorInvestigationStatus: input.contractorInvestigationStatus ?? current.contractorInvestigationStatus,
      affectedWorkDisposition: input.affectedWorkDisposition ?? current.affectedWorkDisposition,
      affectedWorkScope: input.affectedWorkScope === undefined ? current.affectedWorkScope : clean(input.affectedWorkScope),
      oversightStatus: input.oversightStatus ?? current.oversightStatus,
      updatedAt: now()
    };
    this.incidents.set(incidentId, updated);
    this.addIncidentAudit(userId, incidentId, "incident_updated", "Updated incident factual or oversight fields");
    return this.getIncident(userId, incidentId);
  }

  async attachIncidentSource(userId: string, incidentId: string, input: IncidentAttachmentInput): Promise<IncidentAttachment> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) throw new Error("Incident not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    if (source.projectId && source.projectId !== incident.projectId) throw new Error("Incident source must belong to the selected project");
    const duplicate = [...this.incidentAttachments.values()].find((item) => item.incidentId === incidentId && item.sourceId === input.sourceId && item.role === input.role);
    if (duplicate) throw new DuplicateIncidentAttachmentError();
    const attachment: IncidentAttachment = {
      id: randomUUID(),
      incidentId,
      sourceId: source.id,
      role: input.role,
      receivedAt: clean(input.receivedAt) ?? now(),
      notes: clean(input.notes),
      createdAt: now(),
      source
    };
    this.incidentAttachments.set(attachment.id, attachment);
    this.addIncidentAudit(userId, incidentId, input.role === "contractor_report" ? "contractor_report_received" : "attachment_added", `Attached incident source: ${source.title}`);
    return attachment;
  }

  async removeIncidentAttachment(userId: string, attachmentId: string): Promise<void> {
    const attachment = this.incidentAttachments.get(attachmentId);
    if (!attachment || !(await this.getIncident(userId, attachment.incidentId))) return;
    this.incidentAttachments.delete(attachmentId);
    this.addIncidentAudit(userId, attachment.incidentId, "attachment_removed", "Removed incident-source association; original source was preserved");
  }

  async createContractorCorrectiveAction(userId: string, incidentId: string, input: ContractorCorrectiveActionInput): Promise<ContractorCorrectiveAction> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    if (input.sourceId && !(await this.getSource(userId, input.sourceId))) throw new Error("Source not found");
    const action: ContractorCorrectiveAction = {
      id: randomUUID(),
      incidentId,
      description: input.description.trim(),
      sourceId: clean(input.sourceId),
      targetDate: clean(input.targetDate),
      contractorStatus: input.contractorStatus ?? "provided",
      evidenceReceived: input.evidenceReceived ?? false,
      createdAt: now(),
      updatedAt: now(),
      source: input.sourceId ? this.sources.get(input.sourceId) : undefined
    };
    this.contractorCorrectiveActions.set(action.id, action);
    this.addIncidentAudit(userId, incidentId, "contractor_corrective_action_recorded", "Recorded contractor-provided corrective action");
    return action;
  }

  async updateContractorCorrectiveAction(userId: string, actionId: string, input: ContractorCorrectiveActionUpdateInput): Promise<ContractorCorrectiveAction | null> {
    const current = this.contractorCorrectiveActions.get(actionId);
    if (!current || !(await this.getIncident(userId, current.incidentId))) return null;
    const updated = {
      ...current,
      description: input.description ?? current.description,
      sourceId: input.sourceId === undefined ? current.sourceId : clean(input.sourceId),
      targetDate: input.targetDate === undefined ? current.targetDate : clean(input.targetDate),
      contractorStatus: input.contractorStatus ?? current.contractorStatus,
      evidenceReceived: input.evidenceReceived ?? current.evidenceReceived,
      updatedAt: now(),
      source: input.sourceId ? this.sources.get(input.sourceId) : current.source
    };
    this.contractorCorrectiveActions.set(actionId, updated);
    this.addIncidentAudit(userId, current.incidentId, "contractor_corrective_action_updated", "Updated contractor-provided corrective action");
    return updated;
  }

  async upsertIncidentProjectReview(userId: string, incidentId: string, input: IncidentProjectReviewInput): Promise<IncidentProjectReview> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    const existing = [...this.incidentProjectReviews.values()].find((review) => review.incidentId === incidentId);
    const review: IncidentProjectReview = {
      id: existing?.id ?? randomUUID(),
      incidentId,
      reviewerAnalysis: clean(input.reviewerAnalysis),
      remainingExposure: clean(input.remainingExposure),
      planProcedureConcerns: clean(input.planProcedureConcerns),
      correctiveActionAdequacy: clean(input.correctiveActionAdequacy),
      additionalInformationNeeded: clean(input.additionalInformationNeeded),
      managementReviewNeeded: input.managementReviewNeeded ?? false,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now()
    };
    this.incidentProjectReviews.set(review.id, review);
    const incident = this.incidents.get(incidentId);
    if (incident && incident.oversightStatus === "received") this.incidents.set(incidentId, { ...incident, oversightStatus: "under_project_review", updatedAt: now() });
    this.addIncidentAudit(userId, incidentId, existing ? "project_review_edited" : "project_review_created", "Saved separate GC/project incident review");
    return review;
  }

  async createIncidentRecommendation(userId: string, incidentId: string, input: IncidentRecommendationInput): Promise<IncidentRecommendation> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    const recommendation: IncidentRecommendation = {
      id: randomUUID(),
      incidentId,
      recommendationType: input.recommendationType,
      recommendationText: input.recommendationText.trim(),
      status: input.status ?? "open",
      createdAt: now(),
      updatedAt: now()
    };
    this.incidentRecommendations.set(recommendation.id, recommendation);
    this.addIncidentAudit(userId, incidentId, "recommendation_added", "Added human-controlled project recommendation");
    return recommendation;
  }

  async updateIncidentRecommendation(userId: string, recommendationId: string, input: IncidentRecommendationUpdateInput): Promise<IncidentRecommendation | null> {
    const current = this.incidentRecommendations.get(recommendationId);
    if (!current || !(await this.getIncident(userId, current.incidentId))) return null;
    const updated = {
      ...current,
      recommendationType: input.recommendationType ?? current.recommendationType,
      recommendationText: input.recommendationText ?? current.recommendationText,
      status: input.status ?? current.status,
      updatedAt: now()
    };
    this.incidentRecommendations.set(recommendationId, updated);
    this.addIncidentAudit(userId, current.incidentId, "recommendation_updated", "Updated project recommendation");
    return updated;
  }

  async createProjectSafetyDecision(userId: string, incidentId: string, input: ProjectSafetyDecisionInput): Promise<ProjectSafetyDecision> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) throw new Error("Incident not found");
    if (input.supportingSourceId && !(await this.getSource(userId, input.supportingSourceId))) throw new Error("Source not found");
    const decision: ProjectSafetyDecision = {
      id: randomUUID(),
      incidentId,
      projectId: incident.projectId,
      decisionText: input.decisionText.trim(),
      appliesToScope: clean(input.appliesToScope),
      effectiveDate: clean(input.effectiveDate),
      status: input.status ?? "active",
      decisionMakerUserId: userId,
      rationale: clean(input.rationale),
      supportingSourceId: clean(input.supportingSourceId),
      createdAt: now(),
      updatedAt: now(),
      source: input.supportingSourceId ? this.sources.get(input.supportingSourceId) : undefined
    };
    this.projectSafetyDecisions.set(decision.id, decision);
    this.addIncidentAudit(userId, incidentId, "project_decision_created", "Created human-confirmed project safety decision");
    return decision;
  }

  async createIncidentFollowUp(userId: string, incidentId: string, input: IncidentFollowUpInput): Promise<IncidentFollowUp> {
    if (!(await this.getIncident(userId, incidentId))) throw new Error("Incident not found");
    if (input.linkedSourceId && !(await this.getSource(userId, input.linkedSourceId))) throw new Error("Source not found");
    if (input.linkedObservationId && !(await this.getObservation(userId, input.linkedObservationId))) throw new Error("Observation not found");
    const followUp: IncidentFollowUp = {
      id: randomUUID(),
      incidentId,
      status: input.status,
      verificationNote: clean(input.verificationNote),
      verifiedAt: clean(input.verifiedAt) ?? now(),
      verifierUserId: userId,
      linkedSourceId: clean(input.linkedSourceId),
      linkedObservationId: clean(input.linkedObservationId),
      createdAt: now(),
      source: input.linkedSourceId ? this.sources.get(input.linkedSourceId) : undefined,
      observation: input.linkedObservationId ? this.observations.get(input.linkedObservationId) : undefined
    };
    this.incidentFollowUps.set(followUp.id, followUp);
    const incident = this.incidents.get(incidentId);
    if (incident && input.status === "verified") this.incidents.set(incidentId, { ...incident, oversightStatus: "verification_pending", updatedAt: now() });
    this.addIncidentAudit(userId, incidentId, "follow_up_recorded", "Recorded project-level follow-up verification");
    return followUp;
  }

  async linkIncidentRecord(userId: string, incidentId: string, input: IncidentLinkInput): Promise<IncidentLink> {
    const incident = await this.getIncident(userId, incidentId);
    if (!incident) throw new Error("Incident not found");
    const planFindingId = clean(input.planFindingId);
    const observationId = clean(input.observationId);
    if (planFindingId && !(await this.getPlanFindingForObservation(userId, planFindingId, incident.projectId))) throw new Error("Plan finding not found");
    if (observationId) {
      const observation = await this.getObservation(userId, observationId);
      if (!observation || observation.projectId !== incident.projectId) throw new Error("Observation not found");
    }
    const duplicate = [...this.incidentLinks.values()].find((link) => link.incidentId === incidentId && link.planFindingId === planFindingId && link.observationId === observationId);
    if (duplicate) throw new DuplicateIncidentLinkError();
    const link: IncidentLink = {
      id: randomUUID(),
      incidentId,
      planFindingId,
      observationId,
      suggested: input.suggested ?? false,
      accepted: input.accepted ?? true,
      note: clean(input.note),
      createdAt: now(),
      finding: planFindingId ? this.planFindings.get(planFindingId) : undefined,
      observation: observationId ? this.observations.get(observationId) : undefined
    };
    this.incidentLinks.set(link.id, link);
    this.addIncidentAudit(userId, incidentId, planFindingId ? "plan_finding_link_added" : "observation_link_added", "Linked related plan finding or observation");
    return link;
  }

  async unlinkIncidentRecord(userId: string, linkId: string): Promise<void> {
    const link = this.incidentLinks.get(linkId);
    if (!link || !(await this.getIncident(userId, link.incidentId))) return;
    this.incidentLinks.delete(linkId);
    this.addIncidentAudit(userId, link.incidentId, "incident_link_removed", "Removed incident relationship link");
  }

  async runIncidentAiReview(userId: string, incidentId: string): Promise<IncidentDetail | null> {
    const detail = await this.getIncident(userId, incidentId);
    if (!detail) return null;
    this.incidents.set(incidentId, { ...detail, aiReviewStatus: "processing", aiErrorState: null, updatedAt: now() });
    this.addIncidentAudit(userId, incidentId, "ai_review_started", "Started incident oversight suggestions");
    const documents: SourceDetail[] = [];
    for (const attachment of detail.attachments) {
      const source = await this.getSource(userId, attachment.sourceId);
      if (source) documents.push(source);
    }
    const findings = detail.links.map((link) => link.finding).filter(Boolean) as PlanFinding[];
    const observations = detail.links.map((link) => link.observation).filter(Boolean) as FieldObservation[];
    const assistant = await runIncidentAssistant({
      factualDescription: detail.factualDescription,
      activity: detail.activity,
      contractorClassification: detail.contractorReportedClassification,
      documents,
      findings,
      observations
    });
    const current = this.incidents.get(incidentId);
    if (!current) return null;
    this.incidents.set(incidentId, {
      ...current,
      aiReviewStatus: assistant.processingStatus,
      aiSummary: assistant.processingStatus === "ready" ? assistant.summary : current.aiSummary,
      aiSuggestedConcerns: assistant.processingStatus === "ready" ? assistant.suggestedConcerns : current.aiSuggestedConcerns,
      aiSuggestedQuestions: assistant.processingStatus === "ready" ? assistant.suggestedQuestions : current.aiSuggestedQuestions,
      aiErrorState: assistant.errorState,
      updatedAt: now()
    });
    this.addIncidentAudit(userId, incidentId, assistant.processingStatus === "ready" ? "ai_review_ready" : "ai_review_failed", assistant.processingStatus === "ready" ? "Incident suggestions ready" : "Incident was preserved, but AI suggestions failed");
    return this.getIncident(userId, incidentId);
  }

  async closeIncident(userId: string, incidentId: string, input: IncidentCloseInput): Promise<IncidentDetail | null> {
    const current = this.incidents.get(incidentId);
    if (!current || !(await this.getProject(userId, current.projectId))) return null;
    this.incidents.set(incidentId, {
      ...current,
      oversightStatus: "closed",
      closedAt: now(),
      closedByUserId: userId,
      closureNote: input.closureNote.trim(),
      projectOutcome: clean(input.projectOutcome),
      unresolvedContractorItems: clean(input.unresolvedContractorItems),
      updatedAt: now()
    });
    this.addIncidentAudit(userId, incidentId, "incident_closed", "Closed project oversight record");
    return this.getIncident(userId, incidentId);
  }

  async reopenIncident(userId: string, incidentId: string, input: IncidentReopenInput): Promise<IncidentDetail | null> {
    const current = this.incidents.get(incidentId);
    if (!current || !(await this.getProject(userId, current.projectId))) return null;
    this.incidents.set(incidentId, {
      ...current,
      oversightStatus: "under_project_review",
      reopenedAt: now(),
      reopenedByUserId: userId,
      reopenReason: input.reason.trim(),
      updatedAt: now()
    });
    this.addIncidentAudit(userId, incidentId, "incident_reopened", input.reason.trim());
    return this.getIncident(userId, incidentId);
  }

  async listReports(userId: string, filters: ReportSearchInput): Promise<SafetyReport[]> {
    if (!(await this.getProject(userId, filters.projectId))) return [];
    return [...this.reports.values()]
      .filter((report) => report.projectId === filters.projectId)
      .filter((report) => !filters.reportType || report.reportType === filters.reportType)
      .filter((report) => !filters.status || report.status === filters.status)
      .filter((report) => !filters.dateFrom || report.periodEnd >= filters.dateFrom)
      .filter((report) => !filters.dateTo || report.periodStart <= filters.dateTo)
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.createdAt.localeCompare(a.createdAt));
  }

  async createReport(userId: string, input: ReportCreateInput): Promise<SafetyReportDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    const timestamp = now();
    const report: SafetyReport = {
      id: randomUUID(),
      projectId: input.projectId,
      reportType: input.reportType,
      format: input.format,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      title: clean(input.title) ?? `${titleCase(input.reportType)} Safety Report`,
      status: "draft",
      generationStatus: "not_generated",
      generationProvider: null,
      generationModel: null,
      errorState: null,
      scope: normalizeReportScope(input.scope),
      manualInputs: normalizeManualInputs(input.manualInputs),
      currentRevisionId: null,
      createdByUserId: userId,
      finalizedAt: null,
      finalizedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.reports.set(report.id, report);
    this.addReportAudit(userId, report.id, null, "report_created", "Created safety report shell");
    return this.buildReportDetail(report);
  }

  async getReport(userId: string, reportId: string): Promise<SafetyReportDetail | null> {
    const report = this.reports.get(reportId);
    if (!report || !(await this.getProject(userId, report.projectId))) return null;
    return this.buildReportDetail(report);
  }

  async updateReport(userId: string, reportId: string, input: ReportUpdateInput): Promise<SafetyReportDetail | null> {
    const current = this.reports.get(reportId);
    if (!current || !(await this.getProject(userId, current.projectId))) return null;
    const updated: SafetyReport = {
      ...current,
      title: input.title === undefined ? current.title : clean(input.title) ?? current.title,
      scope: input.scope ? normalizeReportScope(input.scope) : current.scope,
      manualInputs: input.manualInputs ? normalizeManualInputs(input.manualInputs) : current.manualInputs,
      updatedAt: now()
    };
    this.reports.set(reportId, updated);
    this.addReportAudit(userId, reportId, null, "report_updated", "Updated report metadata, scope, or manual inputs");
    return this.buildReportDetail(updated);
  }

  async generateReportDraft(userId: string, reportId: string, input: ReportGenerateInput): Promise<SafetyReportDetail | null> {
    const report = this.reports.get(reportId);
    if (!report || !(await this.getProject(userId, report.projectId))) return null;
    this.reports.set(reportId, { ...report, generationStatus: "generating", errorState: null, updatedAt: now() });
    const context = await this.buildReportEvidenceContext(userId, report);
    let draft;
    try {
      draft = await draftSafetyReport(context);
    } catch (error) {
      draft = draftFallbackSafetyReport(context, error);
    }
    const latest = this.reports.get(reportId) as SafetyReport;
    const existing = latest.currentRevisionId ? this.reportRevisions.get(latest.currentRevisionId) ?? null : null;
    const replaceExisting = existing && !input.preserveExisting && existing.status === "draft";
    const revision: SafetyReportRevision = {
      id: replaceExisting ? existing.id : randomUUID(),
      reportId,
      revisionNumber: replaceExisting ? existing.revisionNumber : this.nextReportRevisionNumber(reportId),
      status: "draft",
      title: latest.title,
      contentMarkdown: draft.contentMarkdown,
      contentJson: draft.contentJson,
      evidenceManifest: context.manifest,
      createdByUserId: userId,
      createdAt: replaceExisting ? existing.createdAt : now(),
      finalizedAt: null,
      finalizedByUserId: null
    };
    this.reportRevisions.set(revision.id, revision);
    const updated: SafetyReport = {
      ...latest,
      status: "draft",
      generationStatus: "ready",
      generationProvider: draft.provider,
      generationModel: draft.model,
      errorState: draft.errorState,
      currentRevisionId: revision.id,
      finalizedAt: null,
      finalizedByUserId: null,
      updatedAt: now()
    };
    this.reports.set(reportId, updated);
    this.addReportAudit(userId, reportId, revision.id, draft.errorState ? "report_generated_with_fallback" : "report_generated", "Generated editable report draft from evidence manifest");
    return this.buildReportDetail(updated);
  }

  async updateReportRevision(userId: string, revisionId: string, input: ReportRevisionUpdateInput): Promise<SafetyReportRevision | null> {
    const current = this.reportRevisions.get(revisionId);
    if (!current) return null;
    const report = this.reports.get(current.reportId);
    if (!report || !(await this.getProject(userId, report.projectId))) return null;
    const base = current.status === "finalized" ? { ...current, id: randomUUID(), revisionNumber: this.nextReportRevisionNumber(report.id), status: "draft" as const, createdAt: now(), finalizedAt: null, finalizedByUserId: null } : current;
    const updated: SafetyReportRevision = {
      ...base,
      title: input.title === undefined ? base.title : clean(input.title) ?? base.title,
      contentMarkdown: input.contentMarkdown ?? base.contentMarkdown,
      contentJson: input.contentJson ?? base.contentJson
    };
    this.reportRevisions.set(updated.id, updated);
    this.reports.set(report.id, { ...report, status: "draft", currentRevisionId: updated.id, updatedAt: now(), finalizedAt: null, finalizedByUserId: null });
    this.addReportAudit(userId, report.id, updated.id, "revision_edited", current.status === "finalized" ? "Created draft revision from finalized report edits" : "Edited report draft revision");
    return updated;
  }

  async finalizeReport(userId: string, reportId: string, input: ReportFinalizeInput): Promise<SafetyReportDetail | null> {
    const report = this.reports.get(reportId);
    if (!report || !(await this.getProject(userId, report.projectId)) || !report.currentRevisionId) return null;
    const revision = this.reportRevisions.get(report.currentRevisionId);
    if (!revision) return null;
    const timestamp = now();
    this.reportRevisions.set(revision.id, { ...revision, status: "finalized", finalizedAt: timestamp, finalizedByUserId: userId });
    const updated: SafetyReport = { ...report, status: "finalized", finalizedAt: timestamp, finalizedByUserId: userId, updatedAt: timestamp };
    this.reports.set(reportId, updated);
    this.addReportAudit(userId, reportId, revision.id, "report_finalized", clean(input.reviewerNote) ?? "Finalized safety report");
    return this.buildReportDetail(updated);
  }

  async createReportRevision(userId: string, reportId: string): Promise<SafetyReportDetail | null> {
    const report = this.reports.get(reportId);
    if (!report || !(await this.getProject(userId, report.projectId))) return null;
    const current = report.currentRevisionId ? this.reportRevisions.get(report.currentRevisionId) : null;
    const revision: SafetyReportRevision = {
      id: randomUUID(),
      reportId,
      revisionNumber: this.nextReportRevisionNumber(reportId),
      status: "draft",
      title: current?.title ?? report.title,
      contentMarkdown: current?.contentMarkdown ?? "",
      contentJson: current?.contentJson ?? {},
      evidenceManifest: current?.evidenceManifest ?? emptyReportManifest(report.periodStart, report.periodEnd),
      createdByUserId: userId,
      createdAt: now(),
      finalizedAt: null,
      finalizedByUserId: null
    };
    this.reportRevisions.set(revision.id, revision);
    const updated = { ...report, status: "draft" as const, currentRevisionId: revision.id, finalizedAt: null, finalizedByUserId: null, updatedAt: now() };
    this.reports.set(reportId, updated);
    this.addReportAudit(userId, reportId, revision.id, "revision_created", "Created editable report revision");
    return this.buildReportDetail(updated);
  }

  async exportReport(userId: string, reportId: string): Promise<ReportExport | null> {
    const detail = await this.getReport(userId, reportId);
    if (!detail || !detail.currentRevision) return null;
    return {
      filename: `${detail.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "safety-report"}.html`,
      contentType: "text/html; charset=utf-8",
      content: reportHtml(detail)
    };
  }

  async getAssistantDashboard(userId: string, projectId: string): Promise<AssistantDashboard> {
    if (!(await this.getProject(userId, projectId))) throw new Error("Project not found");
    return {
      conversations: await this.listAssistantConversations(userId, projectId),
      memoryEntries: await this.listMemoryEntries(userId, { projectId, activeOnly: true }),
      instructions: await this.listInstructionDocuments(userId, { projectId }),
      skills: await this.listSkills(userId, { projectId, activeOnly: true }),
      proposedActions: await this.listProposedActions(userId, { projectId }),
      actions: this.listAssistantActions()
    };
  }

  listAssistantActions(): AssistantActionDescriptor[] {
    return assistantActionDescriptors;
  }

  async listAssistantConversations(userId: string, projectId: string): Promise<AssistantConversation[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    return [...this.assistantConversations.values()]
      .filter((conversation) => conversation.ownerUserId === userId && conversation.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createAssistantConversation(userId: string, input: AssistantConversationCreateInput): Promise<AssistantConversationDetail> {
    if (!(await this.getProject(userId, input.projectId))) throw new Error("Project not found");
    if (input.contractorId && !(await this.getContractor(userId, input.contractorId))) throw new Error("Contractor not found");
    const timestamp = now();
    const conversation: AssistantConversation = {
      id: randomUUID(),
      projectId: input.projectId,
      ownerUserId: userId,
      title: input.title.trim(),
      context: {
        projectId: input.projectId,
        contractorId: clean(input.contractorId),
        retrievalScope: input.retrievalScope ?? "current_project",
        selectedProjectIds: [],
        activeSkillId: clean(input.activeSkillId)
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.assistantConversations.set(conversation.id, conversation);
    return this.buildAssistantConversationDetail(conversation);
  }

  async getAssistantConversation(userId: string, conversationId: string): Promise<AssistantConversationDetail | null> {
    const conversation = this.assistantConversations.get(conversationId);
    if (!conversation || conversation.ownerUserId !== userId || !(await this.getProject(userId, conversation.projectId))) return null;
    return this.buildAssistantConversationDetail(conversation);
  }

  async updateAssistantConversation(userId: string, conversationId: string, input: AssistantConversationUpdateInput): Promise<AssistantConversationDetail | null> {
    const current = this.assistantConversations.get(conversationId);
    if (!current || current.ownerUserId !== userId || !(await this.getProject(userId, current.projectId))) return null;
    const selectedProjectIds = input.selectedProjectIds ?? current.context.selectedProjectIds;
    for (const projectId of selectedProjectIds) {
      if (!(await this.getProject(userId, projectId))) throw new Error("Selected project not found");
    }
    if (input.contractorId && !(await this.getContractor(userId, input.contractorId))) throw new Error("Contractor not found");
    if (input.activeSkillId && !this.getAuthorizedSkill(userId, input.activeSkillId, current.projectId)) throw new Error("Skill not found");
    const updated: AssistantConversation = {
      ...current,
      title: input.title ?? current.title,
      context: {
        ...current.context,
        contractorId: input.contractorId === undefined ? current.context.contractorId : clean(input.contractorId),
        retrievalScope: input.retrievalScope ?? current.context.retrievalScope,
        selectedProjectIds,
        activeSkillId: input.activeSkillId === undefined ? current.context.activeSkillId : clean(input.activeSkillId)
      },
      updatedAt: now()
    };
    this.assistantConversations.set(conversationId, updated);
    return this.buildAssistantConversationDetail(updated);
  }

  async sendAssistantMessage(userId: string, conversationId: string, input: AssistantMessageSendInput): Promise<AssistantConversationDetail | null> {
    const conversation = this.assistantConversations.get(conversationId);
    if (!conversation || conversation.ownerUserId !== userId || !(await this.getProject(userId, conversation.projectId))) return null;
    const userMessage: AssistantMessage = { id: randomUUID(), conversationId, role: "user", content: input.content.trim(), provider: null, model: null, runId: null, createdAt: now() };
    this.assistantMessages.set(userMessage.id, userMessage);
    const run = await this.createAssistantRun(userId, conversation, input.content);
    const answer = this.composeAssistantAnswer(input.content, run);
    const assistantMessage: AssistantMessage = { id: randomUUID(), conversationId, role: "assistant", content: answer, provider: run.provider, model: run.model, runId: run.id, createdAt: now() };
    this.assistantMessages.set(assistantMessage.id, assistantMessage);
    this.assistantConversations.set(conversationId, { ...conversation, updatedAt: now() });
    return this.getAssistantConversation(userId, conversationId);
  }

  async listMemoryEntries(userId: string, filters: { projectId?: string; scope?: string; activeOnly?: boolean }): Promise<MemoryEntry[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    return [...this.memoryEntries.values()]
      .filter((entry) => entry.createdByUserId === userId)
      .filter((entry) => !filters.scope || entry.scope === filters.scope)
      .filter((entry) => !filters.projectId || entry.scope === "global" || entry.projectId === filters.projectId)
      .filter((entry) => !filters.activeOnly || entry.active)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createMemoryEntry(userId: string, input: MemoryEntryCreateInput): Promise<MemoryEntry> {
    const projectId = clean(input.projectId);
    if (input.scope === "project" && (!projectId || !(await this.getProject(userId, projectId)))) throw new Error("Project memory requires an authorized project");
    const timestamp = now();
    const entry: MemoryEntry = {
      id: randomUUID(),
      scope: input.scope,
      projectId: input.scope === "project" ? projectId : null,
      content: input.content.trim(),
      provenanceType: clean(input.provenanceType),
      provenanceId: clean(input.provenanceId),
      createdByUserId: userId,
      confirmedByUserId: userId,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.memoryEntries.set(entry.id, entry);
    return entry;
  }

  async updateMemoryEntry(userId: string, memoryId: string, input: MemoryEntryUpdateInput): Promise<MemoryEntry | null> {
    const current = this.memoryEntries.get(memoryId);
    if (!current || current.createdByUserId !== userId || (current.projectId && !(await this.getProject(userId, current.projectId)))) return null;
    const updated = { ...current, content: input.content ?? current.content, active: input.active ?? current.active, updatedAt: now() };
    this.memoryEntries.set(memoryId, updated);
    return updated;
  }

  async listInstructionDocuments(userId: string, filters: { projectId?: string; scope?: string }): Promise<InstructionDocument[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    return [...this.instructionDocuments.values()]
      .filter((doc) => doc.createdByUserId === userId)
      .filter((doc) => !filters.scope || doc.scope === filters.scope)
      .filter((doc) => !filters.projectId || doc.scope === "global" || doc.projectId === filters.projectId)
      .sort((a, b) => a.scope.localeCompare(b.scope) || a.area.localeCompare(b.area));
  }

  async saveInstructionDocument(userId: string, input: InstructionDocumentSaveInput): Promise<InstructionDocument> {
    const projectId = clean(input.projectId);
    if (input.scope === "project" && (!projectId || !(await this.getProject(userId, projectId)))) throw new Error("Project instruction requires an authorized project");
    const existing = [...this.instructionDocuments.values()].find((doc) => doc.createdByUserId === userId && doc.scope === input.scope && doc.projectId === (input.scope === "project" ? projectId : null) && doc.area === input.area.trim());
    const timestamp = now();
    const document: InstructionDocument = {
      id: existing?.id ?? randomUUID(),
      scope: input.scope,
      projectId: input.scope === "project" ? projectId : null,
      area: input.area.trim(),
      title: input.title.trim(),
      markdown: input.markdown.trim(),
      version: (existing?.version ?? 0) + 1,
      active: true,
      createdByUserId: existing?.createdByUserId ?? userId,
      updatedByUserId: userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    this.instructionDocuments.set(document.id, document);
    return document;
  }

  async listSkills(userId: string, filters: { projectId?: string; scope?: string; activeOnly?: boolean }): Promise<AssistantSkill[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    return [...this.skills.values()]
      .filter((skill) => skill.createdByUserId === userId)
      .filter((skill) => !filters.scope || skill.scope === filters.scope)
      .filter((skill) => !filters.projectId || skill.scope === "global" || skill.projectId === filters.projectId)
      .filter((skill) => !filters.activeOnly || skill.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveSkill(userId: string, input: SkillSaveInput): Promise<AssistantSkill> {
    const projectId = clean(input.projectId);
    if (input.scope === "project" && (!projectId || !(await this.getProject(userId, projectId)))) throw new Error("Project skill requires an authorized project");
    const existing = [...this.skills.values()].find((skill) => skill.createdByUserId === userId && skill.scope === input.scope && skill.projectId === (input.scope === "project" ? projectId : null) && skill.name.toLowerCase() === input.name.trim().toLowerCase());
    const timestamp = now();
    const skill: AssistantSkill = {
      id: existing?.id ?? randomUUID(),
      scope: input.scope,
      projectId: input.scope === "project" ? projectId : null,
      name: input.name.trim(),
      description: input.description.trim(),
      triggerDescription: input.triggerDescription.trim(),
      guidedPurpose: clean(input.guidedPurpose),
      guidedInputs: clean(input.guidedInputs),
      guidedOutputs: clean(input.guidedOutputs),
      guidedRules: clean(input.guidedRules),
      guidedAuthorityLimits: clean(input.guidedAuthorityLimits),
      markdown: input.markdown.trim(),
      version: (existing?.version ?? 0) + 1,
      active: input.active ?? true,
      createdByUserId: existing?.createdByUserId ?? userId,
      updatedByUserId: userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    this.skills.set(skill.id, skill);
    return skill;
  }

  async setActiveSkill(userId: string, conversationId: string, input: SkillActivationInput): Promise<AssistantConversationDetail | null> {
    return this.updateAssistantConversation(userId, conversationId, { activeSkillId: input.activeSkillId ?? "" });
  }

  async invokeAssistantAction(userId: string, input: AssistantActionInvokeInput): Promise<AssistantActionResult> {
    const descriptor = assistantActionDescriptors.find((action) => action.name === input.actionName);
    if (!descriptor) throw new Error("Assistant action is not registered");
    const conversation = input.conversationId ? this.assistantConversations.get(input.conversationId) ?? null : null;
    if (input.conversationId && (!conversation || conversation.ownerUserId !== userId)) throw new Error("Conversation not found");
    const projectId = String(input.input.projectId ?? conversation?.projectId ?? "");
    if (!projectId || !(await this.getProject(userId, projectId))) throw new Error("Project not found");
    const context = conversation?.context ?? { projectId, contractorId: null, retrievalScope: "current_project" as const, selectedProjectIds: [], activeSkillId: null };
    const run = await this.createAssistantRun(userId, { id: conversation?.id ?? "", projectId, ownerUserId: userId, title: "Action", context, createdAt: now(), updatedAt: now() }, input.actionName);
    const result = await this.executeAssistantAction(userId, descriptor, projectId, conversation?.id ?? null, input.input, run.retrievalManifest);
    return { actionName: descriptor.name, actionType: descriptor.actionType, result: result.result, proposal: result.proposal, run };
  }

  async listProposedActions(userId: string, filters: { projectId?: string; conversationId?: string }): Promise<ProposedAction[]> {
    if (filters.projectId && !(await this.getProject(userId, filters.projectId))) return [];
    return [...this.proposedActions.values()]
      .filter((proposal) => proposal.createdByUserId === userId)
      .filter((proposal) => !filters.conversationId || proposal.conversationId === filters.conversationId)
      .filter((proposal) => !filters.projectId || proposal.targetId === filters.projectId || proposal.evidence.projectIds.includes(filters.projectId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async editProposedAction(userId: string, proposalId: string, input: ProposedActionEditInput): Promise<ProposedAction | null> {
    const current = this.proposedActions.get(proposalId);
    if (!current || current.createdByUserId !== userId || !["proposed", "edited"].includes(current.status)) return null;
    const updated = { ...current, proposedChange: input.proposedChange ?? current.proposedChange, rationale: input.rationale === undefined ? current.rationale : clean(input.rationale), status: "edited" as const, updatedAt: now() };
    this.proposedActions.set(proposalId, updated);
    return updated;
  }

  async confirmProposedAction(userId: string, proposalId: string, input: ProposedActionConfirmInput): Promise<ProposedAction | null> {
    const current = this.proposedActions.get(proposalId);
    if (!current || current.createdByUserId !== userId || !["proposed", "edited"].includes(current.status)) return null;
    let executedResult: Record<string, unknown> | null = null;
    try {
      if (current.actionName === "propose_save_memory") {
        const saved = await this.createMemoryEntry(userId, current.proposedChange as unknown as MemoryEntryCreateInput);
        executedResult = { memoryId: saved.id };
      } else if (current.actionName === "propose_update_observation_followup") {
        const observationId = String(current.targetId ?? "");
        const observation = this.observations.get(observationId);
        if (!observation || observation.updatedAt !== current.currentState.updatedAt) throw new Error("Target changed since proposal was created");
        const updated = await this.updateObservation(userId, observationId, current.proposedChange);
        executedResult = { observationId: updated?.id };
      } else {
        throw new Error("No execution handler for proposed action");
      }
      const executed = { ...current, status: "executed" as const, confirmedByUserId: userId, confirmationNote: clean(input.confirmationNote), executedResult, updatedAt: now() };
      this.proposedActions.set(proposalId, executed);
      return executed;
    } catch (error) {
      const failed = { ...current, status: "failed" as const, confirmedByUserId: userId, confirmationNote: clean(input.confirmationNote), errorState: error instanceof Error ? error.message : "Proposal execution failed", updatedAt: now() };
      this.proposedActions.set(proposalId, failed);
      return failed;
    }
  }

  async rejectProposedAction(userId: string, proposalId: string, input: ProposedActionRejectInput): Promise<ProposedAction | null> {
    const current = this.proposedActions.get(proposalId);
    if (!current || current.createdByUserId !== userId || !["proposed", "edited"].includes(current.status)) return null;
    const rejected = { ...current, status: "rejected" as const, rejectionReason: clean(input.rejectionReason), updatedAt: now() };
    this.proposedActions.set(proposalId, rejected);
    return rejected;
  }

  private buildAssistantConversationDetail(conversation: AssistantConversation): AssistantConversationDetail {
    return {
      ...conversation,
      messages: [...this.assistantMessages.values()].filter((message) => message.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      runs: [...this.assistantRuns.values()].filter((run) => run.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    };
  }

  private async createAssistantRun(userId: string, conversation: AssistantConversation, query: string): Promise<AssistantRun> {
    const manifest = await this.buildAssistantRetrievalManifest(userId, conversation.context, query);
    const skill = conversation.context.activeSkillId ? this.skills.get(conversation.context.activeSkillId) ?? null : null;
    const summary: AssistantContextSummary = {
      scope: conversation.context.retrievalScope,
      sources: manifest.sourceIds.length,
      sourceChunks: manifest.sourceChunkIds.length,
      operationalRecords: manifest.operationalRecords.length,
      memoryEntries: manifest.memoryIds.length,
      instructions: manifest.instructionIds,
      activeSkill: skill?.name ?? null,
      activeSkillVersion: skill?.version ?? null
    };
    const run: AssistantRun = {
      id: randomUUID(),
      conversationId: conversation.id || null,
      status: "completed",
      provider: process.env.ASSISTANT_AI_PROVIDER === "openai" ? "openai-unconfigured" : "local-assistant-orchestrator",
      model: process.env.ASSISTANT_AI_PROVIDER === "openai" ? process.env.OPENAI_ASSISTANT_MODEL ?? null : "deterministic-context-orchestrator-v1",
      contextSummary: summary,
      retrievalManifest: manifest,
      errorState: process.env.ASSISTANT_AI_PROVIDER === "fail-test" ? "Assistant provider test failure; deterministic read/draft actions remain available." : null,
      createdAt: now(),
      completedAt: now()
    };
    this.assistantRuns.set(run.id, run);
    return run;
  }

  private composeAssistantAnswer(prompt: string, run: AssistantRun): string {
    const records = run.retrievalManifest.operationalRecords.slice(0, 12).map((record) => `- ${record.type}: ${record.label}`).join("\n") || "- No matching operational records found in the selected scope.";
    const providerLine = run.errorState ? `\n\nProvider note: ${run.errorState}` : "";
    const skillLine = run.contextSummary.activeSkill
      ? `Active Skill: ${run.contextSummary.activeSkill} v${run.contextSummary.activeSkillVersion ?? "unknown"}\nSkill-guided procedure: apply this skill only through registered read, draft, or proposed-write actions.`
      : "Active Skill: None";
    const suggested = prompt.toLowerCase().includes("meeting")
      ? "\n\nSuggested actions:\n- Draft project meeting brief\n- Review open follow-up\n- Check pending proposed actions"
      : "\n\nSuggested actions:\n- Retrieve sources\n- Draft project meeting brief\n- Propose memory update";
    return [
      "Context used",
      `Scope: ${run.contextSummary.scope}`,
      `Sources: ${run.contextSummary.sources}`,
      `Operational records: ${run.contextSummary.operationalRecords}`,
      `Project Memory: ${run.contextSummary.memoryEntries} entries`,
      `Instructions: ${run.contextSummary.instructions.length}`,
      skillLine,
      "Provider: deterministic local assistant orchestrator; no external conversational provider is configured.",
      "",
      "Grounded summary",
      records,
      providerLine,
      suggested
    ].join("\n");
  }

  private async buildAssistantRetrievalManifest(userId: string, context: AssistantContext, query: string): Promise<AssistantRetrievalManifest> {
    const projectIds = await this.authorizedAssistantProjectIds(userId, context);
    const sourceChunks = await this.searchSourceChunks(userId, { q: query || "safety", projectId: context.projectId, activeOnly: context.retrievalScope !== "global_library" });
    const operationalRecords: Array<{ type: string; id: string; label: string }> = [];
    for (const projectId of projectIds) {
      const engagements = await this.listProjectEngagements(userId, projectId);
      const engagementById = new Map(engagements.map((engagement) => [engagement.id, engagement]));
      const observations = await this.listObservations(userId, { projectId });
      const incidents = await this.listIncidents(userId, { projectId });
      const reports = await this.listReports(userId, { projectId });
      const decisions = [...this.projectSafetyDecisions.values()].filter((decision) => decision.projectId === projectId);
      const readinessStatuses = [...this.requirementStatuses.values()].filter((status) => {
        const engagement = engagementById.get(status.engagementId);
        return engagement && (!context.contractorId || engagement.contractorId === context.contractorId) && !["accepted", "not_applicable"].includes(status.status);
      });
      const planIds = new Set([...this.safetyPlans.values()].filter((plan) => {
        const engagement = engagementById.get(plan.engagementId);
        return plan.projectId === projectId && (!context.contractorId || engagement?.contractorId === context.contractorId);
      }).map((plan) => plan.id));
      const reviewIds = new Set([...this.planReviews.values()].filter((review) => planIds.has(review.planId)).map((review) => review.id));
      const planFindings = [...this.planFindings.values()].filter((finding) => reviewIds.has(finding.reviewId) && !finding.resolved && !finding.notApplicable);
      readinessStatuses.slice(0, 8).forEach((item) => operationalRecords.push({ type: "readiness", id: item.id, label: `${item.requirement?.title ?? item.requirementId}: ${item.status}` }));
      planFindings.slice(0, 8).forEach((item) => operationalRecords.push({ type: "plan_finding", id: item.id, label: item.title }));
      observations.filter((item) => !context.contractorId || item.contractorId === context.contractorId).slice(0, 8).forEach((item) => operationalRecords.push({ type: "observation", id: item.id, label: item.derivedSummary ?? item.originalText }));
      incidents.filter((item) => !context.contractorId || item.contractorId === context.contractorId).slice(0, 8).forEach((item) => operationalRecords.push({ type: "incident", id: item.id, label: item.factualDescription }));
      reports.slice(0, 4).forEach((item) => operationalRecords.push({ type: "report", id: item.id, label: item.title }));
      decisions.slice(0, 4).forEach((item) => operationalRecords.push({ type: "project_decision", id: item.id, label: item.decisionText }));
    }
    const memories = await this.listMemoryEntries(userId, { projectId: context.projectId, activeOnly: true });
    const instructions = await this.listInstructionDocuments(userId, { projectId: context.projectId });
    const skill = context.activeSkillId ? this.getAuthorizedSkill(userId, context.activeSkillId, context.projectId) : null;
    return {
      scope: context.retrievalScope,
      projectIds,
      contractorId: context.contractorId,
      sourceIds: [...new Set(sourceChunks.map((chunk) => chunk.sourceId))],
      sourceChunkIds: sourceChunks.map((chunk) => chunk.id),
      operationalRecords,
      memoryIds: memories.map((entry) => entry.id),
      instructionIds: instructions.map((instruction) => instruction.id),
      skillId: skill?.id ?? null,
      skillVersion: skill?.version ?? null
    };
  }

  private async authorizedAssistantProjectIds(userId: string, context: AssistantContext): Promise<string[]> {
    if (context.retrievalScope === "selected_projects") {
      const allowed: string[] = [];
      for (const projectId of context.selectedProjectIds) {
        if (await this.getProject(userId, projectId)) allowed.push(projectId);
      }
      return allowed.length ? allowed : [context.projectId];
    }
    if (context.retrievalScope === "entire_workspace") {
      return (await this.listProjects(userId)).map((project) => project.id);
    }
    return [context.projectId];
  }

  private getAuthorizedSkill(userId: string, skillId: string, projectId: string): AssistantSkill | null {
    const skill = this.skills.get(skillId);
    if (!skill || skill.createdByUserId !== userId || !skill.active) return null;
    if (skill.scope === "project" && skill.projectId !== projectId) return null;
    return skill;
  }

  private async executeAssistantAction(
    userId: string,
    descriptor: AssistantActionDescriptor,
    projectId: string,
    conversationId: string | null,
    input: Record<string, unknown>,
    evidence: AssistantRetrievalManifest
  ): Promise<{ result: unknown; proposal?: ProposedAction }> {
    if (descriptor.name === "get_project_status") {
      return { result: { summaries: await this.listProjectReadinessSummaries(userId, projectId), observations: await this.listObservations(userId, { projectId }), incidents: await this.listIncidents(userId, { projectId }), reports: await this.listReports(userId, { projectId }) } };
    }
    if (descriptor.name === "get_open_observation_followup") {
      return { result: { observations: await this.listObservations(userId, { projectId, followUpStatus: "needed" }) } };
    }
    if (descriptor.name === "get_open_incident_followup") {
      return { result: { incidents: await this.listIncidents(userId, { projectId, openOnly: true }) } };
    }
    if (descriptor.name === "get_reports") {
      return { result: { reports: await this.listReports(userId, { projectId }) } };
    }
    if (descriptor.name === "retrieve_sources") {
      return { result: { chunks: await this.searchSourceChunks(userId, { q: String(input.q ?? ""), projectId, activeOnly: true }) } };
    }
    if (descriptor.name === "draft_project_meeting_brief") {
      const observations = await this.listObservations(userId, { projectId, followUpStatus: "needed" });
      const incidents = await this.listIncidents(userId, { projectId, openOnly: true });
      const reports = await this.listReports(userId, { projectId });
      return { result: { markdown: ["# Project Meeting Brief", "", `Open observation follow-up: ${observations.length}`, `Open incidents: ${incidents.length}`, `Recent reports: ${reports.length}`, "", "This is a draft artifact and does not modify operational records."].join("\n") } };
    }
    if (descriptor.name === "draft_contractor_followup") {
      return { result: { markdown: `Draft contractor follow-up:\n\nPlease review the open project safety items and provide updated evidence or status before the next coordination meeting.\n\nThis is draft wording only.` } };
    }
    if (descriptor.name === "propose_save_memory") {
      const proposal = this.createProposal(userId, conversationId, descriptor.name, "memory", null, {}, { scope: input.scope ?? "project", projectId, content: String(input.content ?? ""), provenanceType: input.provenanceType ?? "assistant_proposal", provenanceId: input.provenanceId ?? "" }, String(input.rationale ?? "Assistant proposed memory for human review."), evidence);
      return { result: { proposalId: proposal.id }, proposal };
    }
    if (descriptor.name === "propose_update_observation_followup") {
      const observationId = String(input.observationId ?? "");
      const observation = this.observations.get(observationId);
      if (!observation || observation.projectId !== projectId || !(await this.getObservation(userId, observationId))) throw new Error("Observation not found");
      const proposal = this.createProposal(userId, conversationId, descriptor.name, "observation", observationId, { updatedAt: observation.updatedAt, followUpStatus: observation.followUpStatus, followUpNote: observation.followUpNote }, { followUpStatus: input.followUpStatus ?? "verified_closed", followUpNote: input.followUpNote ?? "Updated by confirmed assistant proposal." }, String(input.rationale ?? "Assistant proposed follow-up update for human review."), evidence);
      return { result: { proposalId: proposal.id }, proposal };
    }
    throw new Error("Assistant action handler unavailable");
  }

  private createProposal(
    userId: string,
    conversationId: string | null,
    actionName: string,
    targetType: string,
    targetId: string | null,
    currentState: Record<string, unknown>,
    proposedChange: Record<string, unknown>,
    rationale: string,
    evidence: AssistantRetrievalManifest
  ): ProposedAction {
    const timestamp = now();
    const proposal: ProposedAction = { id: randomUUID(), conversationId, originMessageId: null, actionName, targetType, targetId, currentState, proposedChange, rationale, evidence, createdByUserId: userId, status: "proposed", confirmedByUserId: null, confirmationNote: null, rejectionReason: null, executedResult: null, errorState: null, createdAt: timestamp, updatedAt: timestamp };
    this.proposedActions.set(proposal.id, proposal);
    return proposal;
  }

  private async buildReportEvidenceContext(userId: string, report: SafetyReport): Promise<ReportEvidenceContext> {
    const project = (await this.getProject(userId, report.projectId)) as Project;
    const engagements = await this.listProjectEngagements(userId, report.projectId);
    const observations = [...this.observations.values()].filter((item) => item.projectId === report.projectId);
    const incidents = [...this.incidents.values()].filter((item) => item.projectId === report.projectId);
    const inPeriodObservations = observations.filter((item) => item.observedAt.slice(0, 10) >= report.periodStart && item.observedAt.slice(0, 10) <= report.periodEnd);
    const carriedObservations = observations.filter((item) => item.observedAt.slice(0, 10) < report.periodStart && item.followUpStatus === "needed");
    const inPeriodIncidents = incidents.filter((item) => item.incidentDateTime.slice(0, 10) >= report.periodStart && item.incidentDateTime.slice(0, 10) <= report.periodEnd);
    const carriedIncidents = incidents.filter((item) => item.incidentDateTime.slice(0, 10) < report.periodStart && item.oversightStatus !== "closed");
    const safetyPlans = [...this.safetyPlans.values()].filter((plan) => plan.projectId === report.projectId);
    const planReviews = [...this.planReviews.values()].filter((review) => safetyPlans.some((plan) => plan.id === review.planId));
    const readinessStatuses = [...this.requirementStatuses.values()].filter((status) => {
      const engagement = this.engagements.get(status.engagementId);
      return engagement?.projectId === report.projectId;
    });
    const projectDecisions = [...this.projectSafetyDecisions.values()].filter((decision) => decision.projectId === report.projectId && decision.status === "active");
    const inPeriodDecisions = projectDecisions.filter((decision) => decision.effectiveDate ? decision.effectiveDate >= report.periodStart && decision.effectiveDate <= report.periodEnd : decision.createdAt.slice(0, 10) >= report.periodStart && decision.createdAt.slice(0, 10) <= report.periodEnd);
    const carriedDecisions = projectDecisions.filter((decision) => !inPeriodDecisions.some((item) => item.id === decision.id));
    const sourceIds = new Set<string>();
    safetyPlans.forEach((plan) => {
      if (plan.currentRevisionId) {
        const revision = this.planRevisions.get(plan.currentRevisionId);
        if (revision) sourceIds.add(revision.sourceId);
      }
    });
    [...this.incidentAttachments.values()]
      .filter((attachment) => incidents.some((incident) => incident.id === attachment.incidentId))
      .forEach((attachment) => sourceIds.add(attachment.sourceId));
    [...this.observationReferences.values()]
      .filter((link) => observations.some((observation) => observation.id === link.observationId))
      .forEach((link) => sourceIds.add(link.sourceId));
    const manifest: ReportEvidenceManifest = {
      generatedAt: now(),
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      newDuringPeriod: {
        observationIds: inPeriodObservations.map((item) => item.id),
        incidentIds: inPeriodIncidents.map((item) => item.id),
        planReviewIds: planReviews.filter((review) => review.createdAt.slice(0, 10) >= report.periodStart && review.createdAt.slice(0, 10) <= report.periodEnd).map((review) => review.id),
        readinessStatusIds: readinessStatuses.filter((status) => status.updatedAt.slice(0, 10) >= report.periodStart && status.updatedAt.slice(0, 10) <= report.periodEnd).map((status) => status.id),
        projectDecisionIds: inPeriodDecisions.map((decision) => decision.id)
      },
      carriedOpen: {
        observationIds: report.scope.includeOpenFollowUp ? carriedObservations.map((item) => item.id) : [],
        incidentIds: report.scope.includeOpenFollowUp ? carriedIncidents.map((item) => item.id) : [],
        planReviewIds: planReviews.filter((review) => review.createdAt.slice(0, 10) < report.periodStart && review.status !== "approved").map((review) => review.id),
        readinessStatusIds: readinessStatuses.filter((status) => status.updatedAt.slice(0, 10) < report.periodStart && !["accepted", "not_applicable"].includes(status.status)).map((status) => status.id),
        projectDecisionIds: carriedDecisions.map((decision) => decision.id)
      },
      sourceIds: [...sourceIds]
    };
    return {
      project,
      reportType: report.reportType,
      format: report.format,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      scope: report.scope,
      manualInputs: report.manualInputs,
      engagements,
      observations: inPeriodObservations.map((item) => this.withObservationContext(item)),
      carriedObservations: carriedObservations.map((item) => this.withObservationContext(item)),
      incidents: inPeriodIncidents.map((item) => this.withIncidentContext(item)),
      carriedIncidents: carriedIncidents.map((item) => this.withIncidentContext(item)),
      safetyPlans,
      readinessStatuses,
      projectDecisions,
      manifest
    };
  }

  private nextReportRevisionNumber(reportId: string): number {
    return Math.max(0, ...[...this.reportRevisions.values()].filter((revision) => revision.reportId === reportId).map((revision) => revision.revisionNumber)) + 1;
  }

  private buildReportDetail(report: SafetyReport): SafetyReportDetail {
    const revisions = [...this.reportRevisions.values()].filter((revision) => revision.reportId === report.id).sort((a, b) => b.revisionNumber - a.revisionNumber);
    return {
      ...report,
      currentRevision: report.currentRevisionId ? this.reportRevisions.get(report.currentRevisionId) ?? null : null,
      revisions,
      auditEvents: this.reportAuditEvents.filter((event) => event.reportId === report.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    };
  }

  private addReportAudit(userId: string, reportId: string, revisionId: string | null, eventType: string, message: string) {
    this.reportAuditEvents.push({ id: randomUUID(), reportId, revisionId, eventType, message, actorUserId: userId, createdAt: now() });
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

  private async getPlanFindingForObservation(userId: string, findingId: string, projectId: string): Promise<PlanFinding | null> {
    const finding = this.planFindings.get(findingId);
    if (!finding) return null;
    const review = await this.getReviewForUser(userId, finding.reviewId);
    if (!review) return null;
    const plan = await this.getPlanForUser(userId, review.planId);
    return plan?.projectId === projectId ? finding : null;
  }

  private buildObservationDetail(observation: FieldObservation): ObservationDetail {
    return {
      ...this.withObservationContext(observation),
      photos: [...this.observationPhotos.values()]
        .filter((photo) => photo.observationId === observation.id)
        .map((photo) => ({ ...photo, source: this.sources.get(photo.sourceId) })),
      referenceLinks: [...this.observationReferences.values()]
        .filter((link) => link.observationId === observation.id)
        .map((link) => ({ ...link, source: this.sources.get(link.sourceId) })),
      planFindingLinks: [...this.observationPlanFindingLinks.values()]
        .filter((link) => link.observationId === observation.id)
        .map((link) => ({ ...link, finding: this.planFindings.get(link.findingId) })),
      auditEvents: this.observationAuditEvents
        .filter((event) => event.observationId === observation.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    };
  }

  private buildIncidentDetail(incident: IncidentRecord): IncidentDetail {
    return {
      ...this.withIncidentContext(incident),
      attachments: [...this.incidentAttachments.values()]
        .filter((attachment) => attachment.incidentId === incident.id)
        .map((attachment) => ({ ...attachment, source: this.sources.get(attachment.sourceId) })),
      contractorCorrectiveActions: [...this.contractorCorrectiveActions.values()]
        .filter((action) => action.incidentId === incident.id)
        .map((action) => ({ ...action, source: action.sourceId ? this.sources.get(action.sourceId) : undefined })),
      projectReview: [...this.incidentProjectReviews.values()].find((review) => review.incidentId === incident.id) ?? null,
      recommendations: [...this.incidentRecommendations.values()].filter((recommendation) => recommendation.incidentId === incident.id),
      projectDecisions: [...this.projectSafetyDecisions.values()]
        .filter((decision) => decision.incidentId === incident.id)
        .map((decision) => ({ ...decision, source: decision.supportingSourceId ? this.sources.get(decision.supportingSourceId) : undefined })),
      followUps: [...this.incidentFollowUps.values()]
        .filter((followUp) => followUp.incidentId === incident.id)
        .map((followUp) => ({
          ...followUp,
          source: followUp.linkedSourceId ? this.sources.get(followUp.linkedSourceId) : undefined,
          observation: followUp.linkedObservationId ? this.observations.get(followUp.linkedObservationId) : undefined
        })),
      links: [...this.incidentLinks.values()]
        .filter((link) => link.incidentId === incident.id)
        .map((link) => ({
          ...link,
          finding: link.planFindingId ? this.planFindings.get(link.planFindingId) : undefined,
          observation: link.observationId ? this.observations.get(link.observationId) : undefined
        })),
      auditEvents: this.incidentAuditEvents
        .filter((event) => event.incidentId === incident.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    };
  }

  private withObservationContext(observation: FieldObservation): FieldObservation {
    const engagement = observation.engagementId ? this.engagements.get(observation.engagementId) : undefined;
    return {
      ...observation,
      engagement: engagement ? { ...engagement, contractor: this.contractors.get(engagement.contractorId) } : undefined
    };
  }

  private withIncidentContext(incident: IncidentRecord): IncidentRecord {
    const engagement = incident.engagementId ? this.engagements.get(incident.engagementId) : undefined;
    return {
      ...incident,
      engagement: engagement ? { ...engagement, contractor: this.contractors.get(engagement.contractorId) } : undefined
    };
  }

  private refreshObservationRecurrence(observationId: string): void {
    const observation = this.observations.get(observationId);
    if (!observation) return;
    const comparable = [...this.observations.values()].filter((item) =>
      item.id !== observation.id &&
      item.projectId === observation.projectId &&
      (observation.engagementId ? item.engagementId === observation.engagementId : true) &&
      Boolean(observation.category) &&
      item.category === observation.category
    );
    const recurrenceCount = comparable.length;
    this.observations.set(observationId, {
      ...observation,
      recurrenceCount,
      recurrenceSummary: recurrenceCount > 0 ? `${recurrenceCount} prior observation${recurrenceCount === 1 ? "" : "s"} share this project/category context.` : null
    });
  }

  private hasHumanPlanReviewWork(reviewId: string): boolean {
    const review = this.planReviews.get(reviewId);
    const findings = [...this.planFindings.values()].filter((finding) => finding.reviewId === reviewId);
    return Boolean(
      review?.internalReviewerNotes ||
      findings.some((finding) =>
        finding.origin === "reviewer" ||
        finding.reviewerNotes ||
        finding.resolved ||
        finding.notApplicable ||
        (finding.reviewerExplanation && finding.reviewerExplanation !== finding.aiExplanation)
      )
    );
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

  private addObservationAudit(userId: string, observationId: string, eventType: string, message: string) {
    this.observationAuditEvents.push({
      id: randomUUID(),
      observationId,
      eventType,
      message,
      actorUserId: userId,
      createdAt: now()
    });
  }

  private addIncidentAudit(userId: string, incidentId: string, eventType: string, message: string) {
    this.incidentAuditEvents.push({
      id: randomUUID(),
      incidentId,
      eventType,
      message,
      actorUserId: userId,
      createdAt: now()
    });
  }
}
