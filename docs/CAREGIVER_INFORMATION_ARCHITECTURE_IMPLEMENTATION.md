# Caregiver information architecture implementation record

This document records the route ownership decisions being implemented in the frontend. It is not a claim that every workflow or permission contract has been verified.

## Repository route inventory

The App Router tree on the inspected `main` revision contains 39 page files: 16 workspace pages and 23 non-workspace pages. It also contains five route handlers and two layouts. No dynamic page route was present in that tree snapshot.

### Caregiver workspace routes

| Route | Caregiver-facing owner | Responsibility | Current route decision |
|---|---|---|---|
| `/workspace` | Home | Current care picture, meaningful changes, next useful action | Canonical workspace root |
| `/workspace/daily-care` | Add an update | Add observations, care events and other updates; direct medical-document entry | Canonical contribution route; still contains some contextual content requiring further separation |
| `/workspace/care-continuity` | Care information | Current care picture and directory of care information | Canonical Care information landing page |
| `/workspace/timeline` | Care history | Historical events, changes, corrections and source references, with an optional all-saved-records source explorer | Canonical historical view |
| `/workspace/documents` | Documents | Original medical records, upload and processing/review lifecycle | Child of Care information; direct entry also available from Add an update |
| `/workspace/appointments` | Appointments | Upcoming and previous appointments | Child of Care information |
| `/workspace/open-loops` | Needs attention | Unresolved care matters, clarification and resolution history | Child of Care information; separate from notification read state |
| `/workspace/reminders` | Reminders | Caregiver-created scheduled reminders | Child of Care information; separate from unresolved matters |
| `/workspace/handoffs` | Care handoffs | Prepare and manage shared care summaries and review incoming responsibility-transfer requests | Child of Care information |
| `/workspace/companion` | Ask SolenOS | Questions grounded in authorised care information | Primary workspace destination |
| `/workspace/notifications` | Notifications | Application and care-update inbox; read state and notification preferences | Dedicated route; no longer a redirect to Settings |
| `/workspace/more` | More | Account, privacy, access and application management | Application-management destination |
| `/workspace/settings` | Settings | Account and application preferences | Reached from More |
| `/workspace/community` | Disabled | Community is intentionally unavailable | Feature flag remains false; route fails closed |
| `/workspace/record` | Legacy route | Old record landing route | Redirects to Care information |
| `/workspace/continuity` | Legacy technical route | Old continuity route | Redirects to Care information |

### Other page routes

The remaining 23 page files are public, invitation, support, policy or internal operations routes:

- `/about`, `/capabilities`, `/contact`, `/early-access`, `/help`, `/how-it-works`
- `/invite/caregiver`, `/metrics`, `/mission`, `/ops`, `/ops/clarity`, `/ops/devtools`
- `/our-story`, `/`, `/privacy`, `/settings`, `/share`, `/start`
- `/support`, `/team`, `/terms`, `/welcome`, `/why-solenos`

The legacy `/settings` route redirects to `/workspace/settings`.

Five route handlers were present: `/api/analyze`, `/api/extract`, `/api/share-intake`, `/api/situation`, and `/share-target`. These are not caregiver navigation destinations.

## Route-to-API and state map

The following is a source-inspected dependency map, not proof that each endpoint succeeds in a running environment. All workspace pages are rendered inside the shared workspace layout and session gate. The API client supplies the bearer-scoped caregiver session; the backend remains responsible for authorizing the caregiver against the active care recipient and any shared-record grant.

| Route owner | Existing data/API dependencies observed in source | State and integrity responsibilities |
|---|---|---|
| Home | Shared workspace projection; `LCRCurrentUnderstanding` reads current-care facts, situation understanding, change summaries/patterns and registered actions; `UpcomingAppointmentSummary` reads the appointment preparation brief | Show the compact current-care view; distinguish unavailable data from empty data; next actions must be derived from returned state |
| Add an update | Existing capture components: assistant jobs, medication review, document intelligence, capture-analysis review and durable offline write queue | Keep specialised validation; preserve original caregiver text; distinguish saved source from accepted care information; expose retry/review state |
| Care information | Shared workspace projection and the full `LCRCurrentUnderstanding` projection; current-care facts, situation understanding, changes, patterns and registered actions | Current picture only; preserve source, status and uncertainty; do not duplicate the historical feed |
| Documents | `GET /evidence/{person_id}`, `GET /upload/{evidence_id}`, version comparison, upload/version creation and document deletion; durable upload queue | Preserve original files; show retrieval/upload/processing/review failures; extracted content remains a proposal until the existing review and approval path accepts it |
| Care history | `GET /daily-care/intelligence/history`, `GET /corrections/{person_id}`, `POST /corrections` | Preserve event time separately from recorded time; retain corrections and source references; search/filter state is encoded in the URL |
| Appointments | Appointment workspace and appointment APIs: preparation brief, workspace list/create/update, upcoming workspace reconciliation, appointment lifecycle and outcome proposals | Preserve partial-save and loading/error feedback; distinguish preparation from completed outcomes |
| Reminders | `/reminders/{person_id}`, assignable caregiver members, create, assignment, complete, snooze and cancel endpoints | Keep reminder lifecycle separate from unresolved care matters and notification read state; preserve assignment and lifecycle history |
| Needs attention | `/open-loops`, `/care-continuity/situation-understanding`, reassessment, response, outcome and action endpoints | Preserve unresolved/resolved/cancelled state; partial assessment failures must not erase saved matters; no AI-generated urgency without evidence |
| Care handoffs | Consent, recipient directory, handoff inbox/outbox, handoff drafts, preparation and handoff create/read endpoints; responsibility and primary-caregiver transfer endpoints | Review what will be shared; respect consent and access grants; accept/decline responsibility transfers explicitly; no silent LCR writes |
| Ask SolenOS | Assistant availability, saved conversations, conversation messages and proposed care-update endpoints | Retrieve only authorised context; keep conversation history distinct from the Care Record; preserve unsent input on failure; require explicit review/approval before care updates |
| Notifications | Notification feed, unread count, read state, notification preferences and push-subscription endpoints | Read/dismiss changes notification state only; must not resolve a Needs attention matter |
| More | No care-data endpoint; renders application-management destinations | Must not become a second care browser or host core care workflows |
| Settings | Care profile, caregiver preferences, account/recovery, privacy requests, push subscription and caregiver access endpoints | Preserve account identity, privacy and caregiver/care-recipient access boundaries |
| Community | Feature-flag check and redirect | Remains disabled and fails closed |
| Legacy record/continuity | Server redirects only | Redirect to Care information without changing the bearer-scoped active care-recipient context |
| Legacy settings | Server redirect only | Redirect to current Settings destination |

### Permission verification boundary

The shared workspace gate prevents an uninitialised workspace from rendering as ready, and the workspace provider clears the previous projection when the active caregiver or care recipient changes. This is a presentation and session-continuity safeguard, not authorization. Each API must independently enforce bearer validity, caregiver identity, person scope, role/access grant and operation-specific permission. The current source inventory does not prove every role/endpoint combination. Direct URL access, shared-record roles, document-only access, mid-session recipient switching and mutation permissions remain explicit browser/integration verification items.

### Page state contract

- **Loading:** identify the part of the workspace being opened; do not show stale prior-recipient data as current.
- **Empty:** only show an empty state after a successful, complete read. An unavailable or partial response is not an empty record.
- **Error:** explain what could not be confirmed and offer a relevant retry or safe return path.
- **Populated:** preserve care-recipient identity, source provenance, status and time semantics.
- **Mutation feedback:** say what the server confirmed. Do not display a successful state for a queued, unconfirmed or failed operation.

## Navigation ownership

- Primary destinations: Home, Add an update, Care information, Ask SolenOS.
- Care information children: Care history, Documents, Appointments, Needs attention, Reminders, Care handoffs.
- Notification control: persistent header shortcut and a dedicated Notifications destination.
- Application management: More, with Settings beneath it. Incoming care responsibility transfers are part of Care handoffs, not More.
- Mobile destinations: Home, Care, Ask, More; Add an update remains a separate prominent action.
- Community remains excluded.

## State and security boundaries

All workspace routes are composed inside the workspace layout and `WorkspaceProvider`. The workspace entry gate waits for session bootstrap and displays a connection warning when the care record cannot be confirmed. The shared provider also clears its current projection and reloads the authorized situation when the API client announces a caregiver or care-recipient identity change. A version guard prevents a late response for the previous scope from replacing the current view. The backend remains responsible for enforcing caregiver, care-recipient and shared-record permissions. A visible route or hidden navigation item is not a security boundary.

This route inventory does not yet constitute a complete endpoint-by-endpoint permission audit. The remaining implementation work must verify the actual API requests and role checks for each page, including direct URL access and care-recipient changes.

## Cross-page invariants

1. The Living Care Record remains authoritative; UI consolidation does not create parallel care stores.
2. Reading or dismissing a notification does not resolve a Needs attention item.
3. Resolving or withdrawing a care matter does not erase its historical evidence.
4. Documents remain source evidence; extracted content is not treated as accepted care information until the existing review and approval rules are satisfied.
5. Care history preserves event time separately from recorded time and correction time; the all-saved-records explorer is owned by Care history, not More. Document-backed entries open the exact source document and carry the active history filter/search into a validated same-origin return link.
6. Caregiver and care-recipient context must remain scoped across route changes and browser history.
7. A failed or partial API read must not be presented as an empty or complete record.
8. Legacy links must resolve without changing the active care-recipient context.

## Keyboard and assistive navigation

The workspace shell exposes a first-focusable “Skip to main content” link. Its target is the workspace main landmark and receives a visible focus treatment. Route changes focus the main landmark after navigation; the mobile sidebar uses a modal focus trap, Escape handling, inert background content and focus restoration to the menu trigger. These source-level controls still require keyboard and screen-reader verification in a running browser.

## Verification

The frontend test suite now includes a caregiver information architecture contract covering route ownership, canonical labels, nested navigation, notification separation, legacy routes, disabled Community, mobile destinations and source-document drill-down. Browser and build checks remain required; source-level contract checks alone do not prove the rendered experience works.

## Additional implementation details

The following source changes extend the route map above. They are implementation records, not a claim of completed browser verification:

- Home's compact `today` view retains its own record-aware next-step panel; the full Care information disclosure and source-review sections remain gated to the complete view.
- Care history no longer fills a missing event timestamp with `recorded_at`. When the event time is absent or invalid, the UI says it was not provided and shows the saved time separately.
- A document-backed history entry links to the exact evidence ID. Documents opens that original file, validates the `returnTo` destination as same-origin Care history, and preserves its search/filter query.
- Document preview requests are invalidated when the caregiver or care recipient changes. Both the in-flight response and the deep-link lookup are bound to the active identity scope, so a late response cannot display a previous recipient's file.
- Needs attention preserves the assessment's separate `needs_attention_now` and `important_to_address` categories. If a source appears in both, the immediate-attention classification takes precedence rather than showing duplicate cards.
- Recipient changes synchronously clear Documents, Care history, Reminders and Needs attention state. Documents invalidates preview, extraction-review, upload, retry, version-link and deletion work; Care history invalidates paged reads and correction polling/writes; Reminders scopes list reads and all mutations; Needs attention scopes history reads and follow-up writes.
- The Appointments route remounts its entire workspace when the active care record changes. Care handoff inbox and sharing views also remount, so a prior recipient's draft or inbox state is not retained.
- Legacy `/workspace/record`, `/workspace/continuity` and `/settings` redirects preserve repeated and single query parameters. Browser journey checks cover the preserved return paths.
- The critical-care browser journey now includes a persisted-document source-preview path and checks that the original download is enabled before treating the preview as ready.

