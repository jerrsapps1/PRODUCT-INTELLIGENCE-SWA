import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse, serialize } from "cookie";
import { ZodError, type ZodSchema } from "zod";
import {
  contractorCreateSchema,
  engagementCreateSchema,
  loginSchema,
  projectSourceActivationSchema,
  projectSourceSchema,
  projectCreateSchema,
  sourceMetadataSchema,
  sourceSearchSchema,
  sourceUpdateSchema,
  urlSourceCreateSchema,
  type UserSummary
} from "../shared/contracts";
import { extractSource, materializeChunks } from "./extraction";
import { createSessionToken, hashPassword, hashSessionToken, hoursFromNow, verifyPassword } from "./security";
import { isAllowedFile, maxUploadBytes, sourceCapabilities } from "./sourceCapabilities";
import { MemoryObjectStorage, type ObjectStorage } from "./storage";
import { DuplicateEngagementError, DuplicateProjectSourceError, type AppStore, type StoredUser } from "./store";
import { readMultipart } from "./upload";
import { retrieveUrlText } from "./urlSafety";

const sessionCookie = "pi_session";

export interface AppOptions {
  store: AppStore;
  storage?: ObjectStorage;
  bootstrapEmail: string;
  bootstrapPassword: string;
  bootstrapDisplayName: string;
  secureCookies?: boolean;
}

