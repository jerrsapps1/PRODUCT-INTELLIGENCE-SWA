import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app";
import { MemoryStore } from "./db/memoryStore";

const credentials = { email: "owner@example.com", password: "correct-password" };

async function listen(): Promise<{ server: Server; baseUrl: string }> {
  const server = await createApp({
    store: new MemoryStore(),
    bootstrapEmail: credentials.email,
    bootstrapPassword: credentials.password,
    bootstrapDisplayName: "Test Owner"
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

describe("Phase 1 API", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const started = await listen();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("protects project records until login succeeds", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/projects`);
    expect(unauthenticated.status).toBe(401);

    const failedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: "wrong" })
    });
    expect(failedLogin.status).toBe(401);
  });

  it("creates and reopens a persisted blank project through the API", async () => {
    const cookie = await login();
    const createResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Courthouse Renovation",
        projectIdentifier: "CR-01",
        location: "Austin, TX",
        federalClassification: "Federal",
        description: "Blank project foundation",
        startDate: "2026-09-01"
      })
    });
    expect(createResponse.status).toBe(201);
    const created = await json<{ project: { id: string; name: string } }>(createResponse);

    const listResponse = await fetch(`${baseUrl}/api/projects`, { headers: { cookie } });
    expect(listResponse.status).toBe(200);
    const listed = await json<{ projects: Array<{ id: string; name: string }> }>(listResponse);
    expect(listed.projects).toContainEqual(expect.objectContaining({ id: created.project.id, name: "Courthouse Renovation" }));

    const reopenResponse = await fetch(`${baseUrl}/api/projects/${created.project.id}`, { headers: { cookie } });
    expect(reopenResponse.status).toBe(200);
  });

  it("creates contractor master records and project engagements without duplicating contractors", async () => {
    const cookie = await login();
    const project = await createProject(cookie, "Medical Office Buildout");
    const contractor = await createContractor(cookie, "Anchor Steel");

    const first = await fetch(`${baseUrl}/api/projects/${project.id}/contractors`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ contractorId: contractor.id, scopeSummary: "Structural steel" })
    });
    expect(first.status).toBe(201);

    const duplicate = await fetch(`${baseUrl}/api/projects/${project.id}/contractors`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ contractorId: contractor.id, scopeSummary: "Duplicate" })
    });
    expect(duplicate.status).toBe(409);

    const secondProject = await createProject(cookie, "Library Addition");
    const secondEngagement = await fetch(`${baseUrl}/api/projects/${secondProject.id}/contractors`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ contractorId: contractor.id, scopeSummary: "Misc metals" })
    });
    expect(secondEngagement.status).toBe(201);

    const contractors = await json<{ contractors: Array<{ id: string; legalName: string }> }>(
      await fetch(`${baseUrl}/api/contractors`, { headers: { cookie } })
    );
    expect(contractors.contractors.filter((item) => item.id === contractor.id)).toHaveLength(1);
  });

  it("rejects invalid project and engagement payloads", async () => {
    const cookie = await login();
    const invalidProject = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "", location: "", federalClassification: "Local" })
    });
    expect(invalidProject.status).toBe(400);

    const project = await createProject(cookie, "Parking Structure");
    const invalidEngagement = await fetch(`${baseUrl}/api/projects/${project.id}/contractors`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ scopeSummary: "No contractor selected" })
    });
    expect(invalidEngagement.status).toBe(400);
  });

  it("uploads, extracts, searches, and retrieves original text sources", async () => {
    const cookie = await login();
    const unauthenticated = await fetch(`${baseUrl}/api/sources/upload`, { method: "POST" });
    expect(unauthenticated.status).toBe(401);

    const upload = await uploadMultipart(cookie, {
      title: "OSHA notes",
      scope: "global",
      authorityClassification: "general_reference",
      userConfirmedClassification: "true"
    }, { filename: "osha-notes.txt", mimeType: "text/plain", content: "fall protection guardrail citation text" });
    expect(upload.status).toBe(201);
    const uploaded = await json<{ sources: Array<{ id: string; processingStatus: string; extractionStatus: string }> }>(upload);
    expect(uploaded.sources[0]).toEqual(expect.objectContaining({ processingStatus: "ready", extractionStatus: "ready" }));

    const search = await json<{ chunks: Array<{ sourceId: string; text: string; citation: Record<string, unknown> }> }>(
      await fetch(`${baseUrl}/api/source-chunks?q=guardrail`, { headers: { cookie } })
    );
    expect(search.chunks[0]).toEqual(expect.objectContaining({ sourceId: uploaded.sources[0].id }));
    expect(search.chunks[0].citation).toEqual(expect.objectContaining({ chunk: 1 }));

    const original = await fetch(`${baseUrl}/api/sources/${uploaded.sources[0].id}/original`, { headers: { cookie } });
    expect(original.status).toBe(200);
    expect(await original.text()).toContain("guardrail citation");
  });

  it("rejects unsupported files and preserves originals when extraction fails", async () => {
    const cookie = await login();
    const rejected = await uploadMultipart(cookie, {
      title: "Executable",
      scope: "global",
      authorityClassification: "general_reference"
    }, { filename: "tool.exe", mimeType: "application/x-msdownload", content: "nope" });
    expect(rejected.status).toBe(400);

    const uploaded = await uploadMultipart(cookie, {
      title: "Broken DOCX",
      scope: "global",
      authorityClassification: "working_document"
    }, {
      filename: "broken.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: "not a valid office zip"
    });
    expect(uploaded.status).toBe(201);
    const body = await json<{ sources: Array<{ id: string; processingStatus: string; failureReason: string | null }> }>(uploaded);
    expect(body.sources[0].processingStatus).toBe("failed");
    expect(body.sources[0].failureReason).toBeTruthy();
    const original = await fetch(`${baseUrl}/api/sources/${body.sources[0].id}/original`, { headers: { cookie } });
    expect(original.status).toBe(200);
    expect(await original.text()).toContain("not a valid office zip");
  });

  it("associates global sources to projects and controls activation without duplication", async () => {
    const cookie = await login();
    const project = await createProject(cookie, "Source Project");
    const source = await uploadTextSource(cookie, "EM 385-1-1", "global reference text");

    const associate = await fetch(`${baseUrl}/api/projects/${project.id}/sources`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceId: source.id, activationStatus: "associated" })
    });
    expect(associate.status).toBe(201);

    const duplicate = await fetch(`${baseUrl}/api/projects/${project.id}/sources`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceId: source.id, activationStatus: "active" })
    });
    expect(duplicate.status).toBe(409);

    const activate = await fetch(`${baseUrl}/api/projects/${project.id}/sources/${source.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ activationStatus: "active" })
    });
    expect(activate.status).toBe(200);

    const projectSources = await json<{ projectSources: Array<{ sourceId: string; activationStatus: string }> }>(
      await fetch(`${baseUrl}/api/projects/${project.id}/sources`, { headers: { cookie } })
    );
    expect(projectSources.projectSources).toContainEqual(expect.objectContaining({ sourceId: source.id, activationStatus: "active" }));

    const removed = await fetch(`${baseUrl}/api/projects/${project.id}/sources/${source.id}`, { method: "DELETE", headers: { cookie } });
    expect(removed.status).toBe(204);
    const stillExists = await fetch(`${baseUrl}/api/sources/${source.id}`, { headers: { cookie } });
    expect(stillExists.status).toBe(200);
  });

  it("rejects unsafe URL sources", async () => {
    const cookie = await login();
    const response = await fetch(`${baseUrl}/api/sources/url`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Local URL",
        scope: "global",
        authorityClassification: "general_reference",
        url: "http://127.0.0.1/internal"
      })
    });
    expect(response.status).toBe(400);
  });

  async function login(): Promise<string> {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials)
    });
    expect(loginResponse.status).toBe(200);
    const cookie = loginResponse.headers.get("set-cookie");
    expect(cookie).toContain("pi_session=");
    return cookie ?? "";
  }

  async function createProject(cookie: string, name: string): Promise<{ id: string }> {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name, location: "Dallas, TX", federalClassification: "Non-Federal" })
    });
    expect(response.status).toBe(201);
    const body = await json<{ project: { id: string } }>(response);
    return body.project;
  }

  async function createContractor(cookie: string, legalName: string): Promise<{ id: string }> {
    const response = await fetch(`${baseUrl}/api/contractors`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ legalName, trade: "Steel" })
    });
    expect(response.status).toBe(201);
    const body = await json<{ contractor: { id: string } }>(response);
    return body.contractor;
  }

  async function uploadTextSource(cookie: string, title: string, text: string): Promise<{ id: string }> {
    const response = await uploadMultipart(cookie, {
      title,
      scope: "global",
      authorityClassification: "general_reference"
    }, { filename: `${title}.txt`, mimeType: "text/plain", content: text });
    expect(response.status).toBe(201);
    const body = await json<{ sources: Array<{ id: string }> }>(response);
    return body.sources[0];
  }

  async function uploadMultipart(
    cookie: string,
    fields: Record<string, string>,
    file: { filename: string; mimeType: string; content: string }
  ): Promise<Response> {
    const boundary = `----phase2-${Math.random().toString(16).slice(2)}`;
    const chunks: string[] = [];
    for (const [name, value] of Object.entries(fields)) {
      chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
    }
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n${file.content}\r\n`
    );
    chunks.push(`--${boundary}--\r\n`);
    return fetch(`${baseUrl}/api/sources/upload`, {
      method: "POST",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      body: chunks.join("")
    });
  }
});
