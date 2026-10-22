# SolenOS agent operating contract

Before any implementation, read `docs/SOLENOS_MASTER_VALUES.md`. It is binding for this repository and all agents working in it.

## Required execution rules
1. Verify the defect in current code or runtime evidence before describing it as present.
2. Trace the real execution path, canonical data model, owner service, callers and persistence boundary before editing.
3. Enforce identity, ownership, care-context membership, permissions and consent on the server. A client ID is attribution, never proof of authorization.
4. Never substitute a default person/caregiver, fabricated care record, mock production response, or generated summary for missing source data.
5. Treat AI output as untrusted. Preserve evidence, provenance, timestamps, uncertainty and contradictions; validate before persistence.
6. Distinguish local/in-memory, browser-local, database-committed, server-confirmed and backed-up state. Never report save/sync success until confirmed. Persistence errors must not silently fall back to memory.
7. For schema changes, use reviewed migrations or explicit schema validation; do not rely on `create_all()` to update existing tables. Never destructively alter production data without an approved migration and rollback plan.
8. Add tests for expected behavior, failure paths, cross-person access, stale/missing schema, restart durability and regressions where relevant.
9. Execute the tests that can be run. Quote exact command/results. Mark unexecuted/live-blocked checks as blocked.
10. Keep frontend changes in this repository and backend changes in the backend repository. Do not merge or deploy without verified CI and an explicit safe path.

## Mandatory report
State: verified baseline; defect/evidence; files changed; data/security impact; tests actually run and results; deployment/config needs; remaining risks; status PASS, PARTIAL, BLOCKED or FAIL.

A document or test name is not implementation. A compile/build is not proof of runtime correctness. Do not claim full acceptance while a mandatory gate is failed or blocked.
