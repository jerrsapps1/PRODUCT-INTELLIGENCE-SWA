# Phase 3 Contractor Readiness

Status: Implemented for review on 2026-08-09

## Scope Delivered

- Project-level readiness requirement definitions with title, category, optional source/citation reference, blocking flag, and due date.
- Contractor-specific readiness statuses on project-contractor engagements.
- Requirement lifecycle support for required, requested, received, needs review, accepted, rejected, expired, replacement requested, and not applicable.
- Evidence attachment from existing Phase 2 source records without duplicating uploaded files or extracted chunks.
- Human review workflow that keeps received evidence separate from accepted evidence.
- Duplicate requirement-application protection per engagement.
- Duplicate evidence-association protection per applied requirement.
- Planned mobilization date tracking with unresolved-readiness warnings.
- Contractor readiness summaries for project dashboards.
- EMR, TRIR, DART, and other safety metric capture with source provenance.
- Competent person evidence records tied to contractor engagement and source records.
- Audit events for requirement application, status changes, evidence receipt/review, metric capture, and competent person evidence capture.
- Responsive readiness UI in the existing three-area workspace.

## Data Ownership

Readiness requirements belong to a project. A contractor's readiness status belongs to the project-contractor engagement, not to the contractor master record.

Historical contractor evidence and prior accepted readiness do not automatically approve a contractor for a new project. Existing source records may be reused as evidence, but acceptance remains a human review action in the current engagement context.

## Evidence Rules

Phase 3 reuses the Phase 2 source infrastructure:

- Uploaded or URL-derived originals remain source records.
- Extracted text chunks remain source chunks.
- Readiness evidence references source records and optional chunks.
- Receiving evidence changes the applied requirement to received, not accepted.
- Acceptance, rejection, expiration, replacement requests, and not-applicable decisions require explicit user action.

## Explicitly Excluded

No safety plan review, plan approval, AI scoring, contractor auto-rejection, worker management, HRIS/LMS functionality, observations, incidents, corrective actions, reports, portals, billing, persistent AI memory, or Phase 4 behavior was implemented.

## Verification Coverage

Automated tests cover:

- Authentication protection for readiness routes.
- Project-level requirement creation.
- Requirement application to contractor engagement.
- Duplicate applied-requirement rejection.
- Evidence attachment with received versus accepted separation.
- Duplicate evidence rejection.
- Human evidence acceptance.
- Readiness summaries and timing warnings.
- EMR metric capture with source provenance.
- Competent person evidence capture.
- Contractor-specific status separation across engagements.
- No automatic approval from historical contractor activity on another project.
- Not-applicable status handling.
- Invalid readiness payload rejection.

Browser verification must confirm the readiness workbench remains usable on desktop and tablet/mobile widths before formal closure.
