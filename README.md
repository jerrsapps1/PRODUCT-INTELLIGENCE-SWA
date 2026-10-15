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
- `Reset SWA Password` resets a forgotten password (see below).

The launcher uses the existing `npm.cmd run dev` script, waits for the API health endpoint and Vite frontend, then opens `http://127.0.0.1:5173/` in the default browser.

If `.env` is missing, the launcher creates an ignored local `.env` with generated private development credentials and a local Docker PostgreSQL URL. The configured bootstrap email is visible in `.env` as `BOOTSTRAP_EMAIL`; the password remains local in `.env` and must not be committed or pasted into logs.

Local URLs:

- Frontend: `http://127.0.0.1:5173/`
- API health: `http://127.0.0.1:4174/api/health`
- API base through Vite: `/api`, proxied to `http://127.0.0.1:4174`

### Passwords

- **Change your password** while signed in: **Change password** in the top bar. It needs the current password; other signed-in browsers are signed out, this one stays signed in.
- **Forgot it?** On the computer running SWA, open the `Reset SWA Password` shortcut (re-run `tools\install-swa-shortcuts.ps1` once to create it), or run `tools\reset-swa-password.ps1`. It starts Docker and the local database if needed, backs the database up to `.data\backups\`, then asks for the account (default `BOOTSTRAP_EMAIL`) and a new password typed without being shown. Only that account's password changes, and it is signed out everywhere. Projects, sources and records are untouched.
- The underlying command is `npm.cmd run auth:reset-password` (needs `DATABASE_URL`; run it in an interactive terminal). There is no reset over the web: resetting requires access to this computer.
- `BOOTSTRAP_PASSWORD` in `.env` is only used to create the account the first time. Changing it later does not change an existing account's password.
- Passwords must be at least 10 characters.

Local launcher logs are written under `.data/local-runtime/logs/`, which is ignored by Git.

## Verification Commands

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd audit --audit-level=moderate`

The API server applies the initial schema on startup. Large future source files and generated artifacts must use object/file storage rather than PostgreSQL binary columns.
