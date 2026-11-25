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
| `/workspace/timeline` | Care history | Historical events, changes, corrections and source references | Canonical historical view |
| `/workspace/documents` | Documents | Original medical records, upload and processing/review lifecycle | Child of Care information; direct entry also available from Add an update |
| `/workspace/appointments` | Appointments | Upcoming and previous appointments | Child of Care information |
| `/workspace/open-loops` | Needs attention | Unresolved care matters, clarification and resolution history | Child of Care information; separate from notification read state |
| `/workspace/reminders` | Reminders | Caregiver-created scheduled reminders | Child of Care information; separate from unresolved matters |
| `/workspace/handoffs` | Share care information | Prepare and manage shared care summaries | Child of Care information |
| `/workspace/companion` | Ask SolenOS | Questions grounded in authorised care information | Primary workspace destination |
| `/workspace/notifications` | Notifications | Application and care-update inbox; read state and notification preferences | Dedicated route; no longer a redirect to Settings |
| `/workspace/more` | More | Account, privacy, access and application management | Application-management destination |
| `/workspace/settings` | Settings | Account and application preferences | Reached from More |
| `/workspace/community` | Disabled | Community is intentionally unavailable | Feature flag remains false; route fails closed |
| `/workspace/record` | Legacy route | Old record landing route | Redirects to Home |
| `/workspace/continuity` | Legacy technical route | Old continuity route | Redirects to Home |

### Other page routes

The remaining 23 page files are public, invitation, support, policy or internal operations routes:

- `/about`, `/capabilities`, `/contact`, `/early-access`, `/help`, `/how-it-works`
- `/invite/caregiver`, `/metrics`, `/mission`, `/ops`, `/ops/clarity`, `/ops/devtools`
- `/our-story`, `/`, `/privacy`, `/settings`, `/share`, `/start`
- `/support`, `/team`, `/terms`, `/welcome`, `/why-solenos`

The legacy `/settings` route redirects to `/workspace/settings`.

Five route handlers were present: `/api/analyze`, `/api/extract`, `/api/share-intake`, `/api/situation`, and `/share-target`. These are not caregiver navigation destinations.

## Navigation ownership

- Primary destinations: Home, Add an update, Care information, Ask SolenOS.
- Care information children: Care history, Documents, Appointments, Needs attention, Reminders, Share care information.
- Notification control: persistent header shortcut and a dedicated Notifications destination.
- Application management: More, with Settings beneath it.
- Mobile destinations: Home, Care, Ask, More; Add an update remains a separate prominent action.
- Community remains excluded.

## State and security boundaries

All workspace routes are composed inside the workspace layout and `WorkspaceProvider`. The workspace entry gate waits for session bootstrap and displays a connection warning when the care record cannot be confirmed. The backend remains responsible for enforcing caregiver, care-recipient and shared-record permissions. A visible route or hidden navigation item is not a security boundary.

This route inventory does not yet constitute a complete endpoint-by-endpoint permission audit. The remaining implementation work must verify the actual API requests and role checks for each page, including direct URL access and care-recipient changes.

## Cross-page invariants

1. The Living Care Record remains authoritative; UI consolidation does not create parallel care stores.
2. Reading or dismissing a notification does not resolve a Needs attention item.
3. Resolving or withdrawing a care matter does not erase its historical evidence.
4. Documents remain source evidence; extracted content is not treated as accepted care information until the existing review and approval rules are satisfied.
5. Care history preserves event time separately from recorded time and correction time.
6. Caregiver and care-recipient context must remain scoped across route changes and browser history.
7. A failed or partial API read must not be presented as an empty or complete record.
8. Legacy links must resolve without changing the active care-recipient context.

## Verification

The frontend test suite now includes a caregiver information architecture contract covering route ownership, canonical labels, nested navigation, notification separation, legacy routes, disabled Community, mobile destinations and source-document drill-down. Browser and build checks remain required; source-level contract checks alone do not prove the rendered experience works.
