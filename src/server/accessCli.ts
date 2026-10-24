/**
 * Sign-in lock (run on the computer hosting SWA):
 *   npm run access:lock [-- "reason"]   refuse all sign-ins and sign everyone out
 *   npm run access:unlock                allow sign-in again (everyone signs in afresh)
 *   npm run access:status                show whether sign-in is locked
 * Works whether or not the server is running; no data is changed.
 */
import { resolve } from "node:path";
import { lockAccess, readAccessLock, unlockAccess } from "./accessLock";
import { readConfig } from "./env";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "unknown time");

function main(): number {
  const path = resolve(process.cwd(), readConfig().accessLockFile);
  const command = process.argv[2] ?? "status";
  if (command === "lock") {
    const reason = process.argv.slice(3).join(" ").trim() || null;
    const state = lockAccess(path, reason);
    console.log(`Sign-in is now LOCKED (${when(state.lockedAt)}).`);
    console.log("Everyone is signed out: open browser tabs return to the sign-in screen within about 30 seconds,");
    console.log("and no one can sign in until you run Unlock SWA. The app keeps running and no data is changed.");
    return 0;
  }
  if (command === "unlock") {
    const before = readAccessLock(path);
    unlockAccess(path);
    console.log(before.locked ? "Sign-in is UNLOCKED. Accounts can sign in again with their passwords." : "Sign-in was not locked; nothing changed.");
    return 0;
  }
  if (command === "status") {
    const state = readAccessLock(path);
    console.log(
      state.locked
        ? `Sign-in is LOCKED since ${when(state.lockedAt)}${state.reason ? ` (${state.reason})` : ""}. Run Unlock SWA to allow sign-in.`
        : "Sign-in is unlocked."
    );
    return 0;
  }
  console.error("Usage: accessCli <lock [reason] | unlock | status>");
  return 1;
}

process.exitCode = main();
