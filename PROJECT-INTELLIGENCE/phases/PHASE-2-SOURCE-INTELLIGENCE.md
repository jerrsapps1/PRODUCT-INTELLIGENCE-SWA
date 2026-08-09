# Phase 2 Source Intelligence Foundation

Status: Formally complete on 2026-08-09

## Scope Delivered

- Source library records for global, project, contractor-ready, and URL-backed sources.
- Local object-storage abstraction for original uploaded files.
- PostgreSQL schema for sources, extracted chunks, and project-source activation links.
- File upload intake with safe generated storage keys.
- URL source intake with SSRF protections and a deliberately limited supported subset.
- Modular extraction pipeline that preserves originals and stores derived text separately.
- Search across source metadata and extracted text chunks.
- Citation chunk model that links extracted text back to source-relative locations.
- Project source association and explicit activation/controlling status.
- Source detail view with metadata, classification, processing status, extracted chunks, and original-file access.
- Responsive source intake and source library UI within the three-panel shell.

## Supported Source Types

| Type | Accepted for storage | Text extraction | Metadata extraction | Preview/fallback |
|---|---|---|---|---|
| PDF | Yes | `pdf-parse` text extraction where parser supports the file | Page count/info when available | Original download plus extracted chunks |
| DOCX | Yes | XML text from `word/document.xml` | Basic format metadata | Original download plus extracted chunks |
| XLSX | Yes | Shared-string and worksheet cell text | Sheet count when available | Original download plus extracted chunks |
| PPTX | Yes | Slide XML text | Slide count when available | Original download plus extracted chunks |
| TXT | Yes | UTF-8 text | Size/character count | Extracted text chunks |
| Markdown | Yes | UTF-8 text | Size/character count | Extracted text chunks |
| CSV | Yes | UTF-8 text | Size/character count | Extracted text chunks |
| Images | Yes | Not in Phase 2 | MIME/size metadata | Honest no-text fallback and original download |
| URL | Source record only | Limited HTML/text retrieval | Retrieval date/content type/final URL | URL citation and extracted text when accessible |

Unsupported files are rejected before storage. Parser failures set the source to `failed` while preserving the original uploaded file.

## Authority and Activation

Sources do not become controlling authority because they exist in the library.

- A source has an authority classification.
- User-confirmed classification is tracked separately.
- A global source can be associated with a project without duplicating the source file.
- A project-source link must be explicitly marked `active` before it is treated as active for that project.

## Deletion and Removal Behavior

Phase 2 implements project-source removal by deleting the project association only. Removing a source from one project does not delete the global source record or original stored file.

Full source-record deletion and physical object deletion are intentionally not exposed in this phase. They require future retention/audit policy because originals may become evidence.

## Explicitly Excluded

No contractor readiness workflow, EMR/TRIR analysis, competent-person evidence workflow, safety-plan review, plan approval, observations, incidents, corrective actions, reports, persistent memory, skills, portals, billing, worker management, or contractor historical scoring was implemented.

## Verification

Automated tests cover:

- Authenticated upload and unauthenticated upload rejection.
- Allowed text upload and disallowed file rejection.
- Extraction success and extraction failure with original preservation.
- Original-file retrieval.
- Source search and citation chunk mapping.
- Project source association, duplicate association rejection, activation, and removal without deleting the source.
- URL SSRF rejection for private network URLs.

Manual browser verification is required before final acceptance for drag-and-drop/file chooser ergonomics on the target devices.
