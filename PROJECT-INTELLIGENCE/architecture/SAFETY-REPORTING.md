# Safety Reporting Architecture

Status: Phase 7 implemented and verified on 2026-08-09.

Safety reports are project records generated from existing evidence. They do not replace source records, contractor submissions, observations, incidents, plan reviews, readiness statuses, or project decisions.

## Data Model

- `safety_reports` stores project, report type, format, period start/end, title, draft/finalized status, generation status/provider/model/error state, scope controls, manual report inputs, current revision, author, finalizer, and timestamps.
- `safety_report_revisions` stores editable report content, structured content JSON, evidence manifest, revision number, draft/finalized status, author, finalizer, and timestamps.
- `safety_report_audit_events` stores report lifecycle events for creation, generation, fallback generation, editing, revision creation, and finalization.

Evidence manifests store identifiers only. Full source documents remain in Phase 2 source storage, and workflow records remain in their own Phase 3-6 tables.

## Evidence Rules

Reports distinguish:

- New evidence during the explicit report period.
- Prior unresolved materially relevant evidence carried into the report.

Evidence can come from contractor readiness, plan review, field observations, incident oversight, project safety decisions, project/contractor context, and manual report-specific inputs. Contractor sections appear only when contractor-linked evidence exists.

## AI Boundary

Report drafting is provider-agnostic. The implemented local assistant is deterministic and evidence-bound. A deterministic fallback produces a draft when the configured provider fails, and the error is preserved on the report.

AI cannot invent evidence, change source records, finalize reports, approve plans, close incidents, create project decisions, make OSHA determinations, assign liability, or discipline contractors.

## Preservation

Finalized report revisions are preserved. Regeneration can create a new draft revision while retaining prior edits/finalized content. Editing a finalized revision creates a new draft revision rather than mutating the finalized record.
