# Decisions

## Decision Protocol

Confirmed behavior may not change silently. Record proposed changes here before implementation. A proposal becomes binding only when marked **Approved by user**.

| ID | Status | Decision | Rationale / impact |
|---|---|---|---|
| D-001 | Approved baseline | Build a private, responsive web application/PWA. | Supports desktop, macOS, iPad, and browser access without public-SaaS scope. |
| D-002 | Approved baseline | Treat project source authority as explicit human selection. | Prevents AI or library presence from silently creating controlling requirements. |
| D-003 | Approved baseline | Preserve original evidence; use editable internal drafts and exported artifacts. | Supports provenance, defensibility, and human control. |
| D-004 | Approved baseline | Use project-specific contractor engagements with separate contractor master history. | Prevents cross-project approval/data leakage while enabling informed future evaluation. |
| D-005 | Approved baseline | Do not start coding before phased implementation preparation is approved. | Establishes controlled implementation readiness. |
| D-006 | Approved by user | Use `Read -> Analyze -> Draft -> Propose -> Human Confirm -> Commit` as the assistant operating doctrine. | Keeps AI assistance useful while preserving human control over authoritative operational changes. |
| D-007 | Approved by user | Assistant access must use a bounded server-side action registry rather than unrestricted SQL, arbitrary database access, shell access, filesystem access, or unregistered backend calls. | Prevents model output, source prompt injection, memory, instructions, or skills from bypassing authorization and domain validation. |
| D-008 | Approved by user | Current Project is the default retrieval scope; contractor narrowing and cross-project/workspace retrieval must be visible and deliberate. | Prevents silent cross-project leakage while allowing explicit broader analysis when the user chooses it. |
| D-009 | Approved by user | Evidence, operational records, memory, instructions, skills, AI drafts, and proposed actions remain distinct persisted concepts with separate provenance. | Prevents memory or AI output from becoming evidence/source of truth and supports auditability. |

## Proposal Template

### D-XXX - Title

- Status: Proposed | Approved by user | Rejected | Superseded
- Proposed behavior:
- Current doctrine affected:
- Alternatives considered:
- Rationale and tradeoffs:
- Data/provenance impact:
- Phase impact:
- Approval record:
