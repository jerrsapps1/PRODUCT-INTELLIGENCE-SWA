import pg from "pg";
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

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_filename text,
  mime_type text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('pdf', 'docx', 'xlsx', 'pptx', 'txt', 'markdown', 'csv', 'image', 'url', 'other')),
  scope text NOT NULL CHECK (scope IN ('global', 'project', 'contractor')),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  authority_classification text NOT NULL CHECK (authority_classification IN ('regulatory_requirement', 'project_requirement', 'owner_requirement', 'gc_policy', 'general_reference', 'contractor_submission', 'working_document', 'generated_artifact')),
  user_confirmed_classification boolean NOT NULL DEFAULT false,
  ai_suggested_classification text,
  storage_key text,
  original_url text,
  size_bytes integer NOT NULL DEFAULT 0,
  processing_status text NOT NULL CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'partial', 'failed')),
  extraction_status text NOT NULL CHECK (extraction_status IN ('uploaded', 'processing', 'ready', 'partial', 'failed')),
  extraction_version text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_chunks (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  location_label text,
  citation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  activation_status text NOT NULL CHECK (activation_status IN ('available', 'associated', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_sources_owner_user_id ON sources(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sources_project_id ON sources(project_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_source_id ON source_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_text ON source_chunks USING gin (to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_project_sources_project_id ON project_sources(project_id);
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

function mapSource(row: Record<string, unknown>): SourceRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    originalFilename: row.original_filename ? String(row.original_filename) : null,
    mimeType: String(row.mime_type),
    sourceType: row.source_type as SourceRecord["sourceType"],
    scope: row.scope as SourceRecord["scope"],
    projectId: row.project_id ? String(row.project_id) : null,
    authorityClassification: row.authority_classification as SourceRecord["authorityClassification"],
    userConfirmedClassification: Boolean(row.user_confirmed_classification),
    aiSuggestedClassification: row.ai_suggested_classification as SourceRecord["aiSuggestedClassification"] ?? null,
    storageKey: row.storage_key ? String(row.storage_key) : null,
    originalUrl: row.original_url ? String(row.original_url) : null,
    sizeBytes: Number(row.size_bytes),
    processingStatus: row.processing_status as SourceRecord["processingStatus"],
    extractionStatus: row.extraction_status as SourceRecord["extractionStatus"],
    extractionVersion: row.extraction_version ? String(row.extraction_version) : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    uploadedAt: new Date(row.uploaded_at as string).toISOString(),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}

function mapChunk(row: Record<string, unknown>): SourceChunk {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    chunkIndex: Number(row.chunk_index),
    text: String(row.text),
    locationLabel: row.location_label ? String(row.location_label) : null,
    citation: (row.citation as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString()
  };
}

function mapProjectSource(row: Record<string, unknown>, source?: SourceRecord): ProjectSourceLink {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sourceId: String(row.source_id),
    activationStatus: row.activation_status as ProjectSourceLink["activationStatus"],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    source
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

  async listSources(userId: string, filters: SourceSearchInput): Promise<SourceRecord[]> {
    const values: unknown[] = [userId];
    const clauses = ["s.owner_user_id = $1"];
    if (filters.scope) {
      values.push(filters.scope);
      clauses.push(`s.scope = $${values.length}`);
    }
    if (filters.sourceType) {
      values.push(filters.sourceType);
      clauses.push(`s.source_type = $${values.length}`);
    }
    if (filters.authorityClassification) {
      values.push(filters.authorityClassification);
      clauses.push(`s.authority_classification = $${values.length}`);
    }
    if (filters.projectId) {
      values.push(filters.projectId);
      clauses.push(`(s.project_id = $${values.length} OR EXISTS (SELECT 1 FROM project_sources ps WHERE ps.source_id = s.id AND ps.project_id = $${values.length}))`);
    }
    if (filters.activeOnly) {
      clauses.push("EXISTS (SELECT 1 FROM project_sources ps WHERE ps.source_id = s.id AND ps.activation_status = 'active')");
    }
    if (filters.q) {
      values.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(`(lower(s.title) LIKE $${values.length} OR lower(coalesce(s.original_filename, '')) LIKE $${values.length} OR EXISTS (SELECT 1 FROM source_chunks sc WHERE sc.source_id = s.id AND lower(sc.text) LIKE $${values.length}))`);
    }
    const result = await this.pool.query(`SELECT s.* FROM sources s WHERE ${clauses.join(" AND ")} ORDER BY s.created_at DESC`, values);
    return result.rows.map(mapSource);
  }

  async createSource(
    userId: string,
    input: Omit<SourceRecord, "ownerUserId" | "createdAt" | "updatedAt" | "uploadedAt">
  ): Promise<SourceRecord> {
    const result = await this.pool.query(
      `INSERT INTO sources
       (id, owner_user_id, title, original_filename, mime_type, source_type, scope, project_id,
        authority_classification, user_confirmed_classification, ai_suggested_classification,
        storage_key, original_url, size_bytes, processing_status, extraction_status,
        extraction_version, failure_reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        input.id,
        userId,
        input.title,
        input.originalFilename,
        input.mimeType,
        input.sourceType,
        input.scope,
        input.projectId,
        input.authorityClassification,
        input.userConfirmedClassification,
        input.aiSuggestedClassification,
        input.storageKey,
        input.originalUrl,
        input.sizeBytes,
        input.processingStatus,
        input.extractionStatus,
        input.extractionVersion,
        input.failureReason,
        input.metadata
      ]
    );
    const source = mapSource(result.rows[0]);
    if (source.projectId) {
      try {
        await this.associateSourceToProject(userId, source.projectId, { sourceId: source.id, activationStatus: "associated" });
      } catch (error) {
        if (!(error instanceof DuplicateProjectSourceError)) throw error;
      }
    }
    return source;
  }

  async updateSourceProcessing(
    userId: string,
    sourceId: string,
    input: Pick<SourceRecord, "processingStatus" | "extractionStatus" | "extractionVersion" | "failureReason" | "metadata">
  ): Promise<SourceRecord> {
    const result = await this.pool.query(
      `UPDATE sources
       SET processing_status = $3, extraction_status = $4, extraction_version = $5,
           failure_reason = $6, metadata = $7, updated_at = now()
       WHERE owner_user_id = $1 AND id = $2
       RETURNING *`,
      [userId, sourceId, input.processingStatus, input.extractionStatus, input.extractionVersion, input.failureReason, input.metadata]
    );
    if (!result.rows[0]) throw new Error("Source not found");
    return mapSource(result.rows[0]);
  }

  async updateSource(userId: string, sourceId: string, input: SourceUpdateInput): Promise<SourceRecord | null> {
    const current = await this.getSource(userId, sourceId);
    if (!current) return null;
    const result = await this.pool.query(
      `UPDATE sources
       SET title = $3, authority_classification = $4, user_confirmed_classification = $5, updated_at = now()
       WHERE owner_user_id = $1 AND id = $2
       RETURNING *`,
      [
        userId,
        sourceId,
        input.title ?? current.title,
        input.authorityClassification ?? current.authorityClassification,
        input.userConfirmedClassification ?? current.userConfirmedClassification
      ]
    );
    return result.rows[0] ? mapSource(result.rows[0]) : null;
  }

  async getSource(userId: string, sourceId: string): Promise<SourceDetail | null> {
    const result = await this.pool.query("SELECT * FROM sources WHERE owner_user_id = $1 AND id = $2", [userId, sourceId]);
    if (!result.rows[0]) return null;
    const source = mapSource(result.rows[0]);
    const chunks = await this.pool.query("SELECT * FROM source_chunks WHERE source_id = $1 ORDER BY chunk_index", [sourceId]);
    const links = await this.pool.query("SELECT * FROM project_sources WHERE source_id = $1 ORDER BY created_at DESC", [sourceId]);
    return { ...source, chunks: chunks.rows.map(mapChunk), projectLinks: links.rows.map((row) => mapProjectSource(row, source)) };
  }

  async addSourceChunks(userId: string, sourceId: string, chunks: SourceChunk[]): Promise<void> {
    if (!(await this.getSource(userId, sourceId))) throw new Error("Source not found");
    await this.pool.query("DELETE FROM source_chunks WHERE source_id = $1", [sourceId]);
    for (const chunk of chunks) {
      await this.pool.query(
        `INSERT INTO source_chunks (id, source_id, chunk_index, text, location_label, citation)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [chunk.id, sourceId, chunk.chunkIndex, chunk.text, chunk.locationLabel, chunk.citation]
      );
    }
  }

  async associateSourceToProject(userId: string, projectId: string, input: ProjectSourceInput): Promise<ProjectSourceLink> {
    if (!(await this.getProject(userId, projectId))) throw new Error("Project not found");
    const source = await this.getSource(userId, input.sourceId);
    if (!source) throw new Error("Source not found");
    try {
      const result = await this.pool.query(
        `INSERT INTO project_sources (project_id, source_id, activation_status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [projectId, input.sourceId, input.activationStatus]
      );
      return mapProjectSource(result.rows[0], source);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DuplicateProjectSourceError();
      throw error;
    }
  }

  async listProjectSources(userId: string, projectId: string): Promise<ProjectSourceLink[]> {
    if (!(await this.getProject(userId, projectId))) return [];
    const result = await this.pool.query(
      `SELECT ps.*, s.id AS s_id, s.owner_user_id, s.title, s.original_filename, s.mime_type, s.source_type, s.scope,
              s.project_id, s.authority_classification, s.user_confirmed_classification, s.ai_suggested_classification,
              s.storage_key, s.original_url, s.size_bytes, s.processing_status, s.extraction_status,
              s.extraction_version, s.failure_reason, s.metadata, s.uploaded_at, s.created_at AS s_created_at,
              s.updated_at AS s_updated_at
       FROM project_sources ps
       JOIN sources s ON s.id = ps.source_id
       WHERE ps.project_id = $1 AND s.owner_user_id = $2
       ORDER BY ps.created_at DESC`,
      [projectId, userId]
    );
    return result.rows.map((row) => mapProjectSource(row, mapSource({
      id: row.s_id,
      owner_user_id: row.owner_user_id,
      title: row.title,
      original_filename: row.original_filename,
      mime_type: row.mime_type,
      source_type: row.source_type,
      scope: row.scope,
      project_id: row.project_id,
      authority_classification: row.authority_classification,
      user_confirmed_classification: row.user_confirmed_classification,
      ai_suggested_classification: row.ai_suggested_classification,
      storage_key: row.storage_key,
      original_url: row.original_url,
      size_bytes: row.size_bytes,
      processing_status: row.processing_status,
      extraction_status: row.extraction_status,
      extraction_version: row.extraction_version,
      failure_reason: row.failure_reason,
      metadata: row.metadata,
      uploaded_at: row.uploaded_at,
      created_at: row.s_created_at,
      updated_at: row.s_updated_at
    })));
  }

  async updateProjectSourceActivation(
    userId: string,
    projectId: string,
    sourceId: string,
    input: ProjectSourceActivationInput
  ): Promise<ProjectSourceLink | null> {
    if (!(await this.getProject(userId, projectId))) return null;
    const result = await this.pool.query(
      `UPDATE project_sources
       SET activation_status = $3, updated_at = now()
       WHERE project_id = $1 AND source_id = $2
       RETURNING *`,
      [projectId, sourceId, input.activationStatus]
    );
    if (!result.rows[0]) return null;
    const source = await this.getSource(userId, sourceId);
    return mapProjectSource(result.rows[0], source ?? undefined);
  }

  async removeSourceFromProject(userId: string, projectId: string, sourceId: string): Promise<void> {
    if (!(await this.getProject(userId, projectId))) return;
    await this.pool.query("DELETE FROM project_sources WHERE project_id = $1 AND source_id = $2", [projectId, sourceId]);
  }

  async searchSourceChunks(userId: string, filters: SourceSearchInput): Promise<SourceChunk[]> {
    const sources = await this.listSources(userId, { ...filters, q: undefined });
    if (sources.length === 0) return [];
    const sourceIds = sources.map((source) => source.id);
    const values: unknown[] = [sourceIds];
    const clauses = ["source_id = ANY($1::uuid[])"];
    if (filters.q) {
      values.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(`lower(text) LIKE $${values.length}`);
    }
    const result = await this.pool.query(`SELECT * FROM source_chunks WHERE ${clauses.join(" AND ")} ORDER BY source_id, chunk_index LIMIT 50`, values);
    return result.rows.map(mapChunk);
  }
}
