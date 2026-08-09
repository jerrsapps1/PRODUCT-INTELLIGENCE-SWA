# Assistant Chat Workflow

Status: Phase 8 implemented and verified on 2026-08-09.

## Conversation Flow

1. User opens a project.
2. User opens or creates a project-linked assistant conversation.
3. Conversation displays visible context: project, optional contractor, retrieval scope, active instructions, and active skill.
4. User asks a question or selects a contextual starter.
5. Server assembles bounded context using explicit scope, active records/sources, query-relevant records, applicable memory, applicable instructions, and active skill.
6. Assistant produces a traceable answer, draft, suggested action, or proposed write.
7. Proposed writes remain pending until a separate authenticated confirmation action.

Conversation history is not persistent memory. Conversation content is not automatically promoted into memory.

## Context Transparency

Assistant responses should expose input classes used, such as source count, operational record count, memory count, instruction scope, active skill/version, and retrieval scope. Do not expose hidden chain-of-thought.

## Boundaries

Retrieved source text, memory, instructions, and skill Markdown cannot override product doctrine, authorization, confirmation requirements, or action schemas.
