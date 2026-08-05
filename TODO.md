# SolenOS Production Release — Task List

## TRUST, RETENTION & PRODUCT INTEGRITY AUDIT (release-blocking standard)
> Every item below is a release blocker. Only fix CONFIRMED issues. Do not redesign. Do not add features. Commit only after verification. Push only the correct repo.

### A. Data trust & persistence (no user data may disappear)
- [ ] Verify care recipient profile persists across refresh / browser restart / new session
- [ ] Verify care situations persist
- [ ] Verify notes persist
- [ ] Verify timeline events persist
- [ ] Verify documents / uploads persist
- [ ] Verify scan / snap results persist
- [ ] Verify SolenOS responses persist
- [ ] Verify preferences persist
- [ ] Verify consent states persist
- [ ] Verify settings persist
- [ ] Confirm no data is stored ONLY in React state (state-only = defect)

### B. No fake success states / no fake functionality
- [ ] "Saved ✓" only shown when data actually saved
- [ ] No "Synced" shown unless synchronization happened. make it happen
- [ ] No "Account restored" (no account recovery exists).
- [ ] No "feedback improves SolenOS AI" unless real feedback system. fix it
- [ ] Every visible control is fully functional OR clearly disabled with explanation
- [ ] Audit: Save, Login, Signup, Email, Upload, Scan, Snap, Delete, Support, Feedback, Toggles, Settings

### C. AI truthfulness & product identity
- [ ] AI separates Known / Possible / Unknown; never fabricates meds, diagnoses, dates, providers
- [ ] SolenOS is NOT a chatbot — verify memory layer / longitudinal record value
- [ ] Product gives value for: new symptoms, med changes, doctor visits, hospital transitions, handoffs

### D. No silent failures / performance
- [ ] Every failure has clear explanation + recovery action + retry option
- [ ] Button responds within ~100ms; loading/success/error states
- [ ] Long operations show progress / current state / retry / failure message

### E. Privacy claims must be true
- [ ] Verify every privacy statement (storage, access, deletion, AI training, consent)
- [ ] No overpromising

### F. Deployment must not damage trust
- [ ] Existing user data survives deployment
- [ ] Migrations safe; no DB reset; no storage reset; no broken routes

### G. User data ownership & recovery
- [ ] Can user recover care record if device lost? (backup mechanism)
- [ ] Data tied to correct user; no cross-user leakage
- [ ] Multi-device consistency (or remove cross-device restoration claims)

### H. Empty states / delete behavior / error recovery
- [ ] Empty states honest (no "care history complete" when empty)
- [ ] Delete shows what will be removed + confirmation + actual removal
- [ ] Long note preserved on network failure (draft preservation / retry)

### I. Document handling safety
- [ ] Upload accepts supported formats only; clear errors for unsupported
- [ ] Large files fail gracefully; processing failures don't corrupt records
- [ ] Original files remain accessible; never silently discard uploads

### J. AI traceability & observation vs interpretation
- [ ] AI outputs explain "why did SolenOS say this" (source, confidence)
- [ ] Observation separated from interpretation; never rewrite user's reality

### K. Security against accidental exposure
- [ ] Logout behavior, back-button after logout, cached pages, shared device
- [ ] Family member cannot accidentally access another person's care info
- [ ] Support escalation path works (contact support / report problem / get help)

### L. Failure tolerance
- [ ] Analytics failure never controls product (app works if tracking fails)
- [ ] Backend unavailable → clear explanation + preserve input + retry (not "Application error")

### M. First 5 minutes test
- [ ] Minute 0: open app; 1: understand what it does; 2: add first info; 3: see value; 5: know next step

### N. Final verification evidence (before push)
- [ ] 1. All user data persistence tested
- [ ] 2. All buttons tested
- [ ] 3. All settings tested
- [ ] 4. Upload tested
- [ ] 5. Scan tested
- [ ] 6. Snap tested
- [ ] 7. SolenOS response tested
- [ ] 8. Backend failures tested
- [ ] 9. Production routes tested
- [ ] 10. No fake claims remain
- [ ] 11. No dead UI remains
- [ ] 12. Build passes
- [ ] 13. Production deployment verified

---

## TASK 1 — Fix production client-side exception
- [x] Identify root cause: `useSearchParams()` without Suspense in `workspace/page.tsx`
- [ ] Wrap workspace page in `<Suspense>`
- [ ] Fix `displayName` hydration mismatch (useState + useEffect)
- [ ] Verify build passes

## TASK 2 — Fix accessibility landmark structure
- [ ] OnboardingGate: change `<main>` → `<div>` (AppShell owns single main landmark)
- [ ] Verify onboarding + app shell still work; build passes

## TASK 3 — Audit hydration safety
- [ ] Fix `displayName` localStorage-during-render
- [ ] Guard `CareContextBar` date formatting (undefined updatedAt)
- [ ] Verify all routes: /workspace, /timeline, /documents, /settings

## TASK 4 — Verify onboarding flow
- [ ] New user (welcome → consent → shell)
- [ ] Returning user (direct to shell)
- [ ] Reset state (clear flag → onboarding again)
- [ ] Failure handling (missing/corrupted storage → safe fallback)

## TASK 5 — Verify all workspace routes
- [ ] /workspace, /timeline, /documents, /settings load + no errors

## TASK 6 — Verify AppShell functions
- [ ] Bottom nav, FAB, button variants, error handling

## TASK 7-8 — Verify care input pipeline + response
- [ ] Manual entry, upload, scan, snap → backend → response → record update

## TASK 9-11 — Verify backend connection, CORS, env, Next.js config
- [ ] Backend online, CORS correct, API reachable
- [ ] No localhost refs; NEXT_PUBLIC_API_URL correct
- [ ] No `output: "export"`; correct Netlify/Railway config

## TASK 12 — Verify documents feature end-to-end
- [ ] Page, upload, preview, error handling, mobile widths

## TASK 14-15 — Final reliability, QA, commit, push
- [ ] Console clean, refresh/direct URL, slow network, mobile
- [ ] Security basics, analytics failure tolerance, cache freshness
- [ ] Full journey test
- [ ] Commit + push frontend (SolenOS-landing) only
- [ ] Verify Netlify deployed latest commit

## SETTINGS RELEASE BLOCKER (from feedback)
- [x] Profile save persists (name/relationship/condition) + loads
- [x] Notifications toggles persist (localStorage)
- [x] Remove fake Security account controls (no auth → honest wording)
- [x] Legal contact support opens real email
- [x] Privacy: Clear local data clears ALL keys incl onboarding
- [x] Remove fake "Delete my data" (no account system) → disabled with explanation
- [x] Data training toggle persists
- [x] Product card shows real product info (not duplicate nav)
