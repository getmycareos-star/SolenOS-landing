# Open Loop frontend real-API workflow verification

## Scope

This change is limited to proving the existing caregiver-facing Open Loop workflow against the actual FastAPI contract. Do not redesign unrelated screens or introduce sample/demo care records.

## Required end-to-end path

Using a real PostgreSQL-backed backend and a server-issued anonymous bearer session:

1. Create an Open Loop from the frontend.
2. Confirm the API response is rendered from persisted server data, not optimistic fabricated state.
3. Record the relevant response/action with its evidence references.
4. Reconcile a contradiction or changed situation where applicable; preserve unresolved/partial conflict states rather than forcing resolution.
5. Record the intended outcome and the explicit verification rule.
6. Verify the outcome using source evidence belonging to the same care record.
7. Close only when the backend accepts the required evidence and verification.
8. Reload the application and confirm the closed state and complete chronological history are restored from the API.

## Required negative and concurrency coverage

- Cross-person evidence IDs are rejected and do not leak data.
- Missing evidence, missing verification rule, and unverified outcomes cannot close an action/decision loop.
- Reconciliation does not silently erase prior conflicting evidence or history.
- API failures are visible; the UI does not fall back to demo/sample records or claim persistence.
- Retry behavior does not duplicate events or create a second logical loop.
- Terminal-state conflicts are shown as conflicts and the UI refreshes from authoritative server state.

## Acceptance gates

- [ ] Frontend API client uses the authenticated bearer session for every Open Loop request.
- [ ] UI create → action/response → reconciliation → outcome verification → closure → history path is covered by integration/E2E tests.
- [ ] Tests run against the real backend API and PostgreSQL, not mocked route handlers alone.
- [ ] Browser reload restores state and event history from the API.
- [ ] Cross-person isolation and negative closure cases pass.
- [ ] Type-check, full frontend tests, and production build pass on the exact PR head.
- [ ] Backend candidate SHA and API test environment are recorded so the frontend result is traceable to the tested contract.

## Safety boundary

Keep this PR draft until the real API workflow is verified. Do not claim live integration from mocked tests or a successful frontend build. No production deployment is authorized by this PR.
