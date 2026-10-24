import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "./app";
import { MemoryStore } from "./db/memoryStore";
import { lockAccess, readAccessLock, unlockAccess } from "./accessLock";

const email = "owner@example.com";
const password = "correct-password";

describe("sign-in lock", () => {
  let dir: string;
  let lockFile: string;
  let store: MemoryStore;
  let server: Server | null = null;
  let baseUrl = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "swa-lock-"));
    lockFile = join(dir, ".data", "access-lock.json");
    store = new MemoryStore();
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
    server = null;
    rmSync(dir, { recursive: true, force: true });
  });

  async function start() {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
    server = await createApp({ store, bootstrapEmail: email, bootstrapPassword: password, bootstrapDisplayName: "Owner", accessLockFile: lockFile });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  const login = async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    return { status: response.status, body: (await response.json().catch(() => null)) as { error?: string } | null, cookie: response.headers.get("set-cookie") ?? "" };
  };
  const session = async (cookie = "") => (await (await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } })).json()) as { user: unknown; locked: boolean };
  const projects = async (cookie: string) => (await fetch(`${baseUrl}/api/projects`, { headers: { cookie } })).status;

  it("is unlocked by default", async () => {
    await start();
    expect(readAccessLock(lockFile).locked).toBe(false);
    expect((await login()).status).toBe(200);
    expect((await session()).locked).toBe(false);
  });

  it("locking signs everyone out and refuses sign-in; unlocking allows fresh sign-in only", async () => {
    await start();
    const before = await login();
    expect(await projects(before.cookie)).toBe(200);

    lockAccess(lockFile, "Out of office");
    expect(await projects(before.cookie)).toBe(423);
    expect(await session(before.cookie)).toEqual({ user: null, locked: true });
    const refused = await login();
    expect(refused.status).toBe(423);
    expect(refused.body?.error).toMatch(/Sign-in is locked/);
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);

    unlockAccess(lockFile);
    expect(await session(before.cookie)).toEqual({ user: null, locked: false }); // the old session stays ended
    expect(await projects(before.cookie)).toBe(401);
    const fresh = await login();
    expect(fresh.status).toBe(200);
    expect(await projects(fresh.cookie)).toBe(200);
    // Ending sessions happens once per lock, not on every request afterwards.
    expect(await projects(fresh.cookie)).toBe(200);
  });

  it("a lock applied and lifted while the server was stopped still ends old sessions", async () => {
    await start();
    const before = await login();
    await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
    server = null;
    lockAccess(lockFile, null);
    unlockAccess(lockFile);
    await start();
    expect(await projects(before.cookie)).toBe(401);
    expect((await login()).status).toBe(200);
  });

  it("an unreadable lock file fails closed", async () => {
    await start();
    lockAccess(lockFile, null);
    writeFileSync(lockFile, "{ not json", "utf8");
    expect(readAccessLock(lockFile).locked).toBe(true);
    expect((await login()).status).toBe(423);
  });
});
