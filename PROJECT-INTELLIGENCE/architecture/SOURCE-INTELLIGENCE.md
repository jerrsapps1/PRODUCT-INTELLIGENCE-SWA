# Source Intelligence Architecture

Status: Phase 2 foundation implemented.

## Source Model

Source intelligence uses three related persistence concepts:

- `sources`: source metadata, scope, authority classification, storage reference or URL, processing status, and extraction status.
- `source_chunks`: derived text chunks with source-relative citation metadata.
- `project_sources`: explicit project association and activation status for a source.

Original evidence is preserved separately from derived text. Extracted chunks can be regenerated in future versions without overwriting the original source.

## Storage

The server uses an `ObjectStorage` abstraction.

- Local development: `LocalObjectStorage`, rooted at `LOCAL_STORAGE_DIR` and ignored by Git.
- Tests: `MemoryObjectStorage`.
- Production expectation: replace or extend the abstraction with managed object storage without changing source records or API contracts.

Storage keys are generated from user/source IDs and random identifiers. Uploaded filenames are retained as metadata only and are not trusted as storage paths.

## Processing States

Sources use explicit processing states:

- `uploaded`
- `processing`
- `ready`
- `partial`
- `failed`

Phase 2 processes synchronously inside the request so the UI can immediately show final status. The model supports later background processing without schema redesign.

## URL Intake

URL intake is intentionally narrow:

- Supports HTTP/HTTPS only.
- Rejects embedded credentials.
- Rejects localhost and private network targets.
- Resolves hostnames before fetch to reduce SSRF risk.
- Does not crawl recursively.
- Does not bypass authentication, paywalls, robots restrictions, or access controls.

URL source extraction is limited to accessible HTML/text responses.

## Search and Retrieval

Phase 2 uses SQL-backed metadata filters plus extracted-text search. This is sufficient for current scale and keeps semantic/vector retrieval as a future extension rather than premature infrastructure.

Search can filter by title/name, source type, scope, project association, active project status, authority classification, and extracted text.

## Citation Foundation

Each chunk stores:

- source ID
- chunk index
- location label
- structured citation metadata

The system does not fabricate precision. For example, DOCX chunks are paragraph/text chunks; PPTX chunks are slide-based; XLSX chunks are sheet-based; PDF citations depend on parser metadata available from the file.
