# Memory Architecture

Status: Phase 8 implemented and verified on 2026-08-09.

Memory is human-approved persistent assistant context. Memory is not evidence and does not become an operational record.

## Scopes

- Global Memory: durable working preferences or recurring operating context.
- Project Memory: project-specific context, approved working interpretations, owner expectations, recurring notes, and links to project decisions or other evidence.

## Persistence

Memory entries preserve structured metadata:

- memory ID,
- scope,
- project when applicable,
- content,
- provenance/origin,
- created by,
- confirmed by,
- active/archived state,
- timestamps.

Markdown-style editing is user-facing. Structured metadata remains authoritative for provenance and history.

## Confirmation

Assistant-generated memory proposals require human confirmation. Rejected proposals are not saved as active memory. Manual editor saves are authenticated user actions and preserve audit history.

Memory cannot override authorization, product doctrine, action schemas, confirmation requirements, or evidence/source-of-truth boundaries.
