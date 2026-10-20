# 17 — Canonical Architecture

**Living single source of truth** for humans. Machine twin: `src/lib/solenos-layers/architecture-map.ts` (enforced by verify scripts).

If narrative here and code diverge after a change, **update this folder and architecture-map in the same PR**. Docs win conflicts until intentionally revised via ADR.

## Contents

| Doc | Topic |
|-----|-------|
| [README.md](./README.md) | This index + purpose |
| [system-architecture.md](./system-architecture.md) | 3-layer + pipeline |
| [database-architecture.md](./database-architecture.md) | Evidence ledger vs runtime truth |
| [ai-architecture.md](./ai-architecture.md) | Deterministic vs LLM |
| [security-model.md](./security-model.md) | Safety / trust |
| [scaling-roadmap.md](./scaling-roadmap.md) | Scale stages |
| [moat-architecture.md](./moat-architecture.md) | Five assets |
| [product-philosophy.md](./product-philosophy.md) | Continuity philosophy |
| [product-truth-path.md](./product-truth-path.md) | **Product truth path** — Path A vs internal compile (**Phase 3 onboarding start**) |
| [solenos-decision-continuity.md](../02-product/solenos-decision-continuity.md) | **Decision Memory + continuity** — paired onboarding doc (Phase 3.4) |
| [spine-build-sequence.md](./spine-build-sequence.md) | **Phases 1–5 build order** — sequential slices, verify gates, ~90→95 maturity |
| [module-status.md](./module-status.md) | **Honest IMPLEMENTED · IN-MEMORY · STUB · SCHEMA-ONLY · FUTURE · INTERNAL** (Phase 3.1) |
| [scope-lock.md](./scope-lock.md) | **Phase 4 defer list** — block until Phase 5; PR review gates |
| [phase-5-compounding-loop.md](./phase-5-compounding-loop.md) | **Phase 5** — compounding learning (~93–95); entry gate + slices |
| [golden-scenario-map.md](./golden-scenario-map.md) | **Single table:** G1–G19 + dementia + G61 → verify → composer (`verify:golden-scenario-map` CI meta-verify) |
| Conflict ADRs | [ADR-023](../15-architecture-decisions/ADR-023-emotional-phrasing-record-voice.md) · [ADR-024](../15-architecture-decisions/ADR-024-epistemic-labels-internal-vs-lcr.md) · [ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md) |

## SolenOS purpose

**Caregiver load detection, attention prioritization, and family responsibility continuity intelligence.**

**Case** is the durable product spine (ADR-012). **Situation** is the runtime STATE root (ADR-001). Chat/voice are input only.

**MVP inputs (ADR-018):** text + documents → understanding → Care Record. Voice Conversation (`src/lib/voice`, ADR-017) is a **FUTURE** modular I/O contract — unmounted in MVP.

**Living Care Record UX (ADR-019):** Caregiver sees a Living Care Record update — not an AI chat. Related observations grow an **Active Care Situation** (`src/lib/active-care-situation`) instead of restarting a template. Attention sections only after enough evidence.

Not: medical advisor, task manager, chatbot platform, dementia diagnosis engine, conversation memory.

## Quick links

- Governance: [`../README.md`](../README.md)
- ADRs: [`../15-architecture-decisions/`](../15-architecture-decisions/)
- PRDs: [`../02-product/prds/`](../02-product/prds/)
- Onboarding: [`../14-developer-onboarding/`](../14-developer-onboarding/)
