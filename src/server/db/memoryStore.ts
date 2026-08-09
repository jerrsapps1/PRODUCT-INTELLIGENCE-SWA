import { randomUUID } from "node:crypto";
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
  SourceChunk,
  SourceDetail,
  SourceRecord,
  SourceSearchInput,
  SourceUpdateInput
} from "../../shared/contracts";
import { DuplicateEngagementError, DuplicateProjectSourceError, type AppStore, type StoredUser } from "../store";

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
}
