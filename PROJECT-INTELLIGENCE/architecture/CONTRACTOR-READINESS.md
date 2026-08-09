# Contractor Readiness Architecture

Status date: 2026-08-09

## Boundary

Contractor readiness is an engagement workflow. Project requirements define what must be reviewed. Contractor requirement statuses, evidence reviews, metrics, and competent person evidence record how one contractor is being evaluated for one project engagement.

The contractor master record remains reusable identity/contact data and does not carry universal readiness approval.

## Core Records

- `readiness_requirements`: project-level readiness definitions.
- `contractor_requirement_statuses`: engagement-level lifecycle status for a requirement.
- `readiness_evidence`: links applied requirement statuses to existing source records and optional chunks.
- `safety_metrics`: EMR, TRIR, DART, or other metric values with source provenance.
- `competent_person_evidence`: named competent-person evidence for a specific engagement.
- `readiness_audit_events`: user-visible trace of readiness actions.

## Source Reuse

Phase 3 depends on Phase 2 source intelligence. Evidence references source records; it does not duplicate originals or extracted text. Removing a project-source association does not delete a source record that may be used as evidence.

## Review Semantics

Evidence receipt is not evidence acceptance. The system may record received evidence and extracted metadata, but readiness acceptance, rejection, expiration, replacement requests, and not-applicable decisions remain explicit human review outcomes.

## Exclusions

This architecture does not include safety plan review, AI approval, scoring, automatic rejection, worker rosters, HRIS/LMS integrations, observations, incidents, corrective actions, reporting, or portals.
