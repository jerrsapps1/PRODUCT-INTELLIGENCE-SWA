import type {
  Contractor,
  ContractorCreateInput,
  EngagementCreateInput,
  Project,
  ProjectContractorEngagement,
  ProjectCreateInput,
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
}

export class DuplicateEngagementError extends Error {
  constructor() {
    super("Contractor is already engaged on this project");
  }
}
