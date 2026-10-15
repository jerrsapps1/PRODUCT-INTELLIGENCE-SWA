import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app";
import { MemoryStore } from "./db/memoryStore";
import { createAccount, hashBootstrapPasswordInEnv, isPasswordHash, resetUserPassword } from "./accounts";
import { readConfig } from "./env";
import { hashPassword, verifyPassword } from "./security";

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

describe("account utilities", () => {
  it("creates accounts with hashed passwords, refuses duplicates and bad input, and lists them", async () => {
    const store = new MemoryStore();
    const created = await createAccount(store, { email: " Field.Lead@Example.com ", displayName: "Field Lead", password: "field-lead-pass-1" });
    expect(created).toMatchObject({ ok: true, account: { email: "field.lead@example.com", displayName: "Field Lead" } });
    const stored = await store.findUserByEmail("field.lead@example.com");
    expect(stored!.passwordHash).not.toContain("field-lead-pass-1");
    expect(isPasswordHash(stored!.passwordHash)).toBe(true);
    expect(verifyPassword("field-lead-pass-1", stored!.passwordHash)).toBe(true);

    expect(await createAccount(store, { email: "FIELD.LEAD@example.com", displayName: "Again", password: "field-lead-pass-1" })).toEqual({ ok: false, reason: "An account already exists for field.lead@example.com" });
    expect(await createAccount(store, { email: "not-an-email", displayName: "X", password: "field-lead-pass-1" })).toEqual({ ok: false, reason: "Enter a valid email address" });
    expect(await createAccount(store, { email: "a@example.com", displayName: "  ", password: "field-lead-pass-1" })).toEqual({ ok: false, reason: "Enter a display name" });
    expect(await createAccount(store, { email: "a@example.com", displayName: "A", password: "short" })).toEqual({ ok: false, reason: "Use at least 10 characters" });
    expect((await store.listUsers()).map((u) => u.email)).toEqual(["field.lead@example.com"]);
  });

  it("a created account can sign in and starts with its own empty workspace", async () => {
    const store = new MemoryStore();
    const server = await createApp({ store, bootstrapEmail: email, bootstrapPassword: original, bootstrapDisplayName: "Owner" });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const base = `http://127.0.0.1:${address.port}`;
    const signIn = async (who: string, password: string) => {
      const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: who, password }) });
      return { status: response.status, cookie: response.headers.get("set-cookie") ?? "" };
    };
    const owner = await signIn(email, original);
    await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json", cookie: owner.cookie }, body: JSON.stringify({ name: "Owner project", federalClassification: "Federal" }) });

    await createAccount(store, { email: "second@example.com", displayName: "Second", password: "second-pass-123" });
    const second = await signIn("second@example.com", "second-pass-123");
    expect(second.status).toBe(200);
    const projects = (await (await fetch(`${base}/api/projects`, { headers: { cookie: second.cookie } })).json()) as { projects: unknown[] };
    expect(projects.projects).toEqual([]);
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("uses BOOTSTRAP_PASSWORD_HASH as-is so .env needs no plain-text password", async () => {
    const store = new MemoryStore();
    const hash = hashPassword("hashed-first-run-1");
    await createApp({ store, bootstrapEmail: email, bootstrapPassword: "ignored-when-hash-set", bootstrapPasswordHash: hash, bootstrapDisplayName: "Owner" });
    const user = await store.findUserByEmail(email);
    expect(user!.passwordHash).toBe(hash);
    expect(verifyPassword("hashed-first-run-1", user!.passwordHash)).toBe(true);
    expect(verifyPassword("ignored-when-hash-set", user!.passwordHash)).toBe(false);
  });

  it("reads BOOTSTRAP_PASSWORD_HASH from the environment and rejects a malformed one", () => {
    const hash = hashPassword("hashed-first-run-1");
    expect(readConfig({ BOOTSTRAP_PASSWORD_HASH: hash, DATABASE_URL: "postgres://x" }).bootstrapPasswordHash).toBe(hash);
    expect(() => readConfig({ BOOTSTRAP_PASSWORD_HASH: "not-a-hash" })).toThrow(/not a valid password hash/);
    expect(() => readConfig({ NODE_ENV: "production", BOOTSTRAP_PASSWORD_HASH: hash })).not.toThrow();
  });
});

describe("hashing the .env password", () => {
  const env = ["DATABASE_URL=postgres://u:p@127.0.0.1:55432/db", "BOOTSTRAP_EMAIL=me@example.com", 'BOOTSTRAP_PASSWORD="my plain password"', "SESSION_SECRET=s", ""].join("\r\n");

  it("replaces the plain-text line in place with a verifiable hash and keeps everything else", () => {
    const result = hashBootstrapPasswordInEnv(env);
    if (!result.ok) throw new Error(result.reason);
    const lines = result.text.split("\r\n");
    expect(lines[0]).toBe("DATABASE_URL=postgres://u:p@127.0.0.1:55432/db");
    expect(lines[1]).toBe("BOOTSTRAP_EMAIL=me@example.com");
    expect(lines[2]).toMatch(/^BOOTSTRAP_PASSWORD_HASH=scrypt\$/);
    expect(lines[3]).toBe("SESSION_SECRET=s");
    expect(result.text).not.toContain("my plain password");
    expect(result.text).not.toMatch(/^BOOTSTRAP_PASSWORD=/m);
    expect(verifyPassword("my plain password", lines[2]!.slice("BOOTSTRAP_PASSWORD_HASH=".length))).toBe(true);
  });

  it("reports an already-hashed .env, and can store a new password's hash instead", () => {
    const first = hashBootstrapPasswordInEnv(env);
    if (!first.ok) throw new Error(first.reason);
    expect(hashBootstrapPasswordInEnv(first.text)).toEqual({ ok: false, reason: "The .env password is already stored as a hash (BOOTSTRAP_PASSWORD_HASH)" });
    const replaced = hashBootstrapPasswordInEnv(first.text, "a-brand-new-one-2");
    if (!replaced.ok) throw new Error(replaced.reason);
    const hashLines = replaced.text.split("\r\n").filter((line) => line.startsWith("BOOTSTRAP_PASSWORD_HASH="));
    expect(hashLines).toHaveLength(1);
    expect(verifyPassword("a-brand-new-one-2", hashLines[0]!.slice("BOOTSTRAP_PASSWORD_HASH=".length))).toBe(true);
  });
});
