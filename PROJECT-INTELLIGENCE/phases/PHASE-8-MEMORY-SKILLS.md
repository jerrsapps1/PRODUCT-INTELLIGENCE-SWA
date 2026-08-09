# Phase 8 - Assistant, Memory & Skills

Status: Implemented and verified. Phase 9 Historical Intelligence has not begun.

## Objective

Build the personalized assistant intelligence layer across Phases 1-7 without creating a parallel source of truth.

Phase 8 includes persistent project assistant chat, visible retrieval/context scope, global and project memory, global and project instructions, global and project skills, guided and Markdown skill editing, bounded assistant actions, draft/proposal generation, human-confirmed commits, and assistant audit/provenance.

## Governing Rules

- `Read -> Analyze -> Draft -> Propose -> Human Confirm -> Commit`.
- Assistant uses bounded registered actions, not unrestricted database access.
- Current Project is default retrieval scope.
- Cross-project retrieval is deliberate and visible.
- Evidence, operational records, memory, instructions, skills, AI output, and proposed actions remain distinct.
- Authoritative operational changes require authenticated human confirmation.

## Explicit Exclusions

No autonomous/background agents, automatic authoritative writes, automatic memory writes, unrestricted SQL/database access, arbitrary shell/filesystem access, executable skill scripts, plugin marketplace, arbitrary third-party plugins, multi-agent orchestration, automatic cross-project retrieval, contractor scoring, contractor-selection recommendations, subcontractor/worker-facing assistant, public chat sharing, automatic external messaging, or Phase 9 historical intelligence.

## Completed

- Persistent project-linked assistant conversations and message history.
- Visible conversation context for project, optional contractor, retrieval scope, and active skill.
- Bounded context assembly using source chunks, operational records, memory, instructions, and skills with retrieval manifests.
- Global and Project Memory with Markdown-style editing, structured metadata, provenance, active/archive state, and proposal-confirmation path.
- Global and Project Instructions with Markdown editing, scope separation, active documents, and version increments.
- Global and Project Skills with guided builder fields, advanced Markdown instructions, validation, active status, and versioning.
- Server-side assistant action registry with READ, DRAFT, and PROPOSED_WRITE action types.
- READ actions for project status, open observation follow-up, open incident follow-up, reports, and source retrieval.
- DRAFT actions for project meeting briefs and contractor follow-up text.
- PROPOSED_WRITE actions for memory save and observation follow-up update.
- Human confirm/reject/edit proposal lifecycle with execution through existing domain validation.
- Deterministic assistant orchestration with provider-failure transparency.
- Prompt-injection/source-content boundary tests.
- Assistant console and workbench in the existing responsive three-panel workspace.
- PostgreSQL schema migration `008_assistant_memory_skills.sql`.

## Verification

- `npm.cmd run typecheck` passed.
- `npm.cmd test` passed: 15 tests.
- `npm.cmd run build` passed.
- `npm.cmd audit --audit-level=moderate` passed with 0 vulnerabilities.
- Browser smoke verified desktop assistant shell, conversation creation, message send, context transparency, and assistant workbench rendering.
- Responsive CSS breakpoints and touch tab shell remain present for tablet/iPad behavior.

## Boundaries

No Phase 9 historical intelligence, autonomous/background agents, automatic authoritative writes, automatic memory writes, unrestricted SQL/database access, arbitrary shell/filesystem access, executable skill scripts, plugin marketplace, arbitrary third-party plugins, multi-agent orchestration, automatic cross-project retrieval, contractor scoring, contractor-selection recommendations, subcontractor-facing assistant, worker-facing assistant, public sharing, or automatic external messaging was implemented.

## Closure Matrix

| Requirement | Status | Evidence |
|---|---|---|
| Doctrine synchronization | Completed | D-006 through D-009 and Phase 8 architecture/workflow docs are repo-local. |
| Assistant conversations | Completed | Project-linked conversations, messages, context, runs, and reopen APIs/UI. |
| Retrieval/context scope | Completed | Current Project default, contractor context, selected-project/other scopes, manifests. |
| Context transparency | Completed | Assistant responses show scope, source counts, record counts, memory, instructions, active skill. |
| Memory | Completed | Global/project memory CRUD and proposal-confirm path. |
| Instructions | Completed | Global/project Markdown instruction save with versioning. |
| Skills | Completed | Guided fields, Markdown, scope, active status, activation, versioning. |
| Action registry | Completed | READ, DRAFT, PROPOSED_WRITE registry and invocation API. |
| Proposed writes | Completed | Proposal edit/confirm/reject and execution through domain methods. |
| Human confirmation | Completed | Assistant cannot self-confirm; execution requires authenticated confirm endpoint. |
| Audit/provenance | Completed | Runs, retrieval manifests, messages, proposals, execution results persisted. |
| Security boundaries | Completed | No raw SQL/unregistered action; prompt-injection source text tested as data. |
| Verification | Completed | Typecheck, tests, build, audit, browser smoke. |
| Phase 9 restraint | Completed | Phase 9 explicitly not begun. |

## Remaining Blockers

None.

## Approved Deferrals

None for Phase 8. Hosted deployment configuration remains governed by deployment doctrine.
