# Deployment and Recovery Architecture

Status: Phase 1 foundation documented; hosted infrastructure pending deployment configuration.

## Source of Truth

- GitHub repository: `https://github.com/jerrsapps1/PRODUCT-INTELLIGENCE-SWA.git`
- Local project root: `C:\dev2\PRODUCT-INTELLIGENCE-SWA`
- Branch: `main`

## Runtime Shape

- Frontend: hosted static React/Vite build from `dist/client`.
- Backend/API: Render-hosted Node process from `dist/server/index.js`.
- Structured data: PostgreSQL, provided through `DATABASE_URL`.
- File/object data: local object storage in development through `LOCAL_STORAGE_DIR`; managed external object storage required for production. PostgreSQL stores storage references, not large binary files.
- Optional plan-review AI: server-side only. Configure `PLAN_REVIEW_AI_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `OPENAI_PLAN_REVIEW_MODEL`; no AI secrets belong in frontend code.

## PostgreSQL Backup and Recovery

The V1 production requirement is satisfied through managed PostgreSQL backup configuration during hosted deployment, not through custom local scripts.

Required production configuration:

- Automated PostgreSQL backups enabled on the managed database provider.
- Point-in-time recovery or provider-equivalent restore capability where available.
- Restore procedure documented for replacing or restoring the production database from a known backup.
- Backup retention selected according to project risk tolerance before real project records are stored.

Current local status: schema and migration are present; hosted PostgreSQL backup configuration is pending because production infrastructure has not been provisioned in this repository.

## Object Storage Durability and Recovery

Future source documents, originals, photos, and generated artifacts must use object storage rather than PostgreSQL binary storage.

Required production configuration when file workflows are introduced:

- Object storage bucket with provider durability guarantees.
- Versioning or lifecycle retention policy for originals and generated artifacts.
- Access policy that prevents public access by default.
- Backup or cross-region replication policy if required by the selected storage provider and risk tolerance.
- Recovery procedure linking restored database records to restored object keys.

Current Phase 2 status: local object storage is implemented for development. Production must configure managed object storage and backup/durability policies before real project files are stored.
