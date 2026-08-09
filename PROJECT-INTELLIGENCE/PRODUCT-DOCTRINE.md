# Product Doctrine - Personal Safety Project Intelligence Workspace

Status: Approved V1 governing doctrine
Established: 2026-08-09
Authority: User-supplied Product Build Definition (`upload/Pasted markdown.md`)

## Purpose

This is a private, project-centered, AI-assisted workspace for a GC/project-management safety professional. It combines authoritative sources, contractor evidence, field activity, AI-assisted review, durable project memory, and editable work products. It accelerates professional judgment; it does not replace it.

## Non-negotiable product truths

- V1 is a private responsive web application/PWA, not a public multi-tenant SaaS or device-bound desktop product.
- The primary V1 user is the human safety professional. AI assists; humans approve plans, contractor readiness, persistent decisions, and official artifacts.
- Projects begin blank. The user explicitly selects controlling project references. AI may recommend but never silently elevates authority.
- The system preserves provenance and originals. Derived data never overwrites source evidence.
- Project information remains project-specific. Relevant contractor history persists across projects, but previous approval never implies current approval.
- Every AI-generated recommendation, classification, report, or memory proposal is editable and requires the applicable human approval.
- The interface remains calm, focused, NotebookLM-inspired, touch-friendly, and evidence-grounded, not a safety-management ERP.

## Authority and provenance model

Important claims must remain traceable through: Original Source -> Contractor Submission -> Extracted Data -> AI Inference -> Reviewer Note -> Reviewer Decision -> Project Decision -> Generated Artifact -> Final Artifact.

The product must distinguish regulatory requirements, project/owner requirements, GC policy, contractor statements, reviewer decisions, and AI inference. A library source is not controlling merely because it exists.

## V1 workflows

1. Projects and project source authority.
2. Contractor master records and distinct project engagements.
3. GC-policy-driven readiness requirements and contractor evidence.
4. Side-by-side contractor safety-plan review with editable, source-grounded findings.
5. Lightweight touch-first field observations with optional photos.
6. Contractor incident intake with original preservation and separate GC/project oversight.
7. Editable, evidence-grounded daily, weekly, monthly, and custom reports.
8. Human-approved project memory, decisions, and reusable skills.
9. Contractor closeout and historical performance summaries for future selection.

## Required boundaries

V1 excludes public accounts, billing, subscriptions, marketing site, multi-tenancy, subcontractor portals, worker self-service, full HR/LMS functions, complex approval chains, external owner portals, automatic legal determinations, AI risk scores/rejections, and automatic permanent memory.

## Architecture direction

Use GitHub as development source of truth; hosted responsive frontend; Render backend/API; PostgreSQL for structured records; separate object/file storage for originals and artifacts; provider-agnostic AI layer; and backup/recovery for both data and files. Do not store large document binaries in PostgreSQL.

## Implementation control

Build only in bounded phases and do not bypass unfinished foundations. Before changing confirmed behavior, record the proposal, alternatives, rationale, impacts, and approval status in `DECISIONS.md`. This document is a navigational doctrine; the supplied Product Build Definition remains the complete authoritative baseline until it is intentionally superseded by an approved revision.
