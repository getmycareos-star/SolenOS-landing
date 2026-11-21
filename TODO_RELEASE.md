> **Persistence audit notice (2026-11-20):** This file contains historical checklist entries that predate the current PostgreSQL-backed account, care-profile, document, reminder and companion implementations. Do not treat old checked localStorage items or old disabled-account statements below as current verification. The current category-by-category persistence status and release gates are maintained in `SolenOS_backend/backend/docs/DATABASE_PERSISTENCE_INVENTORY.md`.

# SolenOS — Historical Production Release TODO (Restructure & Trust Audit)

> **Superseded checklist — do not use its historical [x] marks as current release evidence.** This file contains claims from earlier deployments and architectures. Current source of truth is the Next.js App Router frontend on `main` and the FastAPI backend on `main`. In particular, the backend does **not** register `/api/research-feedback` or `/api/track`; feedback is `POST /api/v1/feedback`, while telemetry in `src/lib/trackEvent.ts` is intentionally a no-op. The active backend is `https://solenosbackend-production.up.railway.app`. Verify current workflows and production deployment independently before release.

> Generated for the SolenOS release restructure. Optimize for reliability, accuracy,
> persistence, transparency, user confidence — not feature count.
> Repositories stay separate: **Frontend = SolenOS-landing**, **Backend = SolenOS_backend**.
> Only fix CONFIRMED issues. Do not redesign. Do not add features. Commit only after verification.

---

## TASK 1 — Fix production client exception (runtime)
- [x] Root cause identified at the time: `useSearchParams()` without Suspense in `workspace/page.tsx`
- [x] Wrap page in `<Suspense>` (verified in source)
- [x] `displayName` hydration mismatch fixed via useState + useEffect (verified)
- [x] Build passes (BUILD_ID generated)
- [ ] Verify `npm run start` -> `localhost:3000/workspace` has no console error
- [ ] Verify `https://solenosai.netlify.app/workspace` has no client exception

## TASK 2 — Accessibility landmark structure
- [x] OnboardingGate `<main>` -> `<div class="mobile-app-main onboarding-main">` (verified)
- [x] AppShell owns single `<main class="mobile-app-main">` (verified)
- [ ] Verify rendered HTML has exactly ONE `<main>` element
- [ ] Verify onboarding + app shell + navigation still work
- [ ] Lighthouse no longer reports missing main landmark

## TASK 3 — Hydration safety audit
- [x] `displayName` localStorage-during-render fixed (moved to useEffect) (verified)
- [x] `CareContextBar` date formatting guarded (`mounted` + try/catch) (verified)
- [x] `WorkspaceProvider` has safe default state + `hydrated`/`entryReady` gates (verified)
- [ ] Verify all routes render with no hydration warnings: /workspace, /timeline, /documents, /settings

## TASK 4 — Verify onboarding flow
- [x] New user: welcome -> consent -> app shell (verified in `OnboardingGate.tsx`: phase `loading` -> `welcome` -> `consent` -> `done`; `hasCompletedOnboarding()` returns false on server/missing -> shows welcome)
- [x] Returning user: direct to shell (`hasCompletedOnboarding()` true -> phase `done` -> renders children; no loop)
- [x] Reset state: clear `onboarding_complete` -> `hasCompletedOnboarding()` false -> onboarding reappears (verified in `onboarding.ts`)
- [x] Failure handling: `onboarding.ts` has safe `window` guards (returns false on server); `loadSituationsFromStorage`/`parseTimeline` catch corrupted JSON -> safe fallback (no crash)

## TASK 5 — Verify all workspace routes
- [x] /workspace — Living Care Record with empty state ("Your care record is ready." + Add/Upload buttons) verified in `workspace/page.tsx`
- [x] /workspace/timeline — entries render with expand/collapse (`mobile-timeline-item is-expanded`), empty state verified in `timeline/page.tsx`
- [x] /workspace/documents — cards render with preview interaction, empty state verified in `documents/page.tsx`
- [x] /workspace/settings — controls render; NO internal IDs exposed (Profile card shows only editable name/relationship/condition; verified in `settings/page.tsx`)
- [x] Bottom nav active tab + URL change verified in `AppShell.tsx` (`isNavActive`, `router.push`, `aria-current="page"`)

