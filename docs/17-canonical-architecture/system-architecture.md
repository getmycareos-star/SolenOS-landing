# System Architecture

**Doc status:** Canonical architecture  
**Module markers:** [module-status.md](./module-status.md) — Path A = caregiver truth · Path B = analyze/v1.4 internal compile

## Layer model

```

┌─────────────────────────────────────────────┐
│                 DERIVED (pure)              │
│  Priority, Risk, CLI, ELS, Crisis,          │
│  Confidence, Delegation, Fail-Safe          │
├─────────────────────────────────────────────┤
│ STATE │ BELIEF │ EXPLANATION                │
│ Situations, Demands, Ownership              │
│ Assumptions / Missing info                  │
│ Decision History (WHY), Timeline (WHAT),    │
│ Human Trust explanations                    │
└─────────────────────────────────────────────┘
        ▲
   Case Memory (product spine) + analyze-pipeline
        ▲
   Input / Context / Load / Attention

```

## Situation root (runtime)

`SITUATION_ROOT_ENTITY` — statuses `active|resolved|archived`; priorities `LOW|MEDIUM|HIGH|CRITICAL`.

## Case product spine (durable — INTERNAL on MVP caregiver path)

`CASE_MEMORY_PRODUCT` / `src/lib/case-memory` — long-lived care recipient. Holds Profile, Conditions, Medications, Providers, Facilities, Documents, Timeline/Events, Interventions, Outcomes, Family Context, Understanding.
**MVP caregiver path:** ACS + CRS + composer — not Case Memory Decision Snapshot.  
**Analyze path:** Case Memory runs early; PRP shapes internal compile. Status: **INTERNAL · IN-MEMORY** — see [module-status.md](./module-status.md).
**Mapping:** Case owns durable identity; Situations are operational episodes attached to Case (ADR-001 + ADR-012).
**Workflow:** New Input → Identify Case → Extract Facts → Update Case → Update Timeline → Update Understanding → Selective Recall → Pattern Response Policy → Decision Snapshot.
**PRP States:** A (new) · B (weak) · C (strong → intervention compression).
**Decision Snapshot:** six fixed fields on `case_memory_layer` (and `deterministic_priority_layer.decision_snapshot`); public SolenOS display remains five-field schema shaped by PRP/deterministic compression text (**FUTURE** unification to six-field public response).

## Deterministic Prioritization (ADR-014) — INTERNAL

Issue extract → HIGH_IMPACT signal → `priorityScore = safety*3+time*2+cost*2+reversibility+relief` → internal buckets → compress to six fields. Runs after Priority Engine facade on **analyze path**; overlays Decision Snapshot when guarantee passes. **Not composer Clarity.** See [module-status.md](./module-status.md).

## Pipeline (actual)

See `V14_PIPELINE_ACTUAL_ORDER` in architecture-map. Critical notes:
- Case Memory early after input/urgency
- Load/Attention before Priority
- Deterministic Prioritization after Priority Engine (Decision Snapshot overlay)
- Fail-Safe after Decision, before Crisis/Confidence/Delegation/Trust
- Safety terminal
- Conflict detection runs early and late
- PRP shapes SolenOS fields before Trust Assembly

## Primary UI (ADR-016 workspace + ADR-018 input)

Landing surface is the B&W four-state cognitive workspace (`REAL_MOMENT` → `CARRYING` → `CLARITY` → `CONTINUITY`) in `src/components/mvp-workspace`, wired to live situation / analyze pipelines. Sidebar (`src/components/ui-runtime`) is secondary navigation only.

**MVP inputs (ADR-018):** text + documents (PDF / image / camera) via `AddSituationPanel` only.  
**Not MVP:** voice conversation, mic dictation, Hear SolenOS / TTS, Whisper. Voice libraries remain FUTURE (ADR-017) for the same User Input → Understanding → Care Record path.

