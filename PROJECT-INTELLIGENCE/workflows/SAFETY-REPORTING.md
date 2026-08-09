# Safety Reporting Workflow

Status: Phase 7 implemented and verified on 2026-08-09.

## Report Flow

1. Select a project.
2. Select report type: Daily, Weekly, Monthly, or Custom.
3. Select format: Narrative or Structured.
4. Set explicit period start and period end dates.
5. Set report scope controls for contractors, readiness, plan review, observations, incidents, open follow-up, project decisions, and upcoming focus.
6. Add report-specific manual inputs such as project activity, meeting note, planned work, weather, milestone, visitor/audit note, safety emphasis, or other context.
7. Generate an editable draft from the evidence manifest.
8. Edit the draft as needed.
9. Finalize the report through human action.
10. Reopen through a new draft revision if later edits are needed.
11. Export printable HTML from the preserved current revision.

## Evidence Window

Reports include records inside the period and unresolved prior records that remain materially relevant. The manifest distinguishes these as `newDuringPeriod` and `carriedOpen`.

## Human Controls

Report drafts are never final by default. The user can edit content, create a new revision, regenerate while preserving existing work, finalize, and export. Finalized content is not overwritten by later edits or regeneration.

## Exclusions

The reporting workflow does not implement OSHA forms, workers compensation reporting, insurance claims, legal conclusions, automatic citations, automatic contractor discipline, portals, billing, historical scoring, persistent memory, or Phase 8 skills.