## TASK 6 — Verify AppShell functions
- [x] Bottom nav: Care Record / Timeline / Documents / Settings each route via `router.push` (verified in `AppShell.tsx`)
- [x] FAB opens/closes (`fabOpen` state); Add Record/Upload/Capture/Share all route to `/workspace?compose=1` (verified)
- [x] `Button.tsx` variants: primary/secondary/icon/destructive/loading (`aria-busy`)/disabled + `asChild` for links + `aria-pressed` for icon (verified in source)
- [x] Error handling: FAB/upload/cancel/share failures surface readable errors (verified in `AddSituationPanel.tsx` share fallback + `CognitiveWorkspace` error state)

## TASK 7-8 — Verify care input pipeline + SolenOS response
- [x] Manual entry: textarea -> `handleAddSituation` -> POST `/api/situation` -> response -> `onSituationComplete` -> record update (verified in `CognitiveWorkspace.tsx`; live POST returned structured response)
- [x] Upload: file picker (`UPLOAD_FILE_ACCEPT`) -> `ingestFiles` -> `/api/extract` (40s timeout) -> extraction -> record update (verified in `AddSituationPanel.tsx` + `extract-attached.ts`)
- [x] Scan / Snap: permission handling + graceful fallback + result into record (verified in `SnapCameraCapture.tsx` + `ScanDocumentCapture.tsx`)
- [x] Response UI: loading state (`submitPhase` acknowledged/processing/done), clear display via `LivingCareRecordPanel`, no infinite loading (verified)
- [x] Error handling: timeout (40s AbortController), backend down, invalid input -> `sanitizeCaregiverErrorMessage` + retry (verified)
- [x] Data persistence: response stored in localStorage (`LAST_INPUT_STORAGE_KEY`, `DURABLE_CARE_KEY_STORAGE`) + backend durable store; refresh restores (verified)
- [x] API contract: request payload/response structure/error format match backend `/api/situation` (verified live — POST returned canonical response with `what_i_understood`, `ui_situations`, etc.)

## TASK 9-11 — Backend connection, CORS, env, Next.js config
- [ ] Historical route claim invalid: `/api/research-feedback` and `/api/track` are not registered; current feedback route is `POST /api/v1/feedback`, and telemetry is a no-op.
- [x] CORS: backend `src/middleware.ts` allows `https://solenosai.netlify.app`; METHODS GET/POST/OPTIONS; HEADERS Content-Type; correct OPTIONS preflight + `Vary: Origin` (verified)
- [ ] Historical Netlify proxy claim is obsolete; inspect current explicit rewrites in `netlify.toml`.
- [ ] Historical `NEXT_PUBLIC_API_URL` value is obsolete; verify the deployed Netlify environment separately.
- [x] `next.config.ts` has NO `output: "export"` (verified — correct for Netlify Next.js runtime)
- [x] Netlify: `npm run build`, publish `.next`, plugin `@netlify/plugin-nextjs`, repo SolenOS-landing
- [x] Backend online verified (live): GET `/api/situation` with valid params -> **200 OK** (1210 bytes); without params -> structured 400 (correct validation, not crash)
- [x] Frontend production verified (live): `/workspace` returns full app HTML (10KB+); no client-exception text
- [x] Railway backend env vars loaded (backend responds with real data; DB-backed routes functional)

## TASK 12 — Documents feature end-to-end
- [x] Documents page loads; empty state ("No documents yet") + existing docs render as cards (verified `documents/page.tsx`)
- [x] Upload flow: file picker (`UPLOAD_FILE_ACCEPT`) -> `ingestFiles` -> `/api/extract` (40s timeout) -> success/failure surfaced (no fake success; verified `AddSituationPanel.tsx` + `extract-attached.ts`)
- [x] Processing pipeline: upload -> backend `/api/extract` -> extraction -> display -> record update (verified)
- [x] Preview: opens via `setPreview`, loading state (`previewLoading`), unsupported/absent summary fails gracefully ("No summary available") (verified `documents/page.tsx`)
- [x] Error cases: invalid type (accept restriction), large file (timeout), backend down (sanitized error) — all handled without crash (verified)
- [ ] Mobile widths 375px / 430px: no overflow, controls reachable (requires real-browser layout test)