**Living Care Record UX (ADR-019):** Default caregiver response grows an **Active Care Situation** across related observations — not a restarted template. Progressive Understanding (ADR-020) evolves delta; **Care Reality State** (ADR-021) is the SoT for caregiver projection with progressive disclosure. **Caregiver Response Contract** (ADR-022) — composer is sole caregiver-facing copy authority; panel obeys disclosure; asks are safety-only. Attention / remembered / evidence sections only after enough evidence. Engine panels never shown. Modules: `src/lib/living-care-record-ux` + `src/lib/active-care-situation` + `src/lib/care-reality-state` + `src/lib/caregiver-response-composer` · UI: `LivingCareRecordPanel`.

**Product truth vs internal compile:** Caregivers see only the **composer / LCR path** — not `final_output` from runtime arbitration. See [product-truth-path.md](./product-truth-path.md).

**Care epistemics (golden dementia-entry gates):** Principle-based understanding in `src/lib/care-epistemics` (baseline vs change, interpretation vs observation, gradual signals, fluctuation, unknown cause, safety continuity, preferences, missed-care framing, disagreeing views, everyday language, continuity worry). Golden-doc examples are illustrations only — never product keyword rules. Durable care key restores ACS + CRS + familiarity after process bounce (G44). **G57** `care-history-compression` projects long history without dumps. **G61** `real-caregiver-test` — **verify-only** feature approval ([ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md)); runtime = acceptance gate. **G12** `source-conflict` keeps opposing sources. **G13** `decision-memory` answers record questions from held evidence. **G6** `thread-ingestion` links long threads — **LIVE** in `situation-entry/pipeline` via `looksLikeCareThread` → `ingestCareThread`; LCR strips thread-source envelope. **G16** `perspective-attribution` shows who-said without a chat feed. **G7 / Tier 4** `dementia-entry-extended` + hard-safety Clarity-faster disclosure. Verify: `verify:golden-dementia-baseline` · `verify:continuity-core-tier1` · `verify:dementia-entry-extended` · `verify:live-thread-wire`.

## Facades

Legacy modules remain as facades mapped in `FACADE_DEPRECATION` / `LAYER_ARCHITECTURE_MAP`. Prefer canonical `solenos-layers/*` paths for new work. Case Memory is a product module alongside Family Intelligence — not a fourth truth layer replacing STATE/BELIEF/EXPLANATION.

## Family Intelligence — INTERNAL · IN-MEMORY

Strategic facade overlay — does not replace layers; compounds five assets. See moat-architecture.md. **Not caregiver product truth.** Case Memory feeds Family Memory continuity on analyze path.

## Stubs in architecture map

See [module-status.md](./module-status.md) — Known stubs & gaps. Summary:

- Human Override — **STUB**
- Reality Drift — **STUB**
- ELS recovery time minutes — **STUB** values
- Persistence adapters — often noop (**STUB**)
- Case Memory Postgres — **STUB**

## Runtime arbitration (IMPLEMENTED — internal compile, not caregiver product truth)

Situation-entry compile boundary enforces **exactly one dominant output mode** per cycle via `src/lib/priority-resolution-system`:
1. `crisis_mode` → 2. `first_60s_value_loop` → 3. `return_value_loop` → 4. `state_of_care_summary` → 5. `clarification_mode`
Lower-priority engines still run internally; they cannot override the selected mode (`compileByDominantMode` / `enforceCompiledDominantOutput`).
**This produces `final_output` — internal/telemetry-adjacent for MVP; caregivers see the composer path instead.** See [product-truth-path.md](./product-truth-path.md).
**Edge state machine** (`src/lib/edge-state-machine`) classifies operational conditions before output: `crisis | conflict | stale | degraded | bootstrap | normal` — with per-state engine activation and output restrictions.
**Engine execution contract** (`src/lib/engine-execution-contract`): engines are emit-only; CareContext mutation is forbidden; deterministic vs probabilistic and sync vs async are declared per engine.
**Confidence calibration** (`src/lib/confidence-calibration-system`): deterministic score from source weight × recency decay × contradiction penalty × confirmation boost × completeness — observations dominate inference; no manual assignment.

## Single User Journey / Care State (IMPLEMENTED — MVP)

**MVP definition:** two messy caregiver inputs must produce CareEvents, persistent CareContext, State of Care, and visible change-over-time (Diff). Verified by `scripts/verify-single-user-journey.mts`.
Core loop (narrow — no permissions / evidence-graph / full family coordination in MVP):

