import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app";
import { MemoryStore } from "./db/memoryStore";
import { resetUserPassword } from "./passwordReset";

const email = "owner@example.com";
const original = "correct-password";

describe("password change and local reset", () => {
  let server: Server;
  let baseUrl: string;
  let store: MemoryStore;

  beforeEach(async () => {
    store = new MemoryStore();
    server = await createApp({ store, bootstrapEmail: email, bootstrapPassword: original, bootstrapDisplayName: "Test Owner" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  async function login(password: string): Promise<{ status: number; cookie: string }> {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return { status: response.status, cookie: response.headers.get("set-cookie") ?? "" };
  }

  async function sessionUser(cookie: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } });
    return ((await response.json()) as { user: unknown }).user;
  }

  function changePassword(cookie: string, body: unknown) {
    return fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body)
    });
  }

  it("changes the password when signed in, keeps this session and signs out the others", async () => {
    const here = await login(original);
    const elsewhere = await login(original);

    const response = await changePassword(here.cookie, { currentPassword: original, newPassword: "a-new-password-123" });
    expect(response.status).toBe(204);

    expect(await sessionUser(here.cookie)).toMatchObject({ email });
    expect(await sessionUser(elsewhere.cookie)).toBeNull();
    expect((await login(original)).status).toBe(401);
    expect((await login("a-new-password-123")).status).toBe(200);
  });

  it("requires the current password, a long-enough new one, and a session", async () => {
    const { cookie } = await login(original);
    expect((await changePassword(cookie, { currentPassword: "wrong-password", newPassword: "a-new-password-123" })).status).toBe(400);
    expect((await changePassword(cookie, { currentPassword: original, newPassword: "short" })).status).toBe(400);
    expect((await changePassword("", { currentPassword: original, newPassword: "a-new-password-123" })).status).toBe(401);
    expect((await login(original)).status).toBe(200);
  });

  it("resets a forgotten password locally, signing the account out everywhere", async () => {
    const { cookie } = await login(original);
    const result = await resetUserPassword(store, " Owner@Example.com ", "reset-password-456");
    expect(result).toEqual({ ok: true, email });
    expect(await sessionUser(cookie)).toBeNull();
    expect((await login(original)).status).toBe(401);
    expect((await login("reset-password-456")).status).toBe(200);
  });

  it("refuses unknown accounts and short passwords without changing anything", async () => {
    expect(await resetUserPassword(store, "nobody@example.com", "reset-password-456")).toMatchObject({ ok: false, reason: "No account exists for nobody@example.com" });
    expect(await resetUserPassword(store, email, "short")).toMatchObject({ ok: false, reason: "Use at least 10 characters" });
    expect((await login(original)).status).toBe(200);
  });

  it("restarting with a different BOOTSTRAP_PASSWORD does not change an existing account's password", async () => {
    await resetUserPassword(store, email, "reset-password-456");
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    server = await createApp({ store, bootstrapEmail: email, bootstrapPassword: "something-else-entirely", bootstrapDisplayName: "Test Owner" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    baseUrl = `http://127.0.0.1:${address.port}`;
    expect((await login("something-else-entirely")).status).toBe(401);
    expect((await login("reset-password-456")).status).toBe(200);
  });
});
