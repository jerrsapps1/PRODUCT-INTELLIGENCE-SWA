/**
 * Local password reset: `npm run auth:reset-password` (or the "Reset SWA Password" shortcut).
 *
 * Reads DATABASE_URL and BOOTSTRAP_EMAIL from .env, asks for the account email
 * (default: BOOTSTRAP_EMAIL) and a new password twice, without echoing it, then
 * updates only that account's password and signs it out everywhere. Nothing is
 * printed except the account email and the outcome.
 */
import { createInterface } from "node:readline";
import { PostgresStore } from "./db/postgresStore";
import { readConfig } from "./env";
import { resetUserPassword } from "./passwordReset";

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Reads a line in raw mode without echoing anything that is typed. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    process.stdout.write(question);
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const done = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done();
        if (ch === "\u0003") return done(new Error("Cancelled"));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    input.on("data", onData);
  });
}

async function main(): Promise<number> {
  const config = readConfig();
  if (!config.databaseUrl) {
    console.error("DATABASE_URL is not set in .env or the environment.");
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error("Run this in an interactive terminal so the password can be typed without being shown.");
    return 1;
  }
  const emailAnswer = (await ask(`Account email [${config.bootstrapEmail}]: `)).trim();
  const email = emailAnswer || config.bootstrapEmail;
  const first = await askHidden("New password (at least 10 characters): ");
  const second = await askHidden("Type it again: ");
  if (first !== second) {
    console.error("The passwords didn't match. Nothing was changed.");
    return 1;
  }

  const store = new PostgresStore(config.databaseUrl);
  try {
    const result = await resetUserPassword(store, email, first);
    if (!result.ok) {
      console.error(`${result.reason}. Nothing was changed.`);
      return 1;
    }
    console.log(`Password reset for ${result.email}. Existing sessions were signed out.`);
    console.log("Sign in at http://127.0.0.1:5173/ with the new password. BOOTSTRAP_PASSWORD in .env is only used to create the account the first time.");
    return 0;
  } catch (error) {
    console.error(`Could not reach the database (${error instanceof Error ? error.message : "unknown error"}). Is SWA Local / Docker running? Nothing was changed.`);
    return 1;
  } finally {
    await store.close().catch(() => undefined);
  }
}

process.exitCode = await main();
