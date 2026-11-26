# Caregiver information architecture — execution ledger

Status vocabulary: **Not started**, **In progress**, **Implemented, not yet verified**, **Verified**, **Blocked**.

This ledger is deliberately conservative. A source change, static assertion or queued CI run is not equivalent to verified browser behaviour.

| Workstream | Requirement | Status | Evidence / remaining verification |
|---|---|---|---|
| Phase 0 | Inventory every App Router page, handler and workspace route | Implemented, not yet verified | Route inventory document and regression script enumerate 39 pages and five handlers; run the script in CI |
| Phase 0 | Map route ownership and legacy/disabled routes | Implemented, not yet verified | Route ownership table; `/settings`, `/workspace/record`, `/workspace/continuity` and disabled Community decisions are source-checked |
| Phase 0 | Map every page's API dependencies and state lifecycle | In progress | Core workspace routes inspected; endpoint-by-endpoint dependency map and per-route permission audit remain |
| Phase 0 | Verify route-level permissions and shared-record access | In progress | Workspace layout/session bootstrap inspected; backend authorization remains authoritative; direct-access role matrix and shared-record browser tests remain |
| Phase 1 | Establish caregiver-facing page ownership | Implemented, not yet verified | Canonical labels and destination hierarchy are in `workspace-navigation.ts`; verify rendered labels |
| Phase 1 | Preserve legacy URLs and safe redirects | Implemented, not yet verified | `/workspace/record` and `/workspace/continuity` now redirect to Care information; `/settings` retains Settings; browser redirect and care-recipient-context tests remain |
| Phase 2 | Shared desktop navigation configuration | Implemented, not yet verified | One navigation module owns primary, Care information and More destinations |
| Phase 2 | Expandable Care information hierarchy and correct active states | Implemented, not yet verified | Parent/child links, active route matcher, accessible expanded state and breadcrumb ownership added |
| Phase 2 | Mobile Home/Care/Ask/More navigation | Implemented, not yet verified | Four-item bottom navigation and separate Add an update action added with safe-area CSS |
| Phase 2 | Persistent Notifications control and unread count | Implemented, not yet verified | Authenticated unread-count request, identity-change invalidation, read-state refresh event and badge added |
| Phase 2 | Preserve filters/search on Care history return | Implemented, not yet verified | Filter and query are represented in the URL; verify browser back/forward behaviour |
| Phase 3 | Home shows concise current care picture and next useful action | Implemented, not yet verified | Home uses the compact `today` projection; Care information retains the complete projection |
| Phase 3 | Home actions are based on current server state | In progress | Existing record-aware next-step logic is present; verify every branch against real backend states and empty/error responses |
| Phase 3 | Home recent activity and upcoming care hierarchy | In progress | Upcoming appointment summary remains; confirm recent activity is not duplicated or omitted |
| Phase 4 | Add an update offers clear contribution choices | Implemented, not yet verified | Capture choices are visible; existing specialised capture components retained |
| Phase 4 | Medical document upload is discoverable from Add an update | Implemented, not yet verified | Persistent Upload a medical document action links to existing Documents workflow |
| Phase 4 | Contribution completion/review feedback and provenance | In progress | Existing capture and approval workflows retained; full browser trace from submission through accepted record state remains |
| Phase 5 | Separate Care information from Care history | Implemented, not yet verified | Current-care overview and historical timeline have separate route ownership |
| Phase 5 | Preserve event time, recorded time and correction history | In progress | Existing timeline fields inspected; verify all event types and correction/withdrawal ordering |
| Phase 5 | Never substitute a saved timestamp for a missing event time | Implemented, not yet verified | Timeline mapping preserves missing event time and labels the saved time separately; static contract added |
| Phase 5 | Open the exact original document from a document-backed history entry | Implemented, not yet verified | Timeline links by evidence event ID; Documents resolves the exact saved file and validates same-origin return context |
| Phase 5 | Prevent stale document previews from crossing caregiver or recipient changes | Implemented, not yet verified | Preview requests are sequence- and identity-scoped; source deep links include active caregiver/recipient scope |
| Phase 5 | Link document-backed history entries to original documents | Implemented, not yet verified | Timeline source link and Documents `evidenceId` auto-open path added; browser source retrieval remains unverified |
| Phase 5 | Surface evidence-supported patterns and changes without duplication | In progress | Complete Care information projection retains detailed information; verify pattern ownership and avoid duplicated panels |
| Phase 5 | Expose real document processing and review lifecycle | In progress | Existing processing and review components retained; validate every backend status and failure/retry path |
| Phase 6 | Separate Notifications from Needs attention | Implemented, not yet verified | Dedicated Notifications route; notification read endpoint remains separate from open-loop state |
| Phase 6 | Reading a notification never resolves a care matter | Implemented, not yet verified | Separate write contracts and regression assertions added; run integration and browser tests |
| Phase 6 | Reminders remain distinct from unresolved matters | Implemented, not yet verified | Reminders page title and navigation label separated from Needs attention |
| Phase 6 | Distinguish matters marked for attention now from important non-immediate matters | Implemented, not yet verified | Needs attention page now preserves the backend assessment categories as separate sections and card labels; duplicate sources prefer the higher-priority category |
| Phase 7 | More contains application/account management, not duplicate care browsing | Implemented, not yet verified | More now contains Settings only; incoming responsibility handovers are placed in Care handoffs; verify rendered access and permissions |
| Phase 8 | Consistent contextual breadcrumbs | Implemented, not yet verified | Home → Care information → child route and Home → More → Settings trails added |
| Phase 8 | Preserve relevant search/filter context across source review | Implemented, not yet verified | Care history query/filter URL state and source-document deep link added; initial history load is guarded against duplicate requests; browser history verification remains |
| Phase 8 | Preserve document-source navigation context without leaking stale return paths | Implemented, not yet verified | Documents accepts only same-origin Care history return paths and clears stale return state on direct entry; browser source-preview journey added |
| Phase 8 | Isolate Care history, Reminders, Needs attention, Appointments and Care handoffs across recipient switches | Implemented, not yet verified | Identity changes clear recipient-specific views; request sequences and scoped mutation guards prevent stale responses and feedback from repopulating another record |
| Phase 8 | Isolate Notifications inbox, unread count and preferences by active care recipient | Implemented, not yet verified | Feed, read actions, preference reads/writes and global unread indicator refresh on recipient changes; static contract added |
| Phase 9 | Consistent page headers and page structure | In progress | Navigation, breadcrumb and mobile shell are unified; specialised page header patterns still need a full consistency pass |
| Phase 9 | WCAG 2.2 AA accessibility | In progress | Landmark nesting and a keyboard skip link with a focusable main target are implemented; keyboard, screen-reader, contrast and zoom verification remain |
| Phase 10 | Responsive desktop/tablet/mobile workflows | Implemented, not yet verified | Mobile bottom navigation, safe-area handling and first-visit focus behaviour added; execute device-width browser journeys |
| Phase 11 | Preserve authenticated caregiver and care-recipient context | Implemented, not yet verified | Workspace provider now clears and refreshes its authorized projection on identity-change events; test shared-record and mid-session switch flows |
| Phase 11 | Preserve LCR authority, provenance and approval boundaries | In progress | No parallel store or silent-write change introduced; end-to-end contribution/document/Companion data-flow verification remains |
| Phase 12 | Route, component and integration regression suite | In progress | New route/IA contract is registered in `npm test`; full test run is pending |
| Phase 12 | Critical browser journeys and responsive verification | In progress | E2E assertions cover Home, Ask SolenOS, Care information, More ownership, breadcrumbs, source-return state, skip navigation, Notifications and Reminders; actual E2E run is pending |
| Phase 12 | Verify original-document drill-down from the real saved document | Implemented, not yet verified | Critical-care browser journey now opens a persisted upload by its evidence ID, waits for the original preview and enabled download, and checks the filtered return link |
| Phase 12 | Real caregiver comprehension/usability validation | Not started | Requires 8–12 US family caregivers; no participant evidence exists yet |

## Current verification state

- Source changes are being committed directly to `main`.
- No production deployment was initiated.
- GitHub Actions runs have been observed in **queued** state; no passing build, test or E2E result is claimed from a queued run.
- No caregiver usability sessions have been conducted in this execution.
- Work remains incomplete. Rows marked In progress or Implemented, not yet verified must not be reported as complete.
