# Current State

Status date: 2026-08-09

## Confirmed

- Product doctrine remains approved as V1 governing direction.
- Phase 1 foundation implementation is complete.
- Phase 2 source intelligence foundation has been implemented for review and remains limited to the approved source-intelligence scope.
- GitHub repository `https://github.com/jerrsapps1/PRODUCT-INTELLIGENCE-SWA.git` on branch `main` is established as the implementation source of truth.
- Local project root is `C:\dev2\PRODUCT-INTELLIGENCE-SWA`; no nested Git repository remains.
- The repository now contains a TypeScript full-stack application foundation with a React responsive/PWA client and Node HTTP API.
- PostgreSQL is the production structured persistence target; browser localStorage is not used as source-of-truth persistence.
- The initial schema distinguishes users, projects, contractor master records, sessions, and project-contractor engagements.
- The source model distinguishes source records, original storage references, extracted chunks, and project-source activation links.
- Sources do not become controlling authority merely because they exist in the library.

## Implemented in Phase 1

- Simple private authentication with an environment-configured bootstrap user and HTTP-only session cookie.
- Protected project, contractor, and project-contractor engagement APIs.
- Blank project creation and reopening through persisted API records.
- Contractor master record creation independent from project engagements.
- Reuse of the same contractor master record across multiple projects through engagement rows.
- Duplicate contractor engagement prevention per project.
- Responsive three-area workspace shell that adapts to a tabbed touch layout at narrow/iPad widths.
- Initial migration artifact at `src/server/db/migrations/001_initial.sql`.
- Targeted automated API and UI-state tests.

## Implemented in Phase 2

- Global and project source library records.
- File upload intake for PDF, DOCX, XLSX, PPTX, TXT, Markdown, CSV, and common image formats.
- URL source intake for a safe, limited HTTP/HTTPS subset.
- Local object-storage abstraction for original uploaded files.
- Extraction pipeline that stores derived text chunks separately from originals.
- Processing states for ready, partial, and failed extraction.
- Search across source metadata and extracted content.
- Citation/provenance chunks with source-relative location labels.
- Explicit project source association and active/controlling status.
- Source detail/preview fallback UI with original-file access.

## Not implemented by design

- Embeddings, vector search, general crawling, readiness workflows, plan review, observations, incidents, corrective actions, reporting, skills, persistent AI memory, historical scoring, billing, portals, and worker management.
- Production object-storage provider integration. The abstraction exists; hosted object storage must be configured for production.
- Provider-specific AI integrations. Phase 2 does not create fake AI output.

## Operational requirements

- Runtime requires `DATABASE_URL` pointing at PostgreSQL.
- Production requires a strong `BOOTSTRAP_PASSWORD`; the server rejects the default development password when `NODE_ENV=production`.
- `BOOTSTRAP_EMAIL`, `BOOTSTRAP_DISPLAY_NAME`, `SESSION_SECRET`, `LOCAL_STORAGE_DIR`, and `PORT` are configurable.
- Database backups and future object-storage backups are documented in `PROJECT-INTELLIGENCE/architecture/DEPLOYMENT.md`. Hosted PostgreSQL backup configuration is pending deployment provisioning, not optional.

## Current constraint

Do not begin Phase 2 until Phase 1 is reviewed and accepted.
