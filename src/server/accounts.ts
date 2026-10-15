import { z } from "zod";
import { newPasswordSchema } from "../shared/contracts";
import { hashPassword } from "./security";
import { DuplicateAccountError, type AccountSummary, type AppStore } from "./store";

/**
 * Local account administration used by the `auth:*` commands (for someone with
 * access to this computer and its .env). None of this is exposed over HTTP.
 */

export type AccountResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const displayNameSchema = z.string().trim().min(1, "Enter a display name").max(80, "Use at most 80 characters for the display name");

/** The stored format produced by hashPassword: scrypt$<32 hex salt>$<128 hex key>. */
export function isPasswordHash(value: string): boolean {
  return /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(value);
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid value";
}

export async function createAccount(
  store: Pick<AppStore, "createUser">,
  input: { email: string; displayName: string; password: string }
): Promise<AccountResult<{ account: AccountSummary }>> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, reason: firstIssue(email.error) };
  const displayName = displayNameSchema.safeParse(input.displayName);
  if (!displayName.success) return { ok: false, reason: firstIssue(displayName.error) };
  const password = newPasswordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, reason: firstIssue(password.error) };
  try {
    const account = await store.createUser({ email: email.data, displayName: displayName.data, passwordHash: hashPassword(input.password) });
    return { ok: true, account };
  } catch (error) {
    if (error instanceof DuplicateAccountError) return { ok: false, reason: error.message };
    throw error;
  }
}

/** Sets a new password for an existing account and signs it out everywhere. Changes nothing else. */
export async function resetUserPassword(
  store: Pick<AppStore, "findUserByEmail" | "setUserPassword" | "deleteUserSessions">,
  email: string,
  newPassword: string
): Promise<AccountResult<{ email: string }>> {
  const parsed = newPasswordSchema.safeParse(newPassword);
  if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };
  const user = await store.findUserByEmail(email.trim());
  if (!user) return { ok: false, reason: `No account exists for ${email.trim().toLowerCase()}` };
  await store.setUserPassword(user.id, hashPassword(newPassword));
  await store.deleteUserSessions(user.id);
  return { ok: true, email: user.email };
}

/**
 * Replaces a plain-text BOOTSTRAP_PASSWORD line in .env content with
 * BOOTSTRAP_PASSWORD_HASH (same position; every other line untouched).
 * `newPassword` hashes that instead of the current value.
 */
export function hashBootstrapPasswordInEnv(
  envText: string,
  newPassword?: string
): AccountResult<{ text: string }> {
  const eol = envText.includes("\r\n") ? "\r\n" : "\n";
  const lines = envText.split(/\r?\n/);
  const keyOf = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return null;
    return trimmed.slice(0, trimmed.indexOf("=")).trim();
  };
  const valueOf = (line: string) => {
    let value = line.slice(line.indexOf("=") + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return value;
  };
  const plainIndex = lines.findIndex((line) => keyOf(line) === "BOOTSTRAP_PASSWORD");
  const plain = plainIndex >= 0 ? valueOf(lines[plainIndex]!) : "";
  const password = newPassword ?? plain;
  if (!password) {
    return lines.some((line) => keyOf(line) === "BOOTSTRAP_PASSWORD_HASH")
      ? { ok: false, reason: "The .env password is already stored as a hash (BOOTSTRAP_PASSWORD_HASH)" }
      : { ok: false, reason: "No BOOTSTRAP_PASSWORD found in .env" };
  }
  const hashLine = `BOOTSTRAP_PASSWORD_HASH=${hashPassword(password)}`;
  const kept = lines.filter((line, index) => index === plainIndex || keyOf(line) !== "BOOTSTRAP_PASSWORD_HASH");
  const at = kept.findIndex((line) => keyOf(line) === "BOOTSTRAP_PASSWORD");
  if (at >= 0) kept[at] = hashLine;
  else {
    while (kept.length && kept[kept.length - 1] === "") kept.pop();
    kept.push(hashLine, "");
  }
  return { ok: true, text: kept.join(eol) };
}