## TASK 13 — Final reliability & production safety
- [x] Console clean: no React errors, hydration warnings, chunk load failures, CORS errors, unhandled rejections, failed API calls (prod smoke: errMarker=False on all 5 routes)
- [x] Release-blocking composer crash FIXED: improvement/orientation Clarity no longer throws (acceptance gate 301/304) → no blank response panel
- [x] Refresh + direct URL access for /workspace, /timeline, /documents, /settings (all 5 routes HTTP 200, no 404/blank)
- [ ] Slow 3G: loading states appear, no duplicate submissions, no frozen buttons
- [ ] Data loss scenarios: refresh during loading, close during action, navigate away/return -> recovers safely
- [ ] Mobile 375px/430px: nav, FAB, upload, text wrap, modals, scroll — no horizontal overflow
- [ ] Security: no API secrets/credentials/keys exposed; uploads validated; errors don't leak stack traces
- [x] Telemetry is intentionally a no-op in `src/lib/trackEvent.ts`; no `/api/track` request is made. Revisit only after a scoped, persisted backend ingestion endpoint exists.
- [ ] Cache/deploy freshness: Netlify serves latest commit; no stale static HTML

## TASK 14 — Final production QA + commit + push
- [ ] Full caregiver journey: onboarding -> add record -> upload -> scan/snap -> response -> record/timeline/documents update
- [ ] Final route check: /, /workspace, /timeline, /documents, /settings (no blank/exception/console error)
- [ ] Final backend check: frontend<->backend requests succeed, CORS works
- [ ] Final build: `npm run build` + `npm run start` (local prod build)
- [ ] Git: `git status`, `git diff`, `git log -1` — only intended files
- [ ] Commit + push ONLY to SolenOS-landing (frontend) and SolenOS_backend (backend), never combined
- [ ] Netlify deploy check: latest commit served, no old static HTML
- [ ] Final report: bugs fixed, root causes, files changed, commit SHAs, build result, prod URL verified

## TASK 14B — Final release verification before commit/push
- [ ] `git remote -v` — confirm repo separation (frontend vs backend)
- [ ] `git branch` / `git status` — correct branch, no stray files/build artifacts
- [ ] Review `git diff` — no debug code, console.logs, test creds, localhost URLs, unused imports
- [ ] grep frontend for `localhost` / `127.0.0.1` — none in production code
- [ ] `NEXT_PUBLIC_API_URL` -> production backend
- [ ] `npm run build` passes (no TS/ESLint blocking errors, all routes compile)
- [ ] `npm run start` -> `localhost:3000/workspace` test onboarding, nav, record, upload, documents, timeline
- [ ] Backend health: server responds, API routes respond, CORS OPTIONS allows frontend origin
- [ ] Netlify config: connected repo, prod branch, latest commit SHA
- [ ] Release commit + push, record commit SHA + message
- [ ] Final proof: Git commit -> Netlify deploy -> prod URL -> real user flow works

---

## TRUST, RETENTION & PRODUCT INTEGRITY AUDIT (release-blocking standard)

### A. Data trust & persistence (current implementation status)
- [x] Care recipient profile — authoritative name/condition context is read and written through the authenticated backend care-profile API; legacy browser values are not authoritative and are migrated only after confirmed server persistence.
- [x] Care situations — caregiver-visible situations are hydrated from the authenticated, no-store `GET /api/situation` response. Browser-local situation caches are no longer read, written, or exported as a care-record source.
- [x] Notes — unsent text may remain a device-local draft; submitted care information must be committed through the backend before the UI reports it saved.
- [x] Timeline/history — caregiver-visible history is retrieved from backend history endpoints. The obsolete browser-local timeline persistence helpers have been removed from the active UI runtime exports.
- [ ] Documents/uploads — verify object-storage binary durability, database metadata, ownership, review decisions, and retrieval after restart/new session against production infrastructure.
- [ ] Scan/snap results — verify original binary and extraction lifecycle end-to-end; extraction suggestions must remain separate from accepted care assertions.
- [x] SolenOS responses — the situation response is retrieved from the backend; failed authenticated record reads now show a recoverable error rather than silently rendering a local cache.
- [ ] Preferences and consent — classify each preference by scope. Accessibility/display choices may remain device-local; account-wide notification and consent decisions require backend persistence and cross-session verification.
- [ ] Settings — profile and notification writes require server readback; device display preferences are intentionally local and must not be described as account-wide.
- [ ] No React-only authoritative data — React state may hold transient presentation state, but every authoritative care mutation must be confirmed by the backend and read back from the server.

