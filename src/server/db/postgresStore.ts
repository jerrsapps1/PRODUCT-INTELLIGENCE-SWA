import pg from "pg";
import type {
  Contractor,
  ContractorCreateInput,
  EngagementCreateInput,
  Project,
  ProjectContractorEngagement,
  ProjectCreateInput
} from "../../shared/contracts";
import { DuplicateEngagementError, type AppStore, type StoredUser } from "../store";

const { Pool } = pg;

const initialMigration = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  project_identifier text,
  location text NOT NULL,
  federal_classification text NOT NULL CHECK (federal_classification IN ('Federal', 'Non-Federal')),
  description text,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  trade text,
  primary_contact_name text,
  primary_contact_email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, legal_name)
);

CREATE TABLE IF NOT EXISTS project_contractor_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  scope_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contractors_owner_user_id ON contractors(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_engagements_project_id ON project_contractor_engagements(project_id);
`;

function clean(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function mapUser(row: Record<string, unknown>): StoredUser {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash)
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    projectIdentifier: row.project_identifier ? String(row.project_identifier) : null,
    location: String(row.location),
    federalClassification: row.federal_classification as Project["federalClassification"],
    description: row.description ? String(row.description) : null,
    startDate: toIsoDate(row.start_date as Date | string | null),
    endDate: toIsoDate(row.end_date as Date | string | null),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapContractor(row: Record<string, unknown>): Contractor {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    legalName: String(row.legal_name),
    trade: row.trade ? String(row.trade) : null,
    primaryContactName: row.primary_contact_name ? String(row.primary_contact_name) : null,
    primaryContactEmail: row.primary_contact_email ? String(row.primary_contact_email) : null,
    phone: row.phone ? String(row.phone) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapEngagement(row: Record<string, unknown>, contractor?: Contractor): ProjectContractorEngagement {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    contractorId: String(row.contractor_id),
    scopeSummary: row.scope_summary ? String(row.scope_summary) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    contractor
  };
}

export class PostgresStore implements AppStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async migrate(): Promise<void> {
    await this.pool.query(initialMigration);
  }

  async ensureBootstrapUser(user: { email: string; displayName: string; passwordHash: string }): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [user.email.toLowerCase(), user.displayName, user.passwordHash]
    );
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserBySessionTokenHash(tokenHash: string): Promise<StoredUser | null> {
    const result = await this.pool.query(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [tokenHash]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
      userId,
      tokenHash,
      expiresAt
    ]);
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  async listProjects(userId: string): Promise<Project[]> {
    const result = await this.pool.query("SELECT * FROM projects WHERE owner_user_id = $1 ORDER BY created_at DESC", [
      userId
    ]);
    return result.rows.map(mapProject);
  }

  async createProject(userId: string, input: ProjectCreateInput): Promise<Project> {
    const result = await this.pool.query(
      `INSERT INTO projects
       (owner_user_id, name, project_identifier, location, federal_classification, description, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        input.name.trim(),
        clean(input.projectIdentifier),
        input.location.trim(),
        input.federalClassification,
        clean(input.description),
        clean(input.startDate),
        clean(input.endDate)
      ]
    );
    return mapProject(result.rows[0]);
  }

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const result = await this.pool.query("SELECT * FROM projects WHERE owner_user_id = $1 AND id = $2", [
      userId,
      projectId
    ]);
    return result.rows[0] ? mapProject(result.rows[0]) : null;
  }

  async listContractors(userId: string): Promise<Contractor[]> {
    const result = await this.pool.query("SELECT * FROM contractors WHERE owner_user_id = $1 ORDER BY legal_name", [
      userId
    ]);
    return result.rows.map(mapContractor);
  }

  async createContractor(userId: string, input: ContractorCreateInput): Promise<Contractor> {
    const result = await this.pool.query(
      `INSERT INTO contractors
       (owner_user_id, legal_name, trade, primary_contact_name, primary_contact_email, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        input.legalName.trim(),
        clean(input.trade),
        clean(input.primaryContactName),
        clean(input.primaryContactEmail),
        clean(input.phone)
      ]
    );
    return mapContractor(result.rows[0]);
  }

  async getContractor(userId: string, contractorId: string): Promise<Contractor | null> {
    const result = await this.pool.query("SELECT * FROM contractors WHERE owner_user_id = $1 AND id = $2", [
      userId,
      contractorId
    ]);
    return result.rows[0] ? mapContractor(result.rows[0]) : null;
  }

  async listProjectEngagements(userId: string, projectId: string): Promise<ProjectContractorEngagement[]> {
    const result = await this.pool.query(
      `SELECT e.*, c.id AS c_id, c.owner_user_id AS c_owner_user_id, c.legal_name, c.trade,
              c.primary_contact_name, c.primary_contact_email, c.phone,
              c.created_at AS c_created_at, c.updated_at AS c_updated_at
       FROM project_contractor_engagements e
       JOIN projects p ON p.id = e.project_id
       JOIN contractors c ON c.id = e.contractor_id
       WHERE p.owner_user_id = $1 AND e.project_id = $2
       ORDER BY e.created_at DESC`,
      [userId, projectId]
    );
    return result.rows.map((row) =>
      mapEngagement(row, mapContractor({
        id: row.c_id,
        owner_user_id: row.c_owner_user_id,
        legal_name: row.legal_name,
        trade: row.trade,
        primary_contact_name: row.primary_contact_name,
        primary_contact_email: row.primary_contact_email,
        phone: row.phone,
        created_at: row.c_created_at,
        updated_at: row.c_updated_at
      }))
    );
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
      const contractor = await this.createContractor(userId, input.contractor);
      contractorId = contractor.id;
    }
    if (!contractorId || !(await this.getContractor(userId, contractorId))) {
      throw new Error("Contractor not found");
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO project_contractor_engagements (project_id, contractor_id, scope_summary)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [projectId, contractorId, clean(input.scopeSummary)]
      );
      return (await this.getProjectEngagement(userId, projectId, result.rows[0].id)) ?? mapEngagement(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateEngagementError();
      throw error;
    }
  }

  async getProjectEngagement(
    userId: string,
    projectId: string,
    engagementId: string
  ): Promise<ProjectContractorEngagement | null> {
    const engagements = await this.listProjectEngagements(userId, projectId);
    return engagements.find((engagement) => engagement.id === engagementId) ?? null;
  }
}