interface AuthedRequest {
  req: IncomingMessage;
  user: StoredUser;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(statusCode, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function sendNoContent(res: ServerResponse, headers: Record<string, string> = {}) {
  res.writeHead(204, headers);
  res.end();
}

async function readJson<T>(req: IncomingMessage, schema: ZodSchema<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return schema.parse(raw ? JSON.parse(raw) : {});
}

function publicUser(user: StoredUser): UserSummary {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

function cookieHeader(token: string, secureCookies: boolean, maxAgeSeconds = 60 * 60 * 24 * 7): string {
  return serialize(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: maxAgeSeconds
  });
}

async function getAuthed(req: IncomingMessage, store: AppStore): Promise<StoredUser | null> {
  const token = parse(req.headers.cookie ?? "")[sessionCookie];
  if (!token) return null;
  return store.findUserBySessionTokenHash(hashSessionToken(token));
}

function routeParts(req: IncomingMessage): string[] {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.split("/").filter(Boolean);
}

export async function createApp(options: AppOptions) {
  const { store } = options;
  const storage = options.storage ?? new MemoryObjectStorage();
  await store.migrate();
  await store.ensureBootstrapUser({
    email: options.bootstrapEmail,
    displayName: options.bootstrapDisplayName,
    passwordHash: hashPassword(options.bootstrapPassword)
  });

  async function requireAuth(req: IncomingMessage, res: ServerResponse): Promise<AuthedRequest | null> {
    const user = await getAuthed(req, store);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required" });
      return null;
    }
    return { req, user };
  }

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const parts = routeParts(req);

      if (method === "GET" && parts.join("/") === "api/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/source-capabilities") {
        sendJson(res, 200, { capabilities: sourceCapabilities, maxUploadBytes });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/auth/login") {
        const input = await readJson(req, loginSchema);
        const user = await store.findUserByEmail(input.email);
        if (!user || !verifyPassword(input.password, user.passwordHash)) {
          sendJson(res, 401, { error: "Invalid email or password" });
          return;
        }
        const token = createSessionToken();
        await store.createSession(user.id, hashSessionToken(token), hoursFromNow(24 * 7));
        sendJson(res, 200, { user: publicUser(user) }, { "set-cookie": cookieHeader(token, Boolean(options.secureCookies)) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/auth/logout") {
        const token = parse(req.headers.cookie ?? "")[sessionCookie];
        if (token) await store.deleteSession(hashSessionToken(token));
        sendNoContent(res, { "set-cookie": cookieHeader("", Boolean(options.secureCookies), 0) });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/auth/session") {
        const user = await getAuthed(req, store);
        if (!user) {
          sendJson(res, 200, { user: null });
          return;
        }
        sendJson(res, 200, { user: publicUser(user) });
        return;
      }

      const authed = await requireAuth(req, res);
      if (!authed) return;
      const userId = authed.user.id;
      const url = new URL(req.url ?? "/", "http://localhost");

      if (method === "GET" && parts.join("/") === "api/projects") {
        sendJson(res, 200, { projects: await store.listProjects(userId) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/projects") {
        const input = await readJson(req, projectCreateSchema);
        sendJson(res, 201, { project: await store.createProject(userId, input) });
        return;
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "projects" && parts.length === 3) {
        const project = await store.getProject(userId, parts[2]);
        if (!project) sendJson(res, 404, { error: "Project not found" });
        else sendJson(res, 200, { project });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/contractors") {
        sendJson(res, 200, { contractors: await store.listContractors(userId) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/contractors") {
        const input = await readJson(req, contractorCreateSchema);
        sendJson(res, 201, { contractor: await store.createContractor(userId, input) });
        return;
      }

      if (parts[0] === "api" && parts[1] === "projects" && parts[3] === "contractors") {
        const projectId = parts[2];
        if (method === "GET" && parts.length === 4) {
          if (!(await store.getProject(userId, projectId))) {
            sendJson(res, 404, { error: "Project not found" });
            return;
          }
          sendJson(res, 200, { engagements: await store.listProjectEngagements(userId, projectId) });
          return;
        }
        if (method === "POST" && parts.length === 4) {
          const input = await readJson(req, engagementCreateSchema);
          sendJson(res, 201, { engagement: await store.createProjectEngagement(userId, projectId, input) });
          return;
        }
        if (method === "GET" && parts.length === 5) {
          const engagement = await store.getProjectEngagement(userId, projectId, parts[4]);
          if (!engagement) sendJson(res, 404, { error: "Contractor engagement not found" });
          else sendJson(res, 200, { engagement });
          return;
        }
      }

      if (method === "GET" && parts.join("/") === "api/sources") {
        const filters = sourceSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
        sendJson(res, 200, { sources: await store.listSources(userId, filters) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/sources/upload") {
        const form = await readMultipart(req, maxUploadBytes + 1024 * 1024);
        const metadata = sourceMetadataSchema.parse(form.fields);
        if (form.files.length === 0) {
          sendJson(res, 400, { error: "At least one file is required" });
          return;
        }
        if (metadata.projectId && !(await store.getProject(userId, metadata.projectId))) {
          sendJson(res, 404, { error: "Project not found" });
          return;
        }
        const created = [];
        for (const file of form.files) {
          const allowed = isAllowedFile(file.filename, file.mimeType, file.buffer.byteLength);
          if (!allowed.ok) {
            sendJson(res, 400, { error: allowed.reason });
            return;
          }
          const sourceId = randomUUID();
          const stored = await storage.put(file.buffer, { ownerUserId: userId, sourceId, originalFilename: file.filename });
          let source = await store.createSource(userId, {
            id: sourceId,
            title: metadata.title || file.filename,
            originalFilename: file.filename,
            mimeType: file.mimeType,
            sourceType: allowed.sourceType,
            scope: metadata.scope,
            projectId: metadata.projectId || null,
            authorityClassification: metadata.authorityClassification,
            userConfirmedClassification: metadata.userConfirmedClassification,
            aiSuggestedClassification: null,
            storageKey: stored.key,
            originalUrl: null,
            sizeBytes: stored.sizeBytes,
            processingStatus: "processing",
            extractionStatus: "processing",
            extractionVersion: null,
            failureReason: null,
            metadata: { storageLabel: storage.publicLabel(stored.key) }
          });
          const extraction = await extractSource({ sourceId, sourceType: allowed.sourceType, mimeType: file.mimeType, buffer: file.buffer });
          await store.addSourceChunks(userId, sourceId, materializeChunks(sourceId, extraction));
          source = await store.updateSourceProcessing(userId, sourceId, {
            processingStatus: extraction.status,
            extractionStatus: extraction.status,
            extractionVersion: extraction.extractionVersion,
            failureReason: extraction.failureReason,
            metadata: { ...source.metadata, ...extraction.metadata }
          });
          created.push(source);
        }
        sendJson(res, 201, { sources: created });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/sources/url") {
        const input = await readJson(req, urlSourceCreateSchema);
        if (input.projectId && !(await store.getProject(userId, input.projectId))) {
          sendJson(res, 404, { error: "Project not found" });
          return;
        }
        const retrieved = await retrieveUrlText(input.url);
        const sourceId = randomUUID();
        let source = await store.createSource(userId, {
          id: sourceId,
          title: input.title || retrieved.title || input.url,
          originalFilename: null,
          mimeType: "text/html",
          sourceType: "url",
          scope: input.scope,
          projectId: input.projectId || null,
          authorityClassification: input.authorityClassification,
          userConfirmedClassification: input.userConfirmedClassification ?? false,
          aiSuggestedClassification: null,
          storageKey: null,
          originalUrl: retrieved.finalUrl,
          sizeBytes: Buffer.byteLength(retrieved.text),
          processingStatus: "processing",
          extractionStatus: "processing",
          extractionVersion: null,
          failureReason: null,
          metadata: retrieved.metadata
        });
        const extraction = await extractSource({ sourceId, sourceType: "url", mimeType: "text/html", text: retrieved.text, url: retrieved.finalUrl });
        await store.addSourceChunks(userId, sourceId, materializeChunks(sourceId, extraction));
        source = await store.updateSourceProcessing(userId, sourceId, {
          processingStatus: extraction.status,
          extractionStatus: extraction.status,
          extractionVersion: extraction.extractionVersion,
          failureReason: extraction.failureReason,
          metadata: { ...source.metadata, ...extraction.metadata }
        });
        sendJson(res, 201, { source });
        return;
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "sources" && parts.length === 3) {
        const source = await store.getSource(userId, parts[2]);
        if (!source) sendJson(res, 404, { error: "Source not found" });
        else sendJson(res, 200, { source });
        return;
      }

      if (method === "PATCH" && parts[0] === "api" && parts[1] === "sources" && parts.length === 3) {
        const source = await store.updateSource(userId, parts[2], await readJson(req, sourceUpdateSchema));
        if (!source) sendJson(res, 404, { error: "Source not found" });
        else sendJson(res, 200, { source });
        return;
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "sources" && parts[3] === "original") {
        const source = await store.getSource(userId, parts[2]);
        if (!source || !source.storageKey) {
          sendJson(res, 404, { error: "Original file not found" });
          return;
        }
        const original = await storage.get(source.storageKey);
        res.writeHead(200, {
          "content-type": source.mimeType,
          "content-length": String(original.byteLength),
          "content-disposition": `attachment; filename="${(source.originalFilename ?? "source").replace(/"/g, "")}"`
        });
        res.end(original);
        return;
      }

      if (method === "GET" && parts.join("/") === "api/source-chunks") {
        const filters = sourceSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
        sendJson(res, 200, { chunks: await store.searchSourceChunks(userId, filters) });
        return;
      }

      if (parts[0] === "api" && parts[1] === "projects" && parts[3] === "sources") {
        const projectId = parts[2];
        if (method === "GET" && parts.length === 4) {
          if (!(await store.getProject(userId, projectId))) {
            sendJson(res, 404, { error: "Project not found" });
            return;
          }
          sendJson(res, 200, { projectSources: await store.listProjectSources(userId, projectId) });
          return;
        }
        if (method === "POST" && parts.length === 4) {
          const link = await store.associateSourceToProject(userId, projectId, await readJson(req, projectSourceSchema));
          sendJson(res, 201, { projectSource: link });
          return;
        }
        if (method === "PATCH" && parts.length === 5) {
          const link = await store.updateProjectSourceActivation(userId, projectId, parts[4], await readJson(req, projectSourceActivationSchema));
          if (!link) sendJson(res, 404, { error: "Project source not found" });
          else sendJson(res, 200, { projectSource: link });
          return;
        }
        if (method === "DELETE" && parts.length === 5) {
          await store.removeSourceFromProject(userId, projectId, parts[4]);
          sendNoContent(res);
          return;
        }
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof ZodError) {
        sendJson(res, 400, { error: "Validation failed", details: error.flatten() });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }
      if (error instanceof DuplicateEngagementError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof DuplicateProjectSourceError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof Error && (error.message === "Project not found" || error.message === "Contractor not found" || error.message === "Source not found")) {
        sendJson(res, 404, { error: error.message });
        return;
      }
      if (error instanceof Error && (error.message.toLowerCase().includes("private network") || error.message.includes("Localhost") || error.message.includes("Only HTTP"))) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: "Unexpected server error" });
    }
  });
}
