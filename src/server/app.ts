import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse, serialize } from "cookie";
import { ZodError, type ZodSchema } from "zod";
import {
  contractorCreateSchema,
  engagementCreateSchema,
  loginSchema,
  projectCreateSchema,
  type UserSummary
} from "../shared/contracts";
import { createSessionToken, hashPassword, hashSessionToken, hoursFromNow, verifyPassword } from "./security";
import { DuplicateEngagementError, type AppStore, type StoredUser } from "./store";

const sessionCookie = "pi_session";

export interface AppOptions {
  store: AppStore;
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
      if (error instanceof Error && (error.message === "Project not found" || error.message === "Contractor not found")) {
        sendJson(res, 404, { error: error.message });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: "Unexpected server error" });
    }
  });
}
