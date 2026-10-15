/**
 * Local account utility (run on the computer hosting SWA; never over the web).
 *
 *   npm run auth:accounts         list accounts (email, display name, created)
 *   npm run auth:create-account   create an account (asks for email, name, password)
 *   npm run auth:reset-password   reset a forgotten password (signs that account out everywhere)
 *   npm run auth:secure-env       replace the plain-text BOOTSTRAP_PASSWORD in .env with BOOTSTRAP_PASSWORD_HASH
 *
 * Passwords are typed without being shown and are stored only as scrypt hashes.
 * Nothing secret is ever printed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { createAccount, hashBootstrapPasswordInEnv, resetUserPassword } from "./accounts";
import { PostgresStore } from "./db/postgresStore";
import { readConfig } from "./env";
import { MIN_PASSWORD_LENGTH } from "../shared/passwordPolicy";

function ask(question: string): Promise<string> {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      done(answer);
    });
  });
}

/** Reads a line in raw mode without echoing anything that is typed. */
function askHidden(question: string): Promise<string> {
  return new Promise((done, fail) => {
    const input = process.stdin;
    process.stdout.write(question);
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const finish = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) fail(error);
      else done(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish();
        if (ch === "\u0003") return finish(new Error("Cancelled"));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    input.on("data", onData);
  });
}

async function askNewPassword(): Promise<string | null> {
  const first = await askHidden(`New password (at least ${MIN_PASSWORD_LENGTH} characters, not shown): `);
  const second = await askHidden("Type it again: ");
  if (first !== second) {
    console.error("The passwords didn't match. Nothing was changed.");
    return null;
  }
  return first;
}

async function withStore<T>(run: (store: PostgresStore) => Promise<T>): Promise<T> {
  const config = readConfig();
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not set in .env or the environment.");
  const store = new PostgresStore(config.databaseUrl);
  try {
    await store.migrate();
    return await run(store);
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function listCommand(): Promise<number> {
  const accounts = await withStore((store) => store.listUsers());
  if (!accounts.length) {
    console.log("No accounts yet. Create one with: npm run auth:create-account");
    return 0;
  }
  console.log(`${accounts.length} account${accounts.length === 1 ? "" : "s"}:`);
  for (const a of accounts) console.log(`  ${a.email}  —  ${a.displayName}  (created ${a.createdAt.slice(0, 10)})`);
  console.log("Each account has its own projects, contractors, sources and records.");
  return 0;
}

async function createCommand(): Promise<number> {
  const email = (await ask("Email for the new account: ")).trim();
  const displayName = (await ask("Display name: ")).trim();
  const password = await askNewPassword();
  if (password === null) return 1;
  const result = await withStore((store) => createAccount(store, { email, displayName, password }));
  if (!result.ok) {
    console.error(`${result.reason}. Nothing was changed.`);
    return 1;
  }
  console.log(`Created ${result.account.email} (${result.account.displayName}). Sign in at http://127.0.0.1:5173/.`);
  console.log("This account starts with its own empty workspace.");
  return 0;
}

async function resetCommand(): Promise<number> {
  const config = readConfig();
  const answer = (await ask(`Account email [${config.bootstrapEmail}]: `)).trim();
  const email = answer || config.bootstrapEmail;
  const password = await askNewPassword();
  if (password === null) return 1;
  const result = await withStore((store) => resetUserPassword(store, email, password));
  if (!result.ok) {
    console.error(`${result.reason}. Nothing was changed.`);
    return 1;
  }
  console.log(`Password reset for ${result.email}. Existing sessions were signed out.`);
  console.log("Sign in at http://127.0.0.1:5173/ with the new password.");
  return 0;
}

async function secureEnvCommand(): Promise<number> {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    console.error("No .env file in this folder.");
    return 1;
  }
  const text = readFileSync(envPath, "utf8");
  let result = hashBootstrapPasswordInEnv(text);
  if (!result.ok) {
    console.log(`${result.reason}.`);
    const choice = (await ask("Store a new first-run password as a hash instead? [y/N]: ")).trim().toLowerCase();
    if (choice !== "y" && choice !== "yes") return 0;
    const password = await askNewPassword();
    if (password === null) return 1;
    result = hashBootstrapPasswordInEnv(text, password);
    if (!result.ok) {
      console.error(`${result.reason}. Nothing was changed.`);
      return 1;
    }
  }
  writeFileSync(envPath, result.text, "utf8");
  console.log("Done: .env now stores BOOTSTRAP_PASSWORD_HASH instead of a plain-text BOOTSTRAP_PASSWORD.");
  console.log("Accounts that already exist keep their current passwords; this value only creates the BOOTSTRAP_EMAIL account if it doesn't exist yet.");
  return 0;
}

const commands: Record<string, () => Promise<number>> = {
  list: listCommand,
  create: createCommand,
  reset: resetCommand,
  "secure-env": secureEnvCommand
};

async function main(): Promise<number> {
  const name = process.argv[2] ?? "";
  const command = commands[name];
  if (!command) {
    console.error(`Usage: accountsCli <${Object.keys(commands).join(" | ")}>`);
    return 1;
  }
  if (name !== "list" && !process.stdin.isTTY) {
    console.error("Run this in an interactive terminal so passwords can be typed without being shown.");
    return 1;
  }
  try {
    return await command();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      /ECONNREFUSED|connect|getaddrinfo|password authentication/i.test(message)
        ? `Could not reach the database (${message}). Is SWA Local / Docker running? Nothing was changed.`
        : `${message}. Nothing was changed.`
    );
    return 1;
  }
}

process.exitCode = await main();
