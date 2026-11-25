# SolenOS workspace shell and stylesheet ownership

This document records the current ownership boundary for the caregiver workspace. It is an engineering contract for future changes, not a claim that all legacy CSS has already been removed.

## Import order

The product root loads:

1. `src/app/globals.css`
2. `src/app/mobile-app.css`
3. `src/app/accessibility-overrides.css`
4. `src/app/dark-mode-remediation.css`

The `/workspace` route layout then loads:

1. `src/app/workspace/experience-design-system.css`
2. `src/app/workspace/experience-design-system-v2.css`
3. `src/app/workspace/navigation-accessibility.css`

The product-wide accessibility stylesheet is imported once by the root layout. The workspace layout must not import it again.

## Ownership

| File or component | Owner responsibility | Change rule |
| --- | --- | --- |
| `globals.css` | Public/legacy application foundations and compatibility rules | Do not add new workspace-only visual rules here |
| `mobile-app.css` | Legacy mobile surfaces and shared mobile compatibility | Do not use it as a second workspace component system |
| `accessibility-overrides.css` | Product-wide text scaling, focus, contrast and display-preference surfaces | Keep global; do not duplicate its import in nested layouts |
| `dark-mode-remediation.css` | Dark-theme corrections for legacy and route-specific surfaces | Migrate a rule only after both themes are visually verified |
| `experience-design-system.css` | Existing workspace structural and compatibility styles | Treat as a compatibility foundation; avoid adding new visual variants |
| `experience-design-system-v2.css` | Authoritative workspace tokens and final visual refinements | Put new workspace visual tokens and component refinements here |
| `navigation-accessibility.css` | Workspace navigation, breadcrumb presentation, drawer behavior and navigation focus | Keep navigation-specific behavior here |
| `WorkspaceShellContent.tsx` | Visual composition, care-context presentation and entry-gate presentation | Must not bootstrap identity or become a care-data source of truth |
| `WorkspaceProvider` | Session bootstrap, authorized care-record read and workspace runtime state | Use the shared API client for protected reads |
| `WorkspaceErrorFallback.tsx` | Interactive recovery UI | Never claim an operation was saved without server confirmation |

## Workspace composition

The workspace route layout remains a server component. It places the error boundary around the workspace provider so provider/render failures are inside the recovery boundary. The provider owns session and record bootstrap; the shell component owns visual composition.

The shell must consume the validated workspace runtime. It must not manufacture an active care situation, restore stale browser-cached care data, or create a second Living Care Record source of truth.

## Known migration debt

The CSS system is not yet fully consolidated:

- `globals.css` still contains workspace-specific selectors for the sidebar, care context, navigation, and home surfaces.
- `mobile-app.css`, `globals.css`, and the workspace styles contain overlapping mobile and workspace presentation rules.
- `accessibility-overrides.css` and `dark-mode-remediation.css` both contain dark-theme corrections for some surfaces.
- The v1 workspace foundation and v2 visual layer intentionally share selectors; v2 is loaded later and supplies final visual values.

These overlaps are not permission to delete the older rules. Some are compatibility rules and some are deliberate cascade overrides. A later migration must move one component family at a time, retain the same effective computed styles in light and dark themes, and run route-level visual regression before removing the source rules.

## Route coverage baseline

The shared workspace layout owns the caregiver routes under `/workspace`, including Home, Daily Care, Documents, Living Care Record/continuity, Companion, Appointments, Handoffs, Needs attention, Care history, Reminders, Notifications, More, and Settings. The disabled Community surface remains excluded from caregiver navigation.

The existing critical-care browser journey includes responsive route checks across phone, tablet and desktop viewport sizes. These checks still need to be executed against the current commit before a release claim is made.
