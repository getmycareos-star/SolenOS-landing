# SolenOS Product-Wide Frontend Redesign — Task Register

**Tracking branch:** `redesign/product-wide-accessibility`  
**Frontend PR:** https://github.com/getmycareos-star/SolenOS-landing/pull/99  
**Backend dependencies:** https://github.com/getmycareos-star/SolenOS_backend/issues/80 and https://github.com/getmycareos-star/SolenOS_backend/issues/81

This register separates source implementation from CI, deployed integration, and complete user-flow verification. A task must not be marked complete based on a mock, static source inspection, or repository CI alone.

## Status definitions

- **Not started** — no implementation evidence.
- **In progress** — source changes exist but acceptance criteria remain.
- **CI verified** — relevant automated checks pass on the latest commit.
- **Integration verified** — deployed Netlify frontend exercised the live Railway backend and read back persisted results.
- **User-flow verified** — the complete workflow was exercised on mobile and desktop, including failure/retry behavior.
- **Blocked** — requires a backend contract, infrastructure capability, or user-provided access that is not available.

## Workstream register

| ID | Workstream | Required acceptance evidence | Current status |
|---|---|---|---|
| UI-01 | Product-wide typography, contrast, sage action styling, focus visibility, reduced motion, and overflow prevention | Build plus mobile/desktop browser review across all workspace screens; no clipped controls or text | In progress — CSS overrides in PR #99; browser review outstanding |
| UI-02 | Workspace shell and returning-caregiver entry | Empty, populated, and returning states; real persisted data; loading, error, and recovery states | In progress — source audit/review still required |
| DC-01 | Daily Capture / Daily Care | Separate entry paths; create, retrieve, edit, and error states backed by the live API; no fabricated examples | Not verified |
| COM-01 | Dementia-caregiver Community | Real API-backed feed and interactions; clear loading/empty/error states; community content never silently writes into the Living Care Record | Not verified |
| MENU-01 | More menu: pin, archive, restore, share/export, delete | Each action must be accurately labelled and persist server-side where claimed; test refresh and another session/device | Blocked for server-side delete by backend issue #80; other actions not verified |
| DOC-01 | Documents, uploads, OCR, retrieval, original-file access | Live upload/download round trip, ownership denial, OCR availability and user-visible failure handling | Not verified |
| LCR-01 | Living Care Record continuity and identity isolation | Create/read persistence, refresh continuity, cross-record denial, missing/uncertain facts preserved | Not verified |
| AI-01 | AI Companion | Authenticated request to deployed inference service; response is from the configured model/service, with honest unavailable/error states and no fabricated assistant messages | Not verified |
| PRIV-01 | Privacy and consent before sensitive capture | First-use consent and policy explanation before sensitive capture; clear limits and data actions; no misleading retention/deletion claims | Not verified |
| AUTH-01 | Real account signup, login, session lifecycle, and anonymous-record claiming | Backend model/migration and secure endpoints; frontend signup route; PostgreSQL integration tests; live signup → login → read/write → refresh/logout → login again; cross-record denial | In progress — backend PR #85 and frontend PR #105; CI still being resolved; not merged or deployed. Anonymous-record claiming remains unimplemented |
| NAV-01 | Public and workspace navigation | Every visible link/button resolves to the intended page; no dead links or Vite-era routes | In progress — archived Vite pages removed in PR #99; route-by-route verification outstanding |
| QA-01 | Acceptance test suite and release gate | Latest CI passes; live API checks; mobile/desktop complete flows; explicit evidence log and remaining defects | In progress — GitHub Actions passed for commit `62a0900fc4c99b9c116cc037c6cb360f6993add4`; this does not establish live integration or full user-flow success |

## Signup/security gate

The existing anonymous session is a scoped bearer capability, **not** a user account. Proposed account endpoints are implemented in backend PR #85 (`/sessions/register`, `/sessions/login`, `/sessions/me`, and `/sessions/revoke`) and wired to frontend routes in PR #105. These changes are not yet merged or deployed; do not claim live account creation or login until latest CI passes and the deployed frontend successfully exercises the real backend.

Passwords are hashed server-side; the frontend never stores the password. Email verification, password reset, MFA, persistent login throttling, and claiming an existing anonymous record are not implemented. The frontend preserves an existing anonymous capability when switching to an account and offers a restore action, but this is not a record-claim/merge workflow. Keep anonymous entry available; signup must remain optional.

## Required evidence log

For every task moved to CI verified, record the exact commit SHA and workflow run. For integration verified, record the deployed frontend URL, backend URL, endpoint/workflow, response status, and persistence read-back result without including credentials or care data. For user-flow verified, record device/browser and the exact steps exercised. Never store bearer tokens, passwords, personal care data, or secret values in this file.
