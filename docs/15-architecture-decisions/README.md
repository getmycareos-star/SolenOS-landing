# 15 — Architecture Decision Records

ADRs capture **why**. If code and ADR conflict after an intentional change, update the ADR in the same PR — docs remain SoT.

| ID | Title |
|----|-------|
| [ADR-001](./ADR-001-situation-as-root-entity.md) | Situation as root entity |
| [ADR-002](./ADR-002-three-layer-runtime.md) | 3-layer STATE / BELIEF / EXPLANATION + DERIVED |
| [ADR-003](./ADR-003-priority-contract-deterministic.md) | Priority Contract deterministic, not LLM |
| [ADR-004](./ADR-004-safety-always-wins.md) | Safety always wins |
| [ADR-005](./ADR-005-dementia-entry-market.md) | Dementia as entry market, not product |
| [ADR-006](./ADR-006-observation-capture-structure-summarize.md) | Observation Capture→Structure→Summarize |
| [ADR-007](./ADR-007-load-first-before-tips.md) | Load-first before care tips |
| [ADR-008](./ADR-008-containment-mode.md) | Containment Mode under acute stress |
| [ADR-009](./ADR-009-documentation-governance.md) | Documentation governance |
| [ADR-010](./ADR-010-identity-continuity-not-auth-wall.md) | Identity continuity, not auth wall |
| [ADR-011](./ADR-011-delegation-suggest-only.md) | Delegation suggest-only |
| [ADR-012](./ADR-012-case-centered-memory-pattern-response-policy.md) | Case-centered memory + Pattern Response Policy |
| [ADR-013](./ADR-013-tts-polly-google-only.md) | TTS: Polly + Google Cloud only |
| [ADR-014](./ADR-014-deterministic-prioritization-fixed-schema.md) | Deterministic scoring + fixed schema compression |
| [ADR-015](./ADR-015-permanent-product-identity-solenos.md) | Permanent product identity — SolenOS only |
| [ADR-016](./ADR-016-bw-four-state-cognitive-workspace.md) | B&W four-state cognitive workspace UI |
| [ADR-017](./ADR-017-voice-conversation-browser-io-mvp.md) | Voice conversation browser I/O — FUTURE (superseded for MVP by ADR-018) |
| [ADR-018](./ADR-018-mvp-input-text-documents-only.md) | MVP input: text + documents only (no voice) |
| [ADR-019](./ADR-019-living-care-record-ux.md) | Living Care Record UX — AI invisible; four-section default |
| [ADR-020](./ADR-020-progressive-understanding-engine.md) | Progressive Understanding Engine |
| [ADR-021](./ADR-021-care-reality-state-product-identity.md) | Care Reality State & product identity |
| [ADR-022](./ADR-022-caregiver-response-contract.md) | Caregiver Response Contract (trust-critical) |
| [ADR-023](./ADR-023-emotional-phrasing-record-voice.md) | Emotional phrasing — record voice over therapy empathy |
| [ADR-024](./ADR-024-epistemic-labels-internal-vs-lcr.md) | Epistemic labels — internal vs LCR sections |
| [ADR-025](./ADR-025-g61-verify-only-not-compose-gate.md) | G61 Real Caregiver Test — verify-only |

**Phase 3 conflict ADRs (2026-07):** ADR-023 (emotional phrasing) · ADR-024 (epistemic labels) · ADR-025 (G61 placement) — indexed in [`module-status.md`](../17-canonical-architecture/module-status.md).