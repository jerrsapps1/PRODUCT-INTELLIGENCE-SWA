# Proposed Actions Workflow

Status: Phase 8 implemented and verified on 2026-08-09.

Proposed actions are assistant-prepared changes that are not authoritative until confirmed by an authenticated user.

## Lifecycle

- Proposed
- Edited
- Confirmed
- Executed
- Rejected
- Failed
- Superseded

## Review Boundary

Before execution, the user must see target, current state, proposed change, rationale, and evidence/provenance where applicable.

Confirmation must be a separate authenticated user action. The assistant cannot self-confirm, and earlier conversational text is not treated as confirmation for an unrelated pending proposal.

## Execution

After confirmation the server re-checks authorization, target/current state, stale/conflicting state where practical, and normal domain validation. Execution uses existing domain services/APIs, records audit/provenance, and preserves proposal history.

No catch-all database update action is allowed.
