import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AppStore } from "./store";

/**
 * Sign-in lock, controlled from the computer running SWA (the "Lock SWA" /
 * "Unlock SWA" shortcuts, `npm run access:lock|unlock|status`). The state is a
 * small JSON file, so it works whether or not the server is running.
 *
 *   locked             every sign-in is refused and every session is treated as
 *                      signed out; the app keeps running and no data changes.
 *   lockedAt           when the latest lock was applied.
 *   sessionsClearedFor the lockedAt for which the server already deleted all
 *                      sessions. Locking always ends existing sessions, even if
 *                      the server was stopped while locked and unlocked.
 */
export interface AccessLockState {
  locked: boolean;
  lockedAt: string | null;
  unlockedAt: string | null;
  reason: string | null;
  sessionsClearedFor: string | null;
}

export const UNLOCKED: AccessLockState = { locked: false, lockedAt: null, unlockedAt: null, reason: null, sessionsClearedFor: null };

export const LOCKED_MESSAGE = "Sign-in is locked on this computer. Use the Unlock SWA shortcut to allow sign-in again.";

export function readAccessLock(path: string): AccessLockState {
  if (!existsSync(path)) return { ...UNLOCKED };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<AccessLockState>;
    return {
      locked: raw.locked === true,
      lockedAt: typeof raw.lockedAt === "string" ? raw.lockedAt : null,
      unlockedAt: typeof raw.unlockedAt === "string" ? raw.unlockedAt : null,
      reason: typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 200) : null,
      sessionsClearedFor: typeof raw.sessionsClearedFor === "string" ? raw.sessionsClearedFor : null
    };
  } catch {
    // An unreadable lock file fails closed: treat it as locked rather than silently open.
    return { ...UNLOCKED, locked: true, reason: "The lock file could not be read" };
  }
}

export function writeAccessLock(path: string, state: AccessLockState): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}

export function lockAccess(path: string, reason: string | null, now = new Date()): AccessLockState {
  const current = readAccessLock(path);
  const state: AccessLockState = { ...current, locked: true, lockedAt: now.toISOString(), unlockedAt: null, reason: reason?.trim() || null };
  writeAccessLock(path, state);
  return state;
}

export function unlockAccess(path: string, now = new Date()): AccessLockState {
  const current = readAccessLock(path);
  const state: AccessLockState = { ...current, locked: false, unlockedAt: now.toISOString(), reason: null };
  writeAccessLock(path, state);
  return state;
}

/** Server-side view of the lock: reads the file and ends all sessions once per lock. */
export class AccessLock {
  constructor(
    private readonly path: string,
    private readonly store: Pick<AppStore, "deleteAllSessions">
  ) {}

  /** True while sign-in is locked. */
  async check(): Promise<boolean> {
    const state = readAccessLock(this.path);
    if (state.lockedAt && state.sessionsClearedFor !== state.lockedAt) {
      await this.store.deleteAllSessions();
      // Re-read so a lock/unlock written meanwhile isn't overwritten.
      const latest = readAccessLock(this.path);
      if (latest.lockedAt === state.lockedAt && existsSync(this.path)) {
        writeAccessLock(this.path, { ...latest, sessionsClearedFor: state.lockedAt });
      }
    }
    return state.locked;
  }
}
