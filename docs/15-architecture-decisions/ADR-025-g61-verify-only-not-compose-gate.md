# ADR-025: G61 Real Caregiver Test — verify + optional compose-path gate

**Status:** Accepted (amended Slice 5.5)  
**Date:** 2026-07-20  
**Amended:** 2026-07-20 — optional compose-path gate (dev throw / prod log)  
**Deciders:** Product Steward  
**Conflicts resolved:** Golden scenarios doc (feature approval) vs production compose path

---

## Context

**G61 — The Real Caregiver Test** asks whether an exhausted caregiver at 2 AM would feel more capable after seeing output.

Placement options:

1. **Hard runtime gate** — block every compose if G61 fails (like `assertResponseAcceptanceGate`) — too brittle for production.
2. **Verify-only** — run only in golden / tier1 CI scripts.
3. **Optional compose-path gate (Slice 5.5)** — run after acceptance; throw in non-prod; log in feature-flagged prod; **never block capture**.

---

## Decision

**G61 remains CI/feature-approval primary. Optional compose-path gate is allowed under ADR-025 amended rules.**

| Mechanism | Role |
|-----------|------|
| `assertResponseAcceptanceGate` | **Runtime** — every composed turn |
| `assertComposedResponseProfessional` | **Runtime** — banned phrases, ask cap |
| `assertRealCaregiverTest` | **Verify / feature approval** — golden scripts, tier1 spot checks |
| `applyRealCaregiverTestComposeGate` | **Optional** after acceptance — see modes below |

### Compose-path modes (`resolveG61ComposeGateMode`)

| Environment | Default | `SOLENOS_G61_COMPOSE_GATE=1` | `SOLENOS_G61_COMPOSE_GATE=0` |
|-------------|---------|------------------------------|------------------------------|
| Non-prod (local/dev) | `throw` on fail | `throw` | `off` |
| Production | `off` | `log` only (never throw) | `off` |
| `SOLENOS_VERIFY=1` (CI) | `off` (explicit asserts in scripts) | `throw`/`log` per NODE_ENV | `off` |

**Never block capture:** ingest commits before compose; prod log mode always returns the composed response.

Empty / identity-mismatch turns skip the compose-path gate (G61 is for care orientation).

### CI / verify

G61 continues to run in:

- `verify:golden-dementia-baseline`
- Selected cases in `verify:continuity-core-tier1` (e.g. G13)

---

## Consequences

- New trust-critical features must still extend golden verifies with G61.
- Compose-path throws are **dev-only by default**; prod requires explicit flag and only logs.
- Quiet post-session surveys remain out of scope (see Slice 5.6 / research validation).
- Onboarding: see [`golden-scenario-map.md`](../17-canonical-architecture/golden-scenario-map.md).

---

## References

- `src/lib/real-caregiver-test`  
- `docs/02-product/solenos-golden-caregiver-scenarios.md` (G61)  
- ADR-022 Caregiver Response Contract  
- Spine Slice 5.5
