# Incident Oversight Architecture

Status date: 2026-08-09

## Scope

Phase 6 adds contractor incident intake and GC/project oversight. An incident record is a preserved contractor incident file plus a separate project oversight record. It is not a GC replacement investigation, OSHA recordkeeping system, claims system, liability determination, or automatic contractor discipline mechanism.

## Data Model

- `incidents` stores project, optional engagement/contractor, factual incident information, contractor investigation status, contractor-reported classification, project oversight status, affected-work disposition, AI suggestion fields, closure/reopen fields, and timestamps.
- `incident_attachments` links original contractor reports, photos, witness statements, supporting files, investigation attachments, corrective-action documentation, and revised contractor documentation to existing Phase 2 source records.
- `contractor_corrective_actions` stores contractor-provided corrective actions separately from GC/project recommendations.
- `incident_project_reviews` stores GC/project reviewer analysis, remaining exposure, plan/procedure concerns, corrective-action adequacy, additional information needs, and management-review indication.
- `incident_recommendations` stores editable, human-controlled project recommendations.
- `project_safety_decisions` stores human-confirmed project-level safety decisions originating from incidents.
- `incident_followups` stores project follow-up verification with optional evidence/observation links.
- `incident_links` links incidents to Phase 4 plan findings or Phase 5 observations without causal conclusions.
- `incident_audit_events` preserves material incident history.

## AI Boundary

Incident AI is suggestion-only. It may summarize documentation, suggest concerns/questions, and point the reviewer toward possible recommendations. It may not determine OSHA recordability, legal liability, citation exposure, root cause as fact unless contractor-stated, contractor suspension, corrective-action approval, incident closure, or binding project decisions.

## Source and Provenance

Incident attachments reuse Phase 2 source intake and original storage. Removing an attachment removes only the incident-source association and preserves the original source record. Linked plan findings and observations must belong to the same project context.

## Affected Work

Affected-work disposition is a reviewer-controlled field. It supports no restriction, additional monitoring, affected activity paused, documentation required, plan revision required, management review, and cleared to resume. The system does not automatically stop a contractor or project.

## Deployment Notes

PostgreSQL tables are included in `src/server/db/migrations/006_incident_oversight.sql` and the embedded migration used by the app. Hosted PostgreSQL backup/recovery and object-storage durability follow `PROJECT-INTELLIGENCE/architecture/DEPLOYMENT.md`.
