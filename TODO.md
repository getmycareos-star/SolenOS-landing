# SolenOS Frontend↔Backend Audit & Repair — TODO

## Goal
Fix Share button, unblock Scan/Snap/Upload workflow, add 5-stage status feedback.

## Frontend (SolenOS-landing → `C:\Users\me\solenos`)
- [x] 1. `src/components/mvp-workspace/capture/extract-attached.ts` — add AbortController timeout + human-readable timeout failure
- [x] 2. `src/components/mvp-workspace/AddSituationPanel.tsx` — functional Share flow (navigator.share + fallback + disclaimer), retry button for failed docs, stage feedback
- [ ] 3. `src/components/mvp-workspace/CognitiveWorkspace.tsx` — 5-stage submit flow (uploading→reading→extracting→creating→completed)
- [ ] 4. `src/components/mvp-workspace/ActivationOutputPanel.tsx` — render 5-stage status with progress

## Backend (SolenOS_backend → `C:\Users\me\_solenos_backend_cleanup`)
- [ ] 5. `src/lib/tika-extractor/index.ts` — bounded timeout, fail-fast when Tika not configured, reliable Tesseract config
- [ ] 6. `src/app/api/extract/route.ts` — bounded timeout + always-return human-readable note

## Verification
- [ ] 7. Frontend `npm run build` passes
- [ ] 8. Backend `npx tsc --noEmit` — only pre-existing errors (none from changes)
- [ ] 9. Report findings

## Rules
- No SolenOS_backup usage. Only SolenOS-landing + SolenOS_backend.
- No frontend↔backend file mixing. No new repos.
- No push until user approves.

