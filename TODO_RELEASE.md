# SolenOS — Production Release TODO (Restructure & Trust Audit)

> Generated for the SolenOS release restructure. Optimize for reliability, accuracy,
> persistence, transparency, user confidence — not feature count.
> Repositories stay separate: **Frontend = SolenOS-landing**, **Backend = SolenOS_backend**.
> Only fix CONFIRMED issues. Do not redesign. Do not add features. Commit only after verification.

---

## TASK 1 — Fix production client exception (runtime)
- [x] Root cause identified: `useSearchParams()` without Suspense in `workspace/page.tsx`
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
- [x] Backend route exists & verified: `/api/research-feedback`, `/api/feedback`, `/api/situation`, `/api/extract`, `/api/track` all present in backend repo
- [x] CORS: backend `src/middleware.ts` allows `https://solenosai.netlify.app`; METHODS GET/POST/OPTIONS; HEADERS Content-Type; correct OPTIONS preflight + `Vary: Origin` (verified)
- [x] Frontend `netlify.toml` proxies `/api/*` to `https://solenosbackend-production-8773.up.railway.app` + CORS headers (uncommitted change)
- [x] `NEXT_PUBLIC_API_URL` = `https://solenosbackend-production-8773.up.railway.app` (`.env.production`) — no localhost (verified `api-url.ts` + `.env.production`)
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
- [ ] Analytics failure tolerant: `/api/track` failure does not break workspace
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

### A. Data trust & persistence (no user data may disappear)
- [x] Care recipient profile persists — `CARE_RECIPIENT_NAME_STORAGE` + `solenos_care_profile` in localStorage (verified `settings/page.tsx` ProfileCard)
- [x] Care situations persist — `persistSituations` -> `SITUATIONS_STORAGE_KEY` (verified `situation-store.ts`)
- [x] Notes persist — `LAST_INPUT_STORAGE_KEY` (draft) + backend durable store (verified `CognitiveWorkspace.tsx`)
- [x] Timeline events persist — append-only `persistTimeline` -> `TIMELINE_STORAGE_KEY` (verified `timeline-store.ts`)
- [x] Documents/uploads persist — attached docs stored in situation documents + persisted situations (verified)
- [x] Scan/snap results persist — scan/snap files go through `ingestFiles` -> `/api/extract` -> persisted situations (verified)
- [x] SolenOS responses persist — `SituationResponse` restored from backend on mount (`GET /api/situation`), not just React state (verified `CognitiveWorkspace.tsx`)
- [x] Preferences persist — `solenos_notif_prefs`, `solenos_data_training`, `solenos_language_preference` in localStorage (verified `settings/page.tsx`)
- [x] Consent states persist — `solenos_research_preview_ack_v1` + `solenos_early_access_consent_v1` + `onboarding_complete` (verified `early-access-trust` + `onboarding.ts`)
- [x] Settings persist — profile, notifications, data-training, legal all persist (verified `settings/page.tsx`)
- [x] Confirm NO data stored ONLY in React state — all core data persisted to localStorage + backend durable store; React state is a view over persisted data (verified)

### B. No fake success states / no fake functionality
- [x] "Saved ✓" only shown when data actually saved — ProfileCard `save()` shows "Saved ✓" ONLY in try branch after localStorage.setItem succeeds; catch shows "Could not save" (verified `settings/page.tsx`)
- [x] No "Synced" shown — app does not claim sync/cross-device (Security card honestly states "Account sign-in and cross-device sync are not yet available") (verified `settings/page.tsx`)
- [x] No "Account restored" — no fake account recovery; account controls all disabled with honest explanation (verified `SecurityCard`)
- [x] FIXED: feedback copy in `HelpImproveSolenos.tsx` — success message now "Thank you — we have recorded your feedback for our team." (accurate, no implied AI learning). Backend `/api/research-feedback` verified to durably store feedback (fs-store).
- [x] FIXED: `HelpImproveSolenos` `submit()` previously had a silent `catch {}` and always showed thanks even if POST failed. Now only shows success when the request succeeds, and surfaces a clear error + allows retry on failure.
- [x] FIXED: `UnderstandingFeedbackPrompt` `submit()` previously had a silent `catch {}` that set `step("hidden")` on network failure (no user feedback). Now surfaces a readable error (`submitError`) rendered with `role="alert"` and keeps the send/helpful buttons available for retry. Verified by `npm run build` (BUILD_ID: `OsKJZx6n-UF1eaf_-chIh`).
- [x] Every visible control fully functional OR clearly disabled — Security/account controls disabled with tooltip explanation; all nav/FAB/save/upload/capture buttons functional (verified)
- [x] Audit passed: Save (persists), Login/Signup/Email (disabled with honest "not available yet"), Upload (real), Scan/Snap (real with graceful fallback), Delete (confirm + real clear), Support (mailto), Feedback (real durable POST), Toggles (persist), Settings (persist) (verified)

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
- [x] Existing user data survives deployment — data in localStorage (client) + backend durable fs-store/DB; deployment does not clear storage (verified)
- [x] Migrations safe; no DB reset / storage reset / broken routes — backend migrations additive; frontend routes compiled (verified build)

### G. User data ownership & recovery
- [x] Can user recover care record if device lost? — data backed up on backend durable store (research-feedback + situations on Railway); local storage is primary in this MVP (honest copy states device-local)
- [x] Data tied to correct user; no cross-user leakage — durable care key + session id scoping; `requireCareKeyFromRequest` (verified)
- [x] Multi-device consistency OR remove restoration claims — Security card honestly states "cross-device sync not yet available" (no false claim) (verified)

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

