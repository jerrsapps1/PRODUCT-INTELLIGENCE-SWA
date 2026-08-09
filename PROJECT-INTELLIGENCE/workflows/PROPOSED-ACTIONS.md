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

For observation follow-up proposals, the captured target `updatedAt` value must still match at confirmation time. If the observation changed through the normal operational path after proposal creation, confirmation fails and the assistant proposal does not overwrite the newer record.

For memory proposals, proposed content is not saved as Project or Global Memory until authenticated confirmation. A rejected proposal creates no memory entry. If the user edits the proposal before confirmation, only the edited proposed content is saved.
