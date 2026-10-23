# Task 5 — API route verification (2026-10-23)

## Runtime topology

The deployed frontend is Vite + React (netlify.toml builds dist/); FastAPI on Railway is the HTTP API. Files under src/app/**/route.ts are Next.js App Router artifacts and are not mounted by the Vite deployment. Their presence is not evidence of a live endpoint.

## Verified route contract

| Route | Method | Status/contract | Notes |
|---|---|---|---|
| /api/situation | GET | 200 JSON with a valid bearer session; 401 without one | Canonical persisted care-record hydration. |
| /api/situation | POST | 200 JSON on accepted input; 400/401/403 on invalid input/session/scope | Canonical write path for text and extracted-document evidence. |
| /api/extract | POST multipart file | 200 JSON for UTF-8 text and text-based PDFs; 400/413/415/422 for invalid, oversized, unsupported, or unreadable files; 401 without a bearer session | Image OCR and Office formats are explicitly not claimed as supported. A scanned PDF without embedded text returns 422. |
| /api/track | POST JSON | 202 JSON for registered events; 422 for unregistered event names | Operational telemetry only. IDs are hashed; metadata is allowlisted to avoid storing free-text care details. |
| /api/v1/sessions/anonymous | POST | 201 JSON | Creates a server-scoped anonymous care capability. |
| /api/v1/evidence/{person_id}, /api/v1/events/{person_id} | GET | JSON; requires bearer token and matching person scope | Existing read endpoints. |

## Capture modes

Upload, Scan, and Snap are UI entry modes, not separate HTTP endpoints. They pass a file through /api/extract, then submit extracted text through /api/situation. The current backend extractor does not perform OCR; camera images/scanned images receive an explicit 415 response and a caregiver-facing message rather than being treated as extracted text.

The summary-sharing panel reads the authorized care record and uses browser sharing/download behavior. The Next-only /api/share-intake and /share-target files are not Vite runtime endpoints. Do not wire the active Vite app to them without implementing a corresponding Vite/Netlify handler.

The names /api/upload, /api/scan, /api/snap, /api/share, and /api/documents are not standalone backend routes; no client should call them as if they existed.

## Verification boundary

Automated tests cover method matching, JSON responses, authentication, successful text extraction, unsupported image handling, telemetry validation and safe metadata persistence. Production route smoke tests, PDF fixture tests against the hosted environment, Tesseract availability, and real camera/OCR behavior remain unverified while Railway is unavailable.