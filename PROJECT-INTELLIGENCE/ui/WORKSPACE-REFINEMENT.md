# Workspace Refinement

Status: Approved UI refinement direction for Pass 1. This is not Phase 9.

## Purpose

Refine the implemented Phases 1-8 interface without changing operational behavior, APIs, data models, authority rules, evidence/provenance rules, or workflow boundaries.

## Mental Model

The workspace is organized around three persistent questions:

- Sources: What information do I have?
- Assistant: What does it mean and what should I do?
- Workbench: Let me do the work.

NotebookLM is interaction inspiration only. Do not copy Google branding, proprietary assets, exact styling, or pixel-level UI.

## Desktop Structure

At approximately 1366x900 and larger, preserve the three-panel concept:

- Left: Sources & Context.
- Center: Assistant-led project workspace and selected detail.
- Right: Workbench tools.

The center panel is the primary thinking surface. Sources and workbench tools support it.

## Preservation Rules

This pass must not add new product functionality or begin Phase 9. It must preserve existing behavior for projects, sources, contractor engagements, readiness, plan review, observations, incidents, reports, assistant conversations, memory, instructions, skills, proposed actions, human confirmation, retrieval scope, and evidence/provenance boundaries.

## Progressive Disclosure

The UI should feel calmer and less form-heavy by using stronger panel hierarchy, denser scannable rows, clearer headings, compact metadata, and restrained visual treatment. Existing forms remain available where needed, but the shell should feel like a professional task workspace rather than a collection of raw forms.
