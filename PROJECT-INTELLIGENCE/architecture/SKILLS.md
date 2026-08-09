# Skills Architecture

Status: Phase 8 implemented and verified on 2026-08-09.

A skill is a reusable internal procedural workflow for the assistant. It is not a duplicate source library and does not acquire authority beyond the bounded assistant action registry.

## Model

Skills support Global and Project scopes and preserve:

- skill ID,
- name,
- description,
- trigger/use description,
- scope,
- project when applicable,
- active status,
- version/revision,
- Markdown procedural instructions,
- timestamps.

The conceptual structure follows compact metadata plus concise `SKILL.md`-style instructions, with room for future references/templates/resources. Executable scripts and plugin marketplace behavior are excluded from Phase 8.

## Editing

The user can edit skills through:

- guided builder fields,
- advanced Markdown instructions.

Saving validates name, description, trigger, scope, and non-empty Markdown. Editing creates a new version so assistant runs can record which version influenced a response.

## Activation

Skill activation is visible in assistant context. Skills can orchestrate registered read/draft/propose actions only. Skills cannot bypass authorization, confirmation, evidence boundaries, or product doctrine.