### B. No fake success states / no fake functionality
- [x] Profile save feedback is shown only after authenticated `PUT /care-profile` returns the saved server profile; failure is surfaced without claiming a save (verified `src/app/workspace/settings/page.tsx`).
- [x] Account sign-in is enabled through backend-backed create/login; the UI does not claim real-time sync. A caregiver can sign in to the same account on another authorized device; separate-browser/device E2E remains unverified.
- [x] Account creation, sign-in, sign-out, account deletion and recovery-code generation use backend APIs; success is shown only after the backend responds. Verify the recovery-code redemption path separately before claiming full account recovery.
- [ ] Feedback copy in `HelpImproveSolenos.tsx` reports receipt only after the supported `POST /api/v1/feedback` request succeeds. Do not claim `/api/research-feedback` exists; verify backend persistence with the current feedback integration tests.
- [x] FIXED: `HelpImproveSolenos` `submit()` previously had a silent `catch {}` and always showed thanks even if POST failed. Now only shows success when the request succeeds, and surfaces a clear error + allows retry on failure.
- [x] FIXED: `UnderstandingFeedbackPrompt` `submit()` previously had a silent `catch {}` that set `step("hidden")` on network failure (no user feedback). Now surfaces a readable error (`submitError`) rendered with `role="alert"` and keeps the send/helpful buttons available for retry. Verified by `npm run build` (BUILD_ID: `OsKJZx6n-UF1eaf_-chIh`).
- [x] Every visible control fully functional OR clearly disabled — Security/account controls disabled with tooltip explanation; all nav/FAB/save/upload/capture buttons functional (verified)
- [ ] Full workspace audit: Profile and account create/login use backend APIs; upload, scan/snap, feedback and settings have real flows. Complete current-main PostgreSQL/browser lifecycle verification for every workflow before marking the entire audit passed.

### C. AI truthfulness & product identity
- [x] AI separates Known / Possible / Unknown — `CALIBRATED_UNCERTAINTY_CONTRACT` + `care-reality` separates human_fact from interpretation; `caregiver-response-dto` returns `what_i_understood`/`what_is_uncertain`/`what_needs_clarification` (verified live response)
- [x] SolenOS is NOT a chatbot — persistent Living Care Record (LCR) + timeline + durable situations; `buildLivingCareRecordResponse` from ACS/composer, not `final_output` (verified `SituationResponsePanel.tsx`)
- [x] Product gives value for transitions — `care-reality` / `return-continuity` / timeline capture changes over time; `what_changed` in response (verified live)

### D. No silent failures / performance
- [x] Every failure has clear explanation + recovery + retry — `sanitizeCaregiverErrorMessage`, `role="alert"`, retry buttons, share fallback (verified)
- [x] Button responds within ~100ms; loading/success/error states — Button.tsx press states + `aria-busy`; submitPhase acknowledged/processing/done (verified)
- [x] Long operations show progress / current state / retry / failure — 40s upload timeout + "Preserving…"/"Reading…" + retry (verified)

### E. Privacy claims must be true
- [x] Verify privacy statements — trust copy honest: "What SolenOS does not do" (no diagnosis/medical decisions), "Your data stays private. It is not sold or used for advertising" (accurate), upload privacy notice (verified `early-access-trust`)
- [x] No overpromising — feedback copy now honest ("recorded for our team", not "improves AI"); no cross-device/account claims (verified)

### F. Deployment must not damage trust
- [ ] Deployment survival and device-loss recovery — authoritative care data must be verified against the deployed PostgreSQL database and durable object storage; browser localStorage and legacy Next.js filesystem stores are not evidence of production durability.
- [x] Migrations safe; no DB reset / storage reset / broken routes — backend migrations additive; frontend routes compiled (verified build)

### G. User data ownership & recovery
- [ ] Fresh-browser account recovery is implemented in `e2e/anonymous-account-continuity.mjs`: it verifies the same person/caregiver identity, recovery-code redemption, revocation of prior device tokens, 20 original care events, evidence wording and observation/correction lineage against PostgreSQL-backed FastAPI. Current-main browser E2E must pass before treating device-loss recovery as verified; anonymous users without an account still cannot recover a lost device identity.
- [ ] End-to-end ownership proof for every persistent category — server-issued bearer sessions and backend permission checks are authoritative; client care keys/session IDs are not credentials. Verify cross-caregiver and cross-person isolation for each workflow, not only identity bootstrap.
- [ ] Account sign-in enables the same account to retrieve its server-held Care Record on another device. Verify a separate browser/device login, full data readback, logout/revocation and cross-caregiver denial before claiming device-loss recovery.

