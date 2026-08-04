# SolenOS Mobile App Rebuild — Task List

## Consent checkbox reuse finding
**FOUND and reconnected:** Existing `EarlyAccessConsentForm.tsx` (Terms + Privacy checkboxes) is wired into the first-time onboarding flow (`OnboardingGate.tsx`) behind a single `onboarding_complete` flag. No new checkbox was built.

---

## PHASE 1 — Button System (build first)
- [x] 1. Create reusable `Button` component with variants: Primary, Secondary, Icon, Destructive
- [x] 2. Primary: Default / Pressed (scale 0.97 + darker fill) / Disabled / Loading (inline spinner, same size)
- [x] 3. Secondary: outline, accent border, border shifts on press — same 4 states
- [x] 4. Icon: min 44x44px tap target, pressed scale 0.9 + tinted circle
- [x] 5. Destructive: dark/muted tone within palette, same structure as Primary
- [x] 6. Every button shows visible response within 100ms (CSS active state)

## PHASE 2 — App Shell (non-negotiable structure)
- [x] 7. Bottom tab bar: Care Record | Timeline | Documents | Settings (fixed, persistent)
- [x] 8. Active tab: filled icon + accent underline
- [x] 9. Tab switching: 150–250ms slide/fade transition (no reload)
- [x] 10. Floating Action Button (fixed bottom-right, above tab bar)
- [x] 11. FAB opens bottom sheet: Add Record / Upload / Capture / Share (real buttons)
- [x] 12. Delete top dropdown menu and inline "MENU" text control entirely (`AppShell.tsx` rewritten — no Menu/sidebar)

## PHASE 3 — Welcome Page / First-time sequence
- [x] 13. First-time sequence: welcome → privacy consent checkbox → app shell
- [x] 14. Single `onboarding_complete` flag (localStorage) checked on load
- [x] 15. Once complete, every future open goes straight to app shell (no welcome/back button/refresh/deep-link)
- [x] 16. Relocate welcome content to external marketing route (outside tab-bar app shell)
- [x] 17. Reconnect existing `EarlyAccessConsentForm` into first-time flow (DO NOT rebuild)
- [x] 18. Welcome visual redesign: wordmark → one value-prop line → one primary action
- [x] 19. Remove "How it works" from welcome screen (relocating to Product card)
- [x] 20. One typography voice (sans-serif only, drop serif/sans mismatch)
- [x] 21. Remove second footer entirely; relocate contents into Settings (Legal + Product cards)
- [x] 22. Safety disclaimer in own bordered/tinted block (distinct visual weight, existing palette)
- [x] 23. Add minimal trust signal near CTA (lock/shield icon or "Your data stays private")

## PHASE 4 — Care Record (home)
- [x] 24. Header card: person name, status pill (accent), "Last updated: [date]" — ALL REAL DATA from care context (never fabricated)
- [x] 25. Content below rendered as cards (not paragraphs)
- [x] 26. FAB visible on this screen

## RULE — NO FAKE DETAILS
- [x] 24a. Every displayed value (name, status, last-updated, counts) must come from real stored/context data. No hardcoded "Today", no invented names, no placeholder statuses. If data is absent, show a real empty state rather than fake content.

## PHASE 5 — Timeline
- [x] 27. Vertical timeline, each event a card (icon, timestamp, short label)
- [x] 28. Tap card to expand with accordion animation (not page navigation)

## PHASE 6 — Documents
- [x] 29. Grid/list of document cards: file-type icon, name, date
- [x] 30. Tap opens preview with loading state while opening

## PHASE 7 — Settings (six cards)
### Profile card
- [x] 31. Remove Care Key row entirely
- [x] 32. Remove Session ID row entirely
- [x] 33. Remove Telemetry ID row entirely
- [x] 34. Add editable fields: care recipient name, relationship, condition/stage context
- [x] 35. Primary "Save" button with loading → success ("Saved ✓")

### Notifications card
- [x] 36. Remove broken session text ("No active SolenOS session found...")
- [x] 37. Add animated toggle switches (care updates, reminders, weekly summary) — persist immediately, no Save step

### Security card
- [x] 38. Replace Session/Care Key rows; remove "Start new session" + "Copy care key"
- [x] 39. Add account buttons: Create account / Change password / Add-email / Delete account (Destructive + confirmation)
- [x] 40. Keep short auth-method line (email + password) as supporting text

### Legal card
- [x] 41. Terms / Privacy / Contact as real Secondary/Icon buttons (not plain links)
- [x] 42. Version number remains static label

### Privacy & Data card
- [x] 43. "Clear local data" — Destructive + confirmation ("This cannot be undone")
- [x] 44. "Delete my data" — separate Destructive button → request flow
- [x] 45. Data training preference — toggle, off by default, plain honest wording ("data is never sold")
- [x] 46. "Contact support to request deletion" — Secondary button
- [x] 47. "Read the Privacy Policy" — reuse Legal card action (no duplicate)
- [x] 48. Consent status — read-only row "Accepted on [date]" from `onboarding_complete`

### Product card
- [x] 49. Buttons: How It Works, About, Help, Capabilities, Founder's Story, Our Mission (Secondary, open content)
- [x] 50. Route each to existing content (no dead-end buttons, use existing copy)

## PHASE 8 — Empty state (Care Record with no entries)
- [x] 51. Title "Your care record is ready." / subtext "Start by adding information about the person you care for."
- [x] 52. Primary: "Add first record" / Secondary: "Upload document"

## PHASE 9 — Internal identifiers
- [x] 53. Ensure Care Key / Session ID / Telemetry ID never surface in user-facing UI (any screen)

## PHASE 10 — Motion & Feedback
- [x] 54. Button presses: scale + color (throughout)
- [x] 55. Screen/tab transitions: 150–250ms slide/fade everywhere
- [x] 56. Async actions: in-progress / success / error states on all uploads, saves, adds
- [x] 57. Toasts: brief, auto-dismiss, non-blocking
- [x] 58. Loading: skeleton or spinner (never blank screen)

## PHASE 11 — Verification
- [x] 59. Run SELF-CHECK (7 questions) — all pass
- [x] 60. Run FINAL ACCEPTANCE TEST (6 questions) — all pass
- [x] 61. Visually verify at mobile width 375–430px

---

## BUILD VERIFICATION (final)
- [x] `npx tsc --noEmit` — passes (EXIT:0)
- [x] `npm run build` — passes (EXIT:0). All routes compile: `/workspace`, `/workspace/timeline`, `/workspace/documents`, `/workspace/settings` + all public marketing routes.
- [x] mobile-app.css — 21.7KB with 107 class matches for all mobile UI components