```

Any Input → Extract CareEvent → Update Care State → Detect Change → Surface Understanding

```

- `src/lib/care-state-engine` — Care Reality as primary object (person context, events, observations, unknowns, changes)
- `src/lib/single-user-journey` — 12-step journey validator (blocks chat, requires continuity on 2nd input)
Architecture remains compatible with Care Loop outcomes, roles, and evidence relationships. **Decision Memory is IMPLEMENTED** (`src/lib/decision-memory` — G13 record questions + outcome linking; schema: what / when / who / context / evidence / alternatives / reason / outcome / status).

## Product North Star (IMPLEMENTED — CONSTRAINT)

**North Star:** A caregiver should never need to reconstruct the care journey from memory.
Module: `src/lib/product-north-star` + Cursor rule `.cursor/rules/solenos-product-north-star.mdc`  
Architecture map: `PRODUCT_MEMORY_NORTH_STAR` in `src/lib/solenos-layers/architecture-map.ts`
- **Gate:** `evaluateFeatureAgainstNorthStar` — YES build / NO reject / UNCLEAR → reject  
- **Demand model:** caregiver questions = continuity failure symptoms → engines to build, never answer templates  
- **Continuity Demand** vs **Search Demand** classification — Search Demand is **refused** on `final_output` and redirected to Living Care Record capture (`applySearchDemandContinuityRedirect`)  
- Forbidden Build Zone + build filter enforce the North Star test  
- Outputs are scored for implicit memory coverage (what changed · what matters · what to remember · what can wait)  
**MVP build order:** CareEvent store → CareContext → Timeline → State of Care → Diff → Contradiction → Trust → feedback loop
**Product research docs (market signals → architecture):**
- `docs/PRODUCT_INTELLIGENCE.md`
- `docs/PRODUCT_ARCHITECTURE.md`
- `docs/PRODUCT_FAILURE_MODEL.md`
**Anti-identity:** not chatbot, not answer engine, not dashboard, not medical encyclopedia.  
**Success:** caregivers say “I didn’t have to remember anything. It was already there.”
**Honesty:** Feature-gate eval is available to constitution/FBZ; caregiver path enforces Search Demand refusal. Schema `product_north_star_log` remains optional telemetry (not required for MVP behavior).

## Product Constitution (IMPLEMENTED - WORLDVIEW)

**Belief:** Care should never depend on someone's ability to remember everything.
Module: `src/lib/product-constitution` + `.cursor/rules/solenos-product-constitution.mdc`  
Migration: `071_product_constitution.sql` | Architecture map: `PRODUCT_CONSTITUTION`
- **Job:** Reduce uncertainty - confidence that nothing important is being missed  
- **Metric:** Did the caregiver leave more certain than when they entered?  
- **Category:** Living Care Record  
- **State before UI:** CareRecord spine - person_profile, events, observations, medications, decisions, tasks, risks, unknowns, confidence_scores  
- **Daily Care Confidence** projection: status / changes / attention / gaps / permission to pause  
- Complements healthcare; memory is not diagnosis; documents are inputs only  
- FBZ build filter uses constitution gate (layers North Star)  
**Feeling:** Relief. **Tagline:** The care journey, remembered. **Motto:** Preserve continuity. Build trust. Reduce burden.  
Docs: `docs/PRODUCT_CONSTITUTION.md`

## Continuity Properties (IMPLEMENTED - VERTICAL)

Not a new product. Properties of the one CareEvent to CareContext runtime:

- SRL (source reliability on CareEvents; independent from confidence)
- EUM (explicit unknowns on Care State: known / inferred / missing)
- OML (src/lib/oml emitted each cycle)
- FDLL (explicit inference feedback only)
- Failure-to-engine map (questions are symptoms)

Module: `src/lib/continuity-properties` | Migration: `072` | Arch map: `CONTINUITY_PROPERTIES`
Docs: `docs/CONTINUITY_PROPERTIES.md`
Verify: `npm run verify:continuity-properties`

## Unknowns / Presentation / Evidence (IMPLEMENTED - VERTICAL)

