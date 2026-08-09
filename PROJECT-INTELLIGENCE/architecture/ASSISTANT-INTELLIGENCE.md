# Assistant Intelligence Architecture

Status: Phase 8 implemented and verified on 2026-08-09.

The assistant is an orchestration layer over Phases 1-7. It is not a parallel source of truth.

Capability classification: **B - Deterministic Structured Assistant**. The current implementation is a credible local assistant for bounded context assembly, transparent summaries, draft artifacts, and registered action/proposal workflows. It is not yet an external conversational intelligence provider and should not be described as autonomous reasoning beyond deterministic orchestration.

## Operating Doctrine

The assistant follows:

`Read -> Analyze -> Draft -> Propose -> Human Confirm -> Commit`

Authoritative operational writes require authenticated human confirmation. The assistant cannot self-confirm.

## Context and Retrieval

Default retrieval scope is Current Project. Contractor scope, selected-project scope, Global Library, and Entire Workspace scope are deliberate visible choices.

Retrieved items preserve type and provenance:

- source chunks,
- readiness records,
- unresolved plan-review findings,
- observations,
- incidents,
- project safety decisions,
- safety reports,
- memory entries,
- instruction documents,
- active skill version.

Source text is evidence data, not trusted instruction text. Memory and instructions may influence assistant framing, but memory is not source evidence and cannot override operational records.

## Action Registry

The assistant uses a bounded server-side action registry. Actions declare name, description, input schema, action type, confirmation requirement, authorization constraints, and handler.

Allowed action types:

- READ: no authoritative write.
- DRAFT: non-authoritative generated text/artifact.
- PROPOSED_WRITE: creates a proposal that cannot execute until confirmed by an authenticated user.

No arbitrary SQL, shell, filesystem, or unrestricted backend invocation is available through the assistant.

## Provider Behavior

The assistant provider is server-side and provider-agnostic. No provider secrets are exposed to the frontend.

When no conversational provider is configured, editing memory/instructions/skills and invoking deterministic read/draft/action registry features remain available. The UI must honestly indicate unavailable conversational generation where applicable rather than faking provider intelligence.

The current configured behavior is deterministic local orchestration (`local-assistant-orchestrator` / `deterministic-context-orchestrator-v1`). No external conversational provider is configured in Phase 8 closure.

Active skills are procedural context. They may shape prompts, draft structure, and available guided workflow framing, but they execute only through the same registered action registry. Skills cannot run SQL, shell commands, filesystem operations, or bypass confirmation.

## Audit

Assistant records preserve conversations, messages, context scope, provider metadata, retrieval manifests, action events, proposed actions, confirmation/rejection, and execution results. Hidden chain-of-thought and provider reasoning tokens are not stored.

## Closure Verification

Phase 8 closure verification used a synthetic project context containing an open readiness item, unresolved plan finding, positive observation, observation follow-up, open incident follow-up, active project safety decision, recent report, Project Memory entry, Project Instruction, and active Skill. The assistant response reflected those repo records, did not import unrelated current-project or contractor-out-of-scope records, and did not treat malicious source text as instruction.

Proposed observation follow-up writes preserve target `updatedAt` state and fail rather than overwrite if the operational record changes before confirmation. Proposed memory remains unsaved until authenticated confirmation; rejected memory is not stored, and edited confirmation stores only the edited proposed content.
