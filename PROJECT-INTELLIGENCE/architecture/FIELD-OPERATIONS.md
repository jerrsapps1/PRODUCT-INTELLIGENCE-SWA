# Field Operations Architecture

Status date: 2026-08-09

## Scope

Phase 5 adds field observations as preserved project records. Observations may be linked to a contractor engagement or left as project-level/general notes. They are not incidents, OSHA citations, corrective actions, discipline records, or contractor performance scores.

## Data Model

- `field_observations` stores project, optional engagement/contractor, creator, original text, observed timestamp, optional location/activity, editable derived classification/category/summary, reviewer note, follow-up fields, AI suggestion fields, recurrence summary, and timestamps.
- `observation_photos` associates observations with image source records. Removing an observation photo removes only the association and preserves the original source object.
- `observation_reference_links` stores grounded source/chunk suggestions or reviewer links. Reference links must point to existing source records; fabricated citations are not allowed.
- `observation_plan_finding_links` stores optional human-confirmed relationships to Phase 4 plan findings in the same project context.
- `observation_audit_events` records creation, edits, photo changes, AI processing, reference/finding links, and follow-up closure.

## API Surface

- `GET /api/observations`
- `POST /api/observations`
- `GET /api/observations/:id`
- `PATCH /api/observations/:id`
- `POST /api/observations/:id/photos`
- `PATCH /api/observation-photos/:photoId`
- `DELETE /api/observation-photos/:photoId`
- `POST /api/observations/:id/enrichment-runs`
- `POST /api/observations/:id/references`
- `DELETE /api/observation-references/:linkId`
- `POST /api/observations/:id/plan-findings`
- `DELETE /api/observation-plan-finding-links/:linkId`

## AI Boundary

Observation enrichment is suggestion-only. Original text is never rewritten. Suggested classification, category, summary, activity, follow-up state, and references are stored separately from reviewer-controlled fields. Rejected suggestions are not silently reapplied on later runs. The current implementation uses deterministic local enrichment; future external providers must preserve these same boundaries.

## Photos and Storage

Field photos reuse Phase 2 source intake and original-object storage. The application accepts common image formats, stores originals through the object-storage abstraction, displays thumbnails from original source retrieval, and links/unlinks observation associations without deleting original source records.

## Recurrence

Repeated observation awareness is factual only: the system records whether prior observations share the same project/category context. It does not produce scores, rankings, risk ratings, or contractor performance judgments.

## Connectivity

Full offline sync is not implemented in Phase 5. The UI saves through the API and surfaces request errors. Offline-first capture and queued synchronization remain future work.

## Deployment Notes

PostgreSQL tables are included in `src/server/db/migrations/005_field_operations.sql` and the embedded migration used by the app. Hosted PostgreSQL backup/recovery and object-storage durability follow the production deployment requirements documented in `PROJECT-INTELLIGENCE/architecture/DEPLOYMENT.md`.
