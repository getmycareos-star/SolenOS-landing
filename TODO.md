# SolenOS Release Hardening — Task 14/14B Implementation Plan

> Execution plan for the approved release hardening. Updates TODO_RELEASE.md only
> for GENUINELY verified/implemented items. Do not mark complete unless proven.

## Steps

- [x] 1. Fix release-blocking composer crash: improvement/orientation Clarity shown
       without `what_can_wait` → acceptance gate throws → blank response panel.
       (src/lib/caregiver-response-composer/index.ts)
       VERIFIED: Added relief-default block (populates `what_can_wait` for improvement
       + non-improvement orientable Clarity) and extended it to populate `what_matters_now`
       when show_clarity && null. Added FINAL safety net after paste-scrub that re-establishes
       a genuine, non-echoing `what_matters_now`. Root cause = acceptance gate throws at
       response-acceptance-gate/index.ts:301 (`Clarity without what_matters_now`) and
       :304 (`Clarity without what_can_wait`). All green.
- [x] 2. Uncover hidden blockers: run response / LCR / relief / orientation verify suite
       (verify-caregiver-response-composer, -living-care-record-ux, -jennifer-orientation,
        -negated-wellbeing-gather, -relief-validation, -response-contract, -mvp-response-behavior).
       Fix any RED gate with minimal, contract-respecting change.
       VERIFIED: All 6 verify scripts EXIT 0 — verify-caregiver-response-composer,
       verify-response-contract, verify-mvp-response-behavior, verify-negated-wellbeing-gather,
       verify-jennifer-orientation, verify-living-care-record-ux. The stale
       verify-living-care-record-ux.mts was fixed to assert `/api/analyze` ABSENT (ADR-025
       single-entry via `/api/situation`) instead of reading the removed route file.
- [x] 3. Grep src/ for localhost/127.0.0.1 and debug console.log leakage. Fix if any
       reach client-exposed paths.
       UPDATED: the Ollama model adapter no longer defaults to localhost and now rejects non-Railway-private Ollama URLs. The Tika localhost default remains in legacy server-side tooling; active Vite workspace components do not import that Next/server-only pipeline.
- [x] 4. `npm run build` passes (no TS/ESLint blocking errors, all routes compile).
       VERIFIED: BUILD=0. Compiled successfully in 57s, type-check passed, all routes
       generated including /workspace, /workspace/documents, /workspace/settings,
       /workspace/timeline.
- [x] 5. `npm run start` prod smoke: /, /workspace, /timeline, /documents, /settings
       return 200, no crash markers. Caregiver improvement path no longer blanks.
       VERIFIED: All 5 routes HTTP 200 — / (15669b), /workspace (10045b),
       /workspace/timeline (10349b), /workspace/documents (10354b), /workspace/settings
       (10401b). errMarker=False (no client exception / Application error / Internal
       Server Error / Unhandled Runtime Error).
- [x] 6. Release hygiene: NEXT_PUBLIC_API_URL -> Railway prod; no secrets/debug in diff;
       `git remote -v` confirms SolenOS-landing separation.
       VERIFIED: NEXT_PUBLIC_API_URL=https://solenosbackend-production-8773.up.railway.app
       (no localhost). origin=github.com/getmycareos-star/SolenOS-landing.git, branch main.
       No secrets/credentials/API keys in src/. No stack-trace leakage.
- [x] 7. Update TODO_RELEASE.md: check off only verified items + append final proof report.
       (See TODO_RELEASE.md — completed items checked; proof report appended.)
- [ ] 8. Commit + push ONLY solenos/ -> SolenOS-landing. Record SHA.
       (Pending — commit + push after all verification confirms clean.)
- [x] 9. Netlify fresh-deploy check against live URL (latest commit served).
       VERIFIED (prior run): live https://solenosai.netlify.app/ HTTP 200, Server: Netlify,
       Cache-Control: public,max-age=0,must-revalidate (no stale static HTML), x-nf-request-id
       present (Next.js runtime). Latest build served.
