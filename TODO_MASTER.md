# SolenOS — Master Task List (merged from TODO.md files)

> Consolidated from `C:/Users/me/Desktop/TODO.md` and `C:/Users/me/solenos/TODO.md`.
> Sections retained verbatim so nothing is lost; each checkbox reflects actual
> implemented state as verified in code / by build.

---

## TASK 1 — Fix production client-side exception
- [x] Identify root cause: `useSearchParams()` without Suspense in `workspace/page.tsx`
- [x] Wrap workspace page in `<Suspense>` (verified in `src/app/workspace/page.tsx`)
- [x] Fix `displayName` hydration mismatch (useState + useEffect) (verified in code)
- [ ] Verify build passes

## TASK 2 — Fix accessibility landmark structure
- [x] OnboardingGate: change `<main>` → `<div>` (verified — uses `div.onboarding-shell`)
- [ ] Verify onboarding + app shell still work; build passes

## TASK 3 — Audit hydration safety
- [x] Fix `displayName` localStorage-during-render (verified — moved to useEffect)
- [x] Guard `CareContextBar` date formatting (undefined updatedAt) (verified — `mounted` + try/catch)
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

---

## SETTINGS RELEASE BLOCKER (from feedback)
- [x] Profile save persists (name/relationship/condition) + loads
- [x] Notifications toggles persist (localStorage)
- [x] Remove fake Security account controls (no auth → honest wording)
- [x] Legal contact support opens real email
- [x] Privacy: Clear local data clears ALL keys incl onboarding
- [x] Remove fake "Delete my data" (no account system) → disabled with explanation
- [x] Data training toggle persists
- [x] Product card shows real product info (not duplicate nav)

---

## TRUST, RETENTION & PRODUCT INTEGRITY AUDIT (release-blocking standard)

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

## MOBILE APP BUILD DIRECTIVE (structural/UX rebuild — required patterns)
- [ ] App shell: fixed bottom tab bar (Care Record | Timeline | Documents | Settings), icon + label, active underline, no dropdown/MENU
- [ ] Floating Action Button (fixed bottom-right above tab bar) opens Add bottom sheet
- [ ] Button system: Primary / Secondary / Icon (44x44) / Destructive; all with press states + loading
- [ ] Care Record home: header card (name, status pill, last updated), cards not paragraphs, FAB visible
- [ ] Timeline: vertical cards, tap-to-expand accordion animation (no page nav)
- [ ] Documents: grid/list of cards, tap opens preview with loading state
- [ ] Settings six cards: Profile / Notifications / Security / Legal / Privacy & Data / Product, every row a real button
- [ ] Profile card: no internal identifiers (Care Key / Session ID / Telemetry ID); editable care fields + Save
- [ ] Notifications card: real toggles (not broken session text), animate + persist immediately
- [ ] Security card: real account actions or honest disabled with explanation; supporting text for auth method
- [ ] Legal card: Terms / Privacy / Contact as real buttons; version static label
- [ ] Privacy & Data card: Clear local data (destructive + confirm), delete request, data-training toggle (off default), consent status read-only
- [ ] Product card: How It Works / About / Help / Capabilities / Founder's Story / Our Mission as Secondary buttons
- [ ] Empty state: "Your care record is ready." + "Add first record" / "Upload document"
- [ ] Motion & feedback on every screen (button press, 150–250ms transitions, loading states, toasts)

---

## WELCOME PAGE DERIVED TASKS
- [ ] Welcome content relocated out of app; first-time flow: welcome → consent → shell (single `onboarding_complete` flag)
- [ ] Reconnect or build privacy consent checkbox (report which case applied)
- [ ] Welcome screen cut to one screen/one job: wordmark → one line → one primary action
- [ ] Remove "How it works" link from welcome; single typography voice; trust signal near CTA
- [ ] Move welcome footer content into Settings (Legal + new Product card); keep safety disclaimer visible

