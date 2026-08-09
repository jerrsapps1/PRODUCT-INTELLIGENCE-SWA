import { createApp } from "./app";
import { PostgresStore } from "./db/postgresStore";
import { readConfig } from "./env";

const config = readConfig();

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for the API server");
}

const server = await createApp({
  store: new PostgresStore(config.databaseUrl),
  bootstrapEmail: config.bootstrapEmail,
  bootstrapPassword: config.bootstrapPassword,
  bootstrapDisplayName: config.bootstrapDisplayName,
  secureCookies: config.nodeEnv === "production"
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Project Intelligence API listening on ${config.port}`);
});