- Unknowns Engine is disease-agnostic; dementia is the first clinical profile (`src/lib/unknowns-engine`)
- Presentation Engine: essential / standard / detailed over one CareContext (never mutates truth)
- Evidence Object on conclusions (traceable CareEvents)
- Privacy + institutional roles as CareEvent metadata / future projections — no CareContext fork

Docs: `docs/UNKNOWNS_ENGINE.md` | Migration: `073` | Verify: `npm run verify:unknowns-engine`

## Public Trust Layer (IMPLEMENTED - CONTENT)

Discoverable founder / mission / how-it-works content. Never interrupts care workflow.

| Surface | Location |
|---------|----------|
| Public Home | `/welcome` |
| Why SolenOS (product purpose) | `/why-solenos` |
| Our Story (founder narrative) | `/our-story` |
| Mission | `/mission` |
| How It Works (+ first use) | `/how-it-works` |
| Early Access | `/early-access` |
| In-product | Sidebar → **About SolenOS** |
| Soft discovery | Empty state + first insight footer links (no popups) |

Source of truth: `src/lib/trust-content` · Shell: `src/components/public/PublicShell.tsx`  
Architecture map: `PUBLIC_TRUST_LAYER`  
Rule: care experience first; story builds trust after value is felt.

## MVP Input Architecture (IMPLEMENTED — ADR-018)

**Channels:** text + documents (PDF / image / camera) only.  
**Not MVP:** voice input, STT, TTS / Hear SolenOS, voice conversation, Whisper / voice APIs.  
**Proof question:** Can SolenOS turn scattered caregiver information into understandable next steps?  
**Rule:** Accept messy, incomplete input — do not wait for perfect structure.  
Module: `src/lib/mvp-input-architecture` · Live composer: `AddSituationPanel` · ADR-018

## Care Reality Intelligence (INTERNAL — post-hoc facade)

**Category:** Care Reality Intelligence (phrase only — product name remains SolenOS)  
Module: `src/lib/care-reality-intelligence` | Migration: `074` | Arch map: `CARE_REALITY_INTELLIGENCE`  
**Not caregiver product truth** — post-hoc snapshot on internal compile path; composer/LCR path does not consume it.  
**Not a new pillar** — composes baseline, profile, care-state, continuity, moment-of-need, evidence.

Intelligence chain: Events → Changes → Decisions → Outcomes → Context → Confidence  
Comparison engine: person-specific history, not generic dementia education  
Trust: evidence engine, not guessing engine — see `TRUST_ENGINEERING_RULES` in module  
Future: Care Transition Mode, Care Communication Translation (signals only in MVP)  
Docs: `docs/CARE_REALITY_INTELLIGENCE.md` | Verify: `npm run verify:care-reality-intelligence`

## Future Capabilities (FUTURE — Phase 2/3)

NOT MVP. Extend Care Reality Engine after trust foundation exists.

| Phase | Capabilities |
|-------|----------------|
| 2 | Care Moment, I Need Clarity, Care Understanding Confidence, Confidence Collapse |
| 3 | Care Communication Support, Help Me Communicate This |

Module: `src/lib/future-capabilities` | Docs: `docs/FUTURE_CAPABILITIES.md`  
Rules: no generic communication assistant · no gamified scores · communication from shared context only  
Chaos-first ingestion: **IMPLEMENTED** via `adoption-wedge-engine`  
Verify: `npm run verify:future-capabilities`

## Ops Console (IMPLEMENTED - INTERNAL)

Internal product-learning / system-health console — **not** user-facing, **not** BI.

| Route | Secret | Audience |
|-------|--------|----------|
| `/ops` | `OPS_SECRET` | Founders, eng, product |
| `/metrics` | `METRICS_SECRET` | Investors (aggregates only) |

Ingest: `POST /api/track` → `solen_events` (migration `075`)  
Emitter: `src/lib/trackEvent.ts` · Module: `src/lib/ops-console`  
Docs: `docs/OPS_CONSOLE.md` · robots: Disallow `/ops` `/metrics`  
Domain: https://solenosai.netlify.app