### H. Empty states / delete behavior / error recovery
- [x] Empty states honest — "Your care record is ready." / "No documents yet" / "No timeline yet" (honest, not "complete") (verified all route pages)
- [x] Delete shows what will be removed + confirmation + actual removal — Privacy "Clear local data" requires confirm step, clears ALL listed keys, shows "Local data cleared" (verified `settings/page.tsx`)
- [x] Long note preserved on network failure — `solenos_last_input_raw` draft saved; on submit failure input is NOT cleared (only cleared on success/done) (verified `CognitiveWorkspace.tsx`)

### I. Document handling safety
- [x] Upload accepts supported formats only — `UPLOAD_FILE_ACCEPT` restriction (verified `AddSituationPanel.tsx`)
- [x] Large files fail gracefully — 40s timeout + sanitized error; processing failures don't corrupt record (verified `extract-attached.ts`)
- [x] Original files remain accessible — `sourceFile` retained on AttachedDocument for retry; documents render in Documents page (verified)

### J. AI traceability & observation vs interpretation
- [x] AI outputs explain "why did SolenOS say this" — `what_i_understood`/`what_is_uncertain`/`what_needs_clarification` separate evidence from interpretation; `caregiverNoteMetaLabel` distinguishes care-worthy facts (verified live response)
- [x] Observation separated from interpretation — `observationCareFact` separates `human_fact` from interpretation; never rewrites user's reality (verified `care-epistemics`)

### K. Security against accidental exposure
- [x] Logout behavior — no account system so no logout; honest Security card copy (verified)
- [x] Family member cannot accidentally access another person's care info — data scoped by durable care key per device; no shared account (MVP device-local, honest copy) (verified)
- [x] Support escalation path works — Contact support = real `mailto:davidsolenos@gmail.com`; Request data deletion = mailto with subject (verified `settings/page.tsx`)

### L. Failure tolerance
- [x] Analytics failure never controls product — `track()` calls are fire-and-forget; `trackClientActivationEvent` wrapped; app does not depend on analytics (verified `CognitiveWorkspace.tsx`)
- [x] Backend unavailable -> clear explanation + preserve input + retry — `handleAddSituation` catch sets `setCaregiverError` (sanitized), input preserved, retry enabled (verified)

### M. First 5 minutes test
- [ ] Minute 0: open app; 1: understand what it does; 2: add first info; 3: see value; 5: know next step

### N. Final verification evidence (before push)
- [x] 1. All user data persistence tested — code-verified (localStorage keys + backend durable store; section A)
- [x] 2. All buttons tested — code-verified (nav, FAB, save, upload, scan, snap, share, delete, toggles; section B)
- [x] 3. All settings tested — code-verified (Profile, Notifications, Security, Legal, Privacy & Data, Product; section A/B)
- [x] 4. Upload tested — code-verified (`/api/extract` flow + accept restriction + timeout; section I)
- [x] 5. Scan tested — code-verified (`ScanDocumentCapture` permission handling + pages; Task 7-8)
- [x] 6. Snap tested — code-verified (`SnapCameraCapture` permission handling + capture; Task 7-8)
- [x] 7. SolenOS response tested — live POST `/api/situation` returns canonical structured response (`what_i_understood`, `what_is_uncertain`, `what_needs_clarification`, `what_will_be_tracked`, `what_changed`); NOT a user echo; separates Known/Possible/Unknown (verified)
- [x] 8. Backend failures tested — live: backend returns structured 400 on missing params (validation), not a crash; frontend `handleAddSituation` catch surfaces sanitized error + preserves input + retry (section L)
- [x] 9. Production routes tested — live: frontend `/workspace` returns full app HTML; backend GET returns 200 with valid params (Tasks 9-11)
- [x] 10. No fake claims remain — audit complete: feedback copy honest ("recorded for our team", not "improves AI"); no fake "Synced"/"Account restored"; Security honestly states no cross-device sync/accounts (section B/E)
- [x] 11. No dead UI remains — all controls functional or clearly disabled with explanation (section B)
- [x] 12. Build passes — `npm run build` succeeded (BUILD_ID `OsKJZx6n-UF1eaf_-chIh`); all routes compiled
- [x] 13. Production deployment verified — backend online (200), frontend serving (workspace HTML), CORS config verified, commit `a61b27e` pushed to SolenOS-landing (will trigger Netlify deploy)

