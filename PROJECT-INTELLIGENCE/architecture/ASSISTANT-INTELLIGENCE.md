# Assistant Intelligence Architecture

Status: Phase 8 implemented and verified on 2026-08-09.

The assistant is an orchestration layer over Phases 1-7. It is not a parallel source of truth.

## Operating Doctrine

The assistant follows:

`Read -> Analyze -> Draft -> Propose -> Human Confirm -> Commit`

Authoritative operational writes require authenticated human confirmation. The assistant cannot self-confirm.

## Context and Retrieval

Default retrieval scope is Current Project. Contractor scope, selected-project scope, Global Library, and Entire Workspace scope are deliberate visible choices.

Retrieved items preserve type and provenance:

- source chunks,
- readiness records,
- plan reviews and findings,
- observations,
- incidents,
- project safety decisions,
- safety reports,
- memory entries,
- instruction documents,
- active skill version.

Source text is evidence data, not trusted instruction text.

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

## Audit

Assistant records preserve conversations, messages, context scope, provider metadata, retrieval manifests, action events, proposed actions, confirmation/rejection, and execution results. Hidden chain-of-thought and provider reasoning tokens are not stored.
