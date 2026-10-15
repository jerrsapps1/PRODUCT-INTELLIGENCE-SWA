# Product Intelligence SWA

Private Phase 1 foundation for the Personal Safety Project Intelligence Workspace.

Authoritative product doctrine lives under `PROJECT-INTELLIGENCE/`. Root-level files describe the application implementation and local operation only.

## Phase 1 Application

- React + Vite responsive/PWA frontend.
- Node TypeScript API using the built-in HTTP server.
- PostgreSQL production persistence through `pg`.
- SQL schema artifact at `src/server/db/migrations/001_initial.sql`.
- HTTP-only cookie sessions for a private bootstrap user.

## Local Setup

1. Copy `.env.example` to `.env` or provide equivalent environment variables.
2. Set `DATABASE_URL` to a PostgreSQL database.
3. Set a private `BOOTSTRAP_PASSWORD`.
4. Run `npm.cmd run dev` on Windows PowerShell, or `npm run dev` in shells where npm scripts are enabled.

### One-click Windows launch

On Windows, run `tools\install-swa-shortcuts.ps1` once to create desktop shortcuts:

- `SWA Local` starts the local launcher.
- `Stop SWA Local` stops repo-owned SWA app processes on the local development ports.
- `SWA Accounts` lists and creates accounts, resets a password, or hashes the `.env` password (see below).
- `Reset SWA Password` goes straight to resetting a forgotten password.

The launcher uses the existing `npm.cmd run dev` script, waits for the API health endpoint and Vite frontend, then opens `http://127.0.0.1:5173/` in the default browser.

If `.env` is missing, the launcher creates an ignored local `.env` with generated private development credentials and a local Docker PostgreSQL URL. The configured bootstrap email is visible in `.env` as `BOOTSTRAP_EMAIL`; the password remains local in `.env` and must not be committed or pasted into logs.

Local URLs:

- Frontend: `http://127.0.0.1:5173/`
- API health: `http://127.0.0.1:4174/api/health`
- API base through Vite: `/api`, proxied to `http://127.0.0.1:4174`

### Accounts and passwords

Passwords are only ever stored as scrypt hashes in the database. Accounts are managed on the computer running SWA, never over the web:

| Task | Shortcut / script | Command |
|---|---|---|
| List accounts | `SWA Accounts` → 1 | `npm.cmd run auth:accounts` |
| Create an account | `SWA Accounts` → 2 | `npm.cmd run auth:create-account` |
| Reset a forgotten password | `SWA Accounts` → 3, or `Reset SWA Password` | `npm.cmd run auth:reset-password` |
| Remove the plain-text password from `.env` | `SWA Accounts` → 4 | `npm.cmd run auth:secure-env` |

- Re-run `tools\install-swa-shortcuts.ps1` once to create the shortcuts. `tools\swa-accounts.ps1 -Action list|create|reset|secure-env` runs one task directly.
- Before creating an account or resetting a password, the script starts Docker and the local database if needed and backs the database up to `.data\backups\`. Passwords are typed without being shown.
- **Each account has its own workspace**: projects, contractors, sources and records belong to the account that created them. A new account starts empty.
- Signed in, use **Change password** in the top bar (current password required; other browsers are signed out).
- Passwords must be at least 10 characters.

#### The password in `.env`

`BOOTSTRAP_EMAIL` plus `BOOTSTRAP_PASSWORD_HASH` (or the older plain-text `BOOTSTRAP_PASSWORD`) only **create** that account the first time the server starts with that email. They never change an existing account's password, and changing `BOOTSTRAP_EMAIL` creates an additional, separate account. Run `npm.cmd run auth:secure-env` (or `SWA Accounts` → 4) to replace a plain-text `BOOTSTRAP_PASSWORD` with `BOOTSTRAP_PASSWORD_HASH` in place; the server refuses to start with a malformed hash. `DATABASE_URL` and `SESSION_SECRET` must stay readable by the server, so keep `.env` private (it is ignored by Git).

Local launcher logs are written under `.data/local-runtime/logs/`, which is ignored by Git.

## Verification Commands

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd audit --audit-level=moderate`

The API server applies the initial schema on startup. Large future source files and generated artifacts must use object/file storage rather than PostgreSQL binary columns.
