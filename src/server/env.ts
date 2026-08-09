export interface ServerConfig {
  port: number;
  databaseUrl?: string;
  bootstrapEmail: string;
  bootstrapPassword: string;
  bootstrapDisplayName: string;
  sessionSecret: string;
  nodeEnv: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const bootstrapPassword = env.BOOTSTRAP_PASSWORD ?? "change-me-in-production";
  if (env.NODE_ENV === "production" && bootstrapPassword === "change-me-in-production") {
    throw new Error("BOOTSTRAP_PASSWORD must be set in production");
  }

  return {
    port: Number(env.PORT ?? 4174),
    databaseUrl: env.DATABASE_URL,
    bootstrapEmail: env.BOOTSTRAP_EMAIL ?? "owner@example.com",
    bootstrapPassword,
    bootstrapDisplayName: env.BOOTSTRAP_DISPLAY_NAME ?? "Safety Professional",
    sessionSecret: env.SESSION_SECRET ?? "development-session-secret",
    nodeEnv: env.NODE_ENV ?? "development"
  };
}
