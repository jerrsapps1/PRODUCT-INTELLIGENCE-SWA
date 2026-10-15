import { newPasswordSchema } from "../shared/contracts";
import { hashPassword } from "./security";
import type { AppStore } from "./store";

export type PasswordResetResult = { ok: true; email: string } | { ok: false; reason: string };

/**
 * Sets a new password for an existing account and signs it out everywhere.
 * Used by the local `auth:reset-password` command (for someone with access to
 * this computer and its .env), never exposed over HTTP. Changes nothing else.
 */
export async function resetUserPassword(store: Pick<AppStore, "findUserByEmail" | "setUserPassword" | "deleteUserSessions">, email: string, newPassword: string): Promise<PasswordResetResult> {
  const parsed = newPasswordSchema.safeParse(newPassword);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid password" };
  const user = await store.findUserByEmail(email.trim());
  if (!user) return { ok: false, reason: `No account exists for ${email.trim().toLowerCase()}` };
  await store.setUserPassword(user.id, hashPassword(newPassword));
  await store.deleteUserSessions(user.id);
  return { ok: true, email: user.email };
}
