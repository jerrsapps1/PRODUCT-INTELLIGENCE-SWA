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
});
