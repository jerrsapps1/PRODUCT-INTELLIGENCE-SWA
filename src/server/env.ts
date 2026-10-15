import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ServerConfig {
  port: number;
  databaseUrl?: string;
  bootstrapEmail: string;
  /** Plain-text first-run password (legacy / generated). Ignored when bootstrapPasswordHash is set. */
  bootstrapPassword: string;
  /** Preferred: the scrypt hash of the first-run password (BOOTSTRAP_PASSWORD_HASH), so .env holds no plain-text password. */
  bootstrapPasswordHash?: string;
  bootstrapDisplayName: string;
  sessionSecret: string;
  localStorageDir: string;
  nodeEnv: string;
}

let localEnvLoaded = false;

function loadLocalEnvFile(env: NodeJS.ProcessEnv = process.env): void {
  if (localEnvLoaded) return;
  localEnvLoaded = true;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsAt = trimmed.indexOf("=");
    if (equalsAt <= 0) continue;
    const key = trimmed.slice(0, equalsAt).trim();
    let value = trimmed.slice(equalsAt + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) env[key] = value;
  }
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  loadLocalEnvFile(env);

  const bootstrapPasswordHash = env.BOOTSTRAP_PASSWORD_HASH?.trim() || undefined;
  if (bootstrapPasswordHash && !/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(bootstrapPasswordHash)) {
    throw new Error("BOOTSTRAP_PASSWORD_HASH is not a valid password hash. Generate it with `npm run auth:secure-env`.");
  }
  const bootstrapPassword = env.BOOTSTRAP_PASSWORD ?? "change-me-in-production";
  if (env.NODE_ENV === "production" && !bootstrapPasswordHash && bootstrapPassword === "change-me-in-production") {
    throw new Error("BOOTSTRAP_PASSWORD_HASH (or BOOTSTRAP_PASSWORD) must be set in production");
  }

  return {
    port: Number(env.PORT ?? 4174),
    databaseUrl: env.DATABASE_URL,
    bootstrapEmail: env.BOOTSTRAP_EMAIL ?? "owner@example.com",
    bootstrapPassword,
    bootstrapPasswordHash,
    bootstrapDisplayName: env.BOOTSTRAP_DISPLAY_NAME ?? "Safety Professional",
    sessionSecret: env.SESSION_SECRET ?? "development-session-secret",
    localStorageDir: env.LOCAL_STORAGE_DIR ?? ".data/source-objects",
    nodeEnv: env.NODE_ENV ?? "development"
  };
}
