# Anonymous session and direct-fetch audit — 2026-10-22

## Active Vite application path

The deployed Vite entry is `src/main.tsx` → `src/App.tsx` → React Router pages. The main capture widget is `src/components/CareCapture.tsx`; it calls `postJSON('/situation', ...)`, which resolves to `/api/situation`. The legacy Next-style `src/app/**` and `src/lib/workspace-context.tsx` code is not the Vite entrypoint, but its direct situation reads were also updated to avoid leaving an unscoped alternate path in source.

### Implemented

- `src/App.tsx` now gates care pages on `ensureAnonymousSession()`. No account or email is required. Session setup errors are visible, retryable, and do not silently mint a replacement when a prior record ID exists without its bearer secret.
- `src/api/client.ts` sends the bearer capability on `getJSON`, `getBlob`, `postJSON`, `patchJSON`, and `postFormData`; it now deduplicates concurrent session bootstrap/refresh calls and returns the server-issued caregiver ID from `getCaregiverId()`.
- `src/components/CareCapture.tsx` uses `postJSON('/situation')`, so it now runs after the app session gate and carries the bearer token through the shared client.
- Direct `/api/situation` requests in `CognitiveWorkspace.tsx`, `workspace-context.tsx`, `CareRecipientNameGate.tsx`, `voice-controller/conversation-controller.ts`, and `ShareCareSummaryPanel.tsx` now send the bearer capability. The unsupported pause-as-POST call was replaced with a scoped GET of saved state.
- Care-recipient naming now uses `PATCH /api/situation`, which the FastAPI backend scopes to the current session.

## Legacy direct-fetch findings that remain

A repository search also found direct calls to legacy `/api/*` paths including `/api/extract`, `/api/share-intake`, `/api/track`, `/api/activation/*`, `/api/user/*`, `/api/policy/consent`, `/api/feedback`, `/api/research-feedback`, `/api/tts/synthesize`, `/api/care-journey/*`, `/api/care-contexts/dementia`, `/api/memory/reconstruct`, `/api/continuity-graph`, `/api/pattern-intelligence`, `/api/meetings`, and `/api/care-record/*`.

The current FastAPI app mounts `/api/situation` plus `/api/v1/*`; those legacy paths are not mounted by the inspected FastAPI `main.py`. The Vite build is configured to proxy `/api/*` to FastAPI, so these calls must not be treated as working endpoints merely because a UI component exists. They need a separate endpoint-by-endpoint decision: implement with explicit authentication and scope, or remove/disable the corresponding UI. This audit does not claim they are fixed.

## Verification status

- Source files were re-fetched after the commits to confirm the session gate and bearer headers are present.
- Backend capture → GET hydration → token refresh → GET rehydration tests were added.
- Frontend Vite build/tests and backend pytest suite have **not** been executed. GitHub returned no backend workflow runs/statuses for the commits; the frontend status endpoint reported Vercel build-rate-limit failures. The current execution environment cannot resolve `github.com` to clone the repositories and run the suites locally.
- Live Railway migration, deployed API behavior, and a browser-level capture/read/refresh run remain unverified.
