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
  SourceUpdateInput,
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
