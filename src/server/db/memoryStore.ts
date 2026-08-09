import { randomUUID } from "node:crypto";
import type {
  Contractor,
  ContractorCreateInput,
  EngagementCreateInput,
  Project,
  ProjectContractorEngagement,
  ProjectCreateInput
} from "../../shared/contracts";
import { DuplicateEngagementError, type AppStore, type StoredUser } from "../store";

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
}
