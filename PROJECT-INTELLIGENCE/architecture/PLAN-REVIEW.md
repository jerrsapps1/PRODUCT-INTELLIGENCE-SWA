# Safety Plan Review Architecture

Status date: 2026-08-09

## Boundary

Safety plan review is a source-grounded human review artifact. It compares a contractor-submitted plan revision to explicitly selected project/global reference sources and preserves draft analysis, citations, reviewer edits, contractor-facing recommendations, internal notes, reviewer decisions, approval status, and revision history separately.

The submitted contractor plan remains an unchanged source record. Review artifacts never overwrite the original.

## Core Records

- `safety_plans`: project-contractor plan header and current status.
- `safety_plan_revisions`: immutable submitted plan revisions linked to source records.
- `plan_reviews`: current review artifact for a plan revision.
- `plan_review_references`: selected review basis sources and citations.
- `plan_findings`: assistant or reviewer findings with editable classification, authority, explanations, notes, recommendations, decisions, and resolution flags.
- `plan_resubmission_comparisons`: reviewer-tracked resolution of prior findings against a newer revision.
- `plan_review_audit_events`: trace of plan creation, review runs, edits, approval, revision receipt, and comparisons.

## Review Assistant

Phase 4 uses a local, provider-agnostic review assistant placeholder named `local-review-assistant`. It does not call an external AI provider and does not require API keys.

The assistant only uses:

- the submitted plan source extraction,
- explicitly selected review reference sources,
- source/chunk provenance already created by Phase 2.

It generates editable draft findings and a contractor-facing recommendation draft. It cannot approve a plan.

## Authority Distinction

Findings distinguish:

- regulatory requirement,
- project requirement,
- recommendation,
- reviewer decision.

Unsupported claims must remain recommendations or reviewer-decision items, not mandatory requirements.

## Approval

Only a human reviewer can mark a plan approved. Approval stores reviewer/user, date/time, plan revision context, and audit history.

If a new revision is added after approval, the plan returns to pending while the earlier approved revision remains preserved in revision/audit history.

## Exclusions

No Phase 5 field observations, incidents, corrective actions, reporting, portals, automatic legal conclusions, automatic contractor rejection, or complex approval chains are included.
