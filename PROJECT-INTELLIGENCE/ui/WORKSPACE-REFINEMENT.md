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

## Sources Workflow Amendment

The Sources & Context panel should follow a NotebookLM-style source workflow while preserving SWA authority doctrine:

- Keep the normal Sources panel compact, searchable, selectable, and contextual.
- Expose source intake through a bounded `+ Add sources` dialog rather than persistent upload/URL forms.
- Preserve three separate source states: project association, project authority/activation, and current context selection.
- Current context selection must never activate a source as controlling authority.
- Source rows prioritize human-readable display titles while preserving original filename/URL provenance as secondary metadata.
- Use existing authority classification metadata for lightweight organization/filtering.
- Opening a source shows a focused Source Viewer with metadata, original access, association/activation status, and extracted content behind an explicit section.
- Citation navigation is limited to honest chunk-level source viewer anchors until a later Source Intelligence Quality pass improves extraction and semantic sectioning.

Implemented: Pass 1 follow-up moved file/URL source intake into the Sources dialog, added source selection with select-all/clear, added selected-source count to Assistant context, and made extracted chunks progressively disclosed in the Source Viewer. Source storage, extraction, activation, provenance, and Phase 1-8 behavior remain unchanged.

## Desktop Panel Resizing Amendment

The desktop workspace may provide user-resizable Sources and Workbench panel widths while keeping the Assistant as the primary center workspace.

- The Sources/Assistant and Assistant/Workbench dividers may be dragged like professional workspace panes.
- Resizing only changes browser-local presentation state and must not create authoritative project/application data.
- The Assistant consumes remaining available width and retains a sensible minimum so side panels cannot consume the whole workspace.
- Sources and Workbench keep independent minimum/maximum constraints.
- The default layout should preserve the approved three-panel proportions when no local preference exists.
- A low-noise reset affordance, such as double-clicking a divider, may restore defaults.
- Tablet and narrow layouts retain the approved tabbed/stacked behavior and should not expose desktop drag handles.

Implemented: The desktop shell stores Sources and Workbench widths in browser `localStorage`, provides draggable and keyboard-accessible vertical dividers, double-click reset, constrained side widths, and keeps responsive tablet behavior unchanged. This is presentation-only state and does not begin Phase 9.

## Sources Capability Amendment

The Sources workflow should support operational reuse and organization without changing source authority doctrine or extraction quality.

- Global Library sources are reusable records that may be associated with multiple projects without duplicating originals or extracted chunks.
- Project association, project authority/activation, and current-context selection remain distinct states.
- The `+ Add sources` experience may expose three clear paths: upload new, add URL, and choose existing Global Library sources.
- Removing from current context only deselects a source for the current assistant context.
- Removing from project only deletes the project-source link and never deletes the underlying source record.
- Deleting from the library is an explicit destructive action that must be blocked or safely archived when the source is referenced by projects or operational records.
- User tags/groups are lightweight organization metadata and never replace controlled authority classification.
- Deterministic metadata-based tag suggestions may be offered when no external provider is configured; suggested tags remain editable and must not activate authority.
- Source summaries are derived content, not evidence. Summary generation must honestly report unavailable provider status rather than fabricate summaries.
- Display title is user-editable metadata; original filename/URL remains immutable provenance.

Implemented: Sources now support Global Library reuse from the Add Sources dialog, user tags/groups, deterministic tag suggestions, editable display titles, safe project unlinking, explicit guarded library archival, and a richer center Source Viewer with provenance, summary status, tags, and extracted content. Document parsing/extraction algorithms and citation chunking remain unchanged.
