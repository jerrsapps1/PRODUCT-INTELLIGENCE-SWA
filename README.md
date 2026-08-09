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

## Verification Commands

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd audit --audit-level=moderate`

The API server applies the initial schema on startup. Large future source files and generated artifacts must use object/file storage rather than PostgreSQL binary columns.
