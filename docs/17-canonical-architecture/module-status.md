# Module implementation status (honest markers)

**Status:** Canonical architecture — Phase 3 Slice 3.1  
**Purpose:** Stop drift. One place for **IMPLEMENTED · IN-MEMORY · STUB · SCHEMA-ONLY · FUTURE · INTERNAL** labels.  
**Rule:** If code changes behavior, update this table in the same PR. Conflicts without ADR are bugs.  
**Machine twin:** `src/lib/solenos-layers/architecture-map.ts` · **Onboarding:** [product-truth-path.md](./product-truth-path.md) · [golden-scenario-map.md](./golden-scenario-map.md)

---

## Legend

| Marker | Meaning |
|--------|---------|
| **IMPLEMENTED** | Shipped on MVP caregiver or spine path; covered by verify scripts |
| **IN-MEMORY** | Logic works; durable persistence partial or JSON-only |
| **STUB** | Types / facade / noop adapter only |
| **SCHEMA-ONLY** | Postgres/migration exists; not wired to product path |
| **FUTURE** | Contract or library present; must not ship UI without ADR |
| **INTERNAL** | Runs in pipeline; not caregiver product truth |
| **TELEMETRY** | Metrics / gates; does not block runtime by default |

**Dual labels:** `IMPLEMENTED · IN-MEMORY` = works on product path, JSON/process memory only.  
**Path note:** Caregiver truth = Path A (`/api/situation` composer). Analyze / v1.4 = Path B unless noted.

---

## Path A — Caregiver product truth (`/api/situation`)

| Module | Role | Status | Verify (primary) |
|--------|------|--------|------------------|
| `situation-entry/pipeline` | Orchestration | **IMPLEMENTED** | `verify:situation-entry`, `verify:single-user-journey` |
| `situation-entry/caregiver-response-dto` | Strips internal compile from DTO | **IMPLEMENTED** | `verify:living-care-record-regression` |
| `situation-relationship-engine` | SRE before spine append | **IMPLEMENTED** | `verify:situation-relationship-engine` |
| `active-care-situation` | ACS ingest + turns | **IMPLEMENTED · IN-MEMORY** | `verify:active-care-situation` |
| `progressive-understanding` | Understanding delta | **IMPLEMENTED** | `verify:progressive-understanding` |
| `care-reality-state` | CRS — belief SoT | **IMPLEMENTED · IN-MEMORY** | `verify:care-reality-state` |
| `decision-memory` | Why-path + record questions | **IMPLEMENTED · IN-MEMORY** | `verify:continuity-core-tier1` (G13) · SoT: [`solenos-decision-continuity.md`](../02-product/solenos-decision-continuity.md) |
| `decision-memory/decision-signal` | Unified epistemic decision detector | **IMPLEMENTED** | G13c, `verify:situation-relationship-engine` |
| `caregiver-response-composer` | Sole caregiver copy | **IMPLEMENTED** | `verify:caregiver-response-composer` |
| `response-intelligence` | Contract field assembly | **IMPLEMENTED** | `verify:response-intelligence`, `verify:response-intelligence-upgrade` |
| `response-behavior` | Turn class + facet selection | **IMPLEMENTED** | composer verify |
| `response-acceptance-gate` | Transformation reject | **IMPLEMENTED** | composer + `verify:response-intelligence-upgrade` |
| `response-contract` | Response Contract types | **IMPLEMENTED** | `verify:response-contract` |
| `response-contract/relief-decision` | Clarity / ask disclosure | **IMPLEMENTED** | `verify:relief-reasoning` |
| `response-contract/disclosure-merge` | Relief → CRS plan merge | **IMPLEMENTED** | `verify:relief-reasoning`, `verify:living-care-record-ux` |
| `living-care-record-ux` | Panel projection | **IMPLEMENTED** | `verify:living-care-record-ux` |
| `care-epistemics` | Care-worthy vs meta | **IMPLEMENTED** | `verify:golden-dementia-baseline` |
| `care-memory-maturity` | Held / care-story gate | **IMPLEMENTED** | `verify:care-memory-maturity` |
| `mvp-input-architecture` | Text + document entry (ADR-018) | **IMPLEMENTED** | `verify:input-entry-contract` |
| `mvp-workspace` | Four-state cognitive workspace UI | **IMPLEMENTED** | `verify:mvp-surface-area` |
| `return-continuity` | G10 soft invite | **IMPLEMENTED** | `verify:return-continuity` |
| `done-for-now-continuity` | Session pause, not resolve | **IMPLEMENTED** | `verify:done-for-now-continuity` |
| `care-recipient-identity` | Display name / recipient SoT | **IMPLEMENTED · IN-MEMORY** | `verify:care-recipient-identity` |
| `adoption-wedge-engine` | Chaos-first capture | **IMPLEMENTED** | `verify:chaos-to-clarity` |
| `trust-content` + public routes | Welcome / trust pages | **IMPLEMENTED** | `verify:welcome-first-visit`, `verify:trust-consent` |
| `product-north-star` | Scope gate (Search Demand redirect) | **IMPLEMENTED · TELEMETRY** | `verify:product-north-star` |
| `product-constitution` | Worldview + CareRecord spine | **IMPLEMENTED** | `verify:product-constitution` |
| `product-identity` | SolenOS naming contracts | **IMPLEMENTED** | `verify:product-identity` |
| `forbidden-build-zone` | Anti-pattern gate | **IMPLEMENTED** | `verify:forbidden-build-zone` |
| `future-capabilities` | Assert-not-MVP guard | **IMPLEMENTED** (guard) | `verify:future-capabilities` |

---

## Continuity & golden gates (Path A)

| Module | Golden | Status | Verify |
|--------|--------|--------|--------|
| `thread-ingestion` | G6 | **IMPLEMENTED** | `verify:live-thread-wire`, tier1 |
| `source-conflict` | G12 | **IMPLEMENTED · IN-MEMORY** | `verify:continuity-core-tier1` |
| `decision-memory` | G13 | **IMPLEMENTED · IN-MEMORY** | tier1 |
| `perspective-attribution` | G16 | **IMPLEMENTED** | tier1 |
| `return-continuity` | G10, G18 | **IMPLEMENTED** | `verify:return-continuity` |
| `care-history-compression` | G57 | **IMPLEMENTED** | `verify:return-continuity` |
| `dementia-entry-extended` | G7, Tier 4 set | **IMPLEMENTED** | `verify:dementia-entry-extended` |
| `real-caregiver-test` | G61 | **IMPLEMENTED** | `verify:golden-dementia-baseline` — CI assert + optional compose-path gate (ADR-025 amended) |
| `mvp-research-validation` | Retention hypothesis + Slice 5.6 weekly cohort (ops) | **IMPLEMENTED** | `verify:mvp-research-validation` |
| `single-user-journey` | Two-input continuity | **IMPLEMENTED** | `verify:single-user-journey` |

---

## Capture & evidence (Path A inputs)

| Module | Role | Status | Verify |
|--------|------|--------|--------|
| `data-acquisition-resilience` | DARE / CareEvents | **IMPLEMENTED** | `verify:data-acquisition-resilience` |
| `event-sourced-storage` | Event store + projections | **IMPLEMENTED · IN-MEMORY** | `verify:store`, `verify:continuous-care-record` |
| `document-evidence` | Source metadata + hash | **IMPLEMENTED** | tier1, doc intake |
| `tika-extractor` + `/api/extract` | Document text extract | **IMPLEMENTED** | `verify:tika`, `verify:document-intake` |
| `event-normalization` | Dedup / normalize | **IMPLEMENTED** | `verify:event-normalization` |
| `living-care-record-persistence` | ACS/CRS JSON durable | **IN-MEMORY** | `verify:living-care-record-regression` |

---

## SRE edge decisions (Phase 2 spine)

| Decision | Status | Notes |
|----------|--------|-------|
| `UPDATE_EXISTING_SITUATION` | **IMPLEMENTED** | Default soft/hard continuity |
| `ADD_RELATED_EVENT` | **IMPLEMENTED** | Decisions + improvement (G2) |
| `ANSWER_PREVIOUS_UNCERTAINTY` | **IMPLEMENTED** | `answers_uncertainty` relation |
| `REINFORCE_EXISTING` | **IMPLEMENTED** | Ingest short-circuit (G15) |
| `UNCERTAIN_NEEDS_REVIEW` / identity mismatch | **IMPLEMENTED** | One soft ask (G17) |
| `NEW_UNRELATED_SITUATION` | **IMPLEMENTED** | Opens new ACS |
| `ADDITIONAL_CONTEXT` | **STUB** | ACS multi-contributor override only; not SRE evaluate return |

---

## Memory & correction

| Module | Status | Notes |
|--------|--------|-------|
| `decision-memory` | **IMPLEMENTED · IN-MEMORY** | G13 |
| `care-reality-extraction` | **IMPLEMENTED** | Observation → Event → Decision → Relationship → Response Contract · Unknown = knowledge boundary (never fill gaps) · `verify:care-reality-extraction` |
| Path A preview gate | **IMPLEMENTED** | `npm run verify:product-path` · integrity SoT `docs/02-product/solenos-product-integrity.md` · preview honesty `docs/13-infrastructure/preview-qualification.md` · single-process `.data/` only |
| `care-reality-language` | **IMPLEMENTED** | Ban notes/storage chrome · Care Story understanding language · `verify:care-reality-language` |
| `intelligence-no-hardcode` | **IMPLEMENTED** | Never keyword/symptom lists · care-reality reasoning structure · `verify:intelligence-no-hardcode` |
| `illustration-vs-implementation` | **IMPLEMENTED** | Doc examples ≠ product · structure not sentences · `verify:illustration-vs-implementation` |
| `care-reality-situation-model` | **IMPLEMENTED** | Model before language · baseline→change · pipeline-first · `verify:care-reality-situation-model` |
| `care-recipient-anchor` | **IMPLEMENTED** | Care recipient = center · contributors = context · `verify:care-recipient-anchor` |
| `baseline-comparison-engine` | **IMPLEMENTED** | Previous→now change · living baseline · no dementia causation · `verify:baseline-comparison-engine` |
| `initial-care-reality-assessment` | **IMPLEMENTED** | No comparable prior → first understanding · never hallucinate change · `verify:initial-care-reality-assessment` |
| `situation-generator` | **IMPLEMENTED** | Active Situation understanding · not fact-list summary · `verify:situation-generator` |
| `care-reality-memory` | **IMPLEMENTED** | Journey objects not sentences · reality≠text recurrence · `verify:care-reality-memory` |
| `intelligence-validation` | **IMPLEMENTED** | Hard rejection · understanding gate · `verify:intelligence-validation` |
| `caregiver-understanding-test` | **IMPLEMENTED** | 30-second midnight test · four dimensions · `verify:caregiver-understanding-test` |
| `clinical-situation-classification` | **IMPLEMENTED** | Internal situation categories · reasoning only · never caregiver labels · `verify:clinical-situation-classification` |
| `uncertainty-preservation` | **IMPLEMENTED** | What happened vs why · never correlation→cause · `verify:uncertainty-preservation` |
| `care-reality-engine/memory-correction` | **IMPLEMENTED · IN-MEMORY** | `recordMemoryCorrection` + ACS ingest wire |
| `care-reality-engine/detect-memory-correction` | **IMPLEMENTED** | Principle-based cues; `ingestMemoryCorrection` in ACS ingest (Slice 2.4) |
| `data-acquisition-resilience/corrections` | **INTERNAL** | CareEvent correction path; not ACS/CRS wire |

---

## Path B — Internal compile (`/api/analyze`, v1.4)

**Not caregiver product truth.** See [product-truth-path.md](./product-truth-path.md).

| Module | Role | Status | Verify |
|--------|------|--------|--------|
| `analyze-pipeline` | v1.4 LLM + engine assembly | **INTERNAL · IMPLEMENTED** | `verify:analyze` |
| `continuous-execution-loop` | Mode compile before ACS | **INTERNAL** | `verify:continuous-execution-loop` |
| `priority-resolution-system` / runtime arbitration | Dominant output mode | **INTERNAL** | `verify:runtime-arbitration` |
| `final_output` | Compiled dominant mode | **INTERNAL** | `verify:final-output-contract` |
| `edge-state-machine` | crisis/conflict/stale/degraded | **INTERNAL · IMPLEMENTED** | layered-architecture |
| `state-of-care-summary-engine` | Summary mode | **INTERNAL** | `verify:state-of-care-summary-engine` |
| `clarification-engine` | Clarification mode | **INTERNAL** | `verify:clarification-engine` |
| `crisis-mode-interaction-layer` | Crisis mode compile | **INTERNAL** | `verify:crisis-mode-interaction-layer` |
| `care-reality-intelligence` | Post-hoc snapshot facade | **INTERNAL** | `verify:care-reality-intelligence` |
| `care-reality-engine/process` | Foundation; patches `final_output` | **INTERNAL** | `verify:care-reality-engine` |
| `care-reality-engine/foundation` | 13-phase baseline bridge | **INTERNAL** | `verify:care-reality-engine` |
| `case-memory` | PRP + Decision Snapshot | **INTERNAL · IN-MEMORY** | case-memory verify path |
| `deterministic-prioritization` | 6-field Decision Snapshot overlay | **INTERNAL · IMPLEMENTED** | `verify:deterministic-prioritization` |
| `observation-intelligence` | Text observation language | **INTERNAL · IMPLEMENTED** | observation path |
| `north-star` feature gate | Feature eval log | **TELEMETRY** | `verify:product-north-star` |
| `ops-console` + `/api/track` | Founder/eng console | **INTERNAL** | `verify:ops-console` |

---

## v1.4 DERIVED engines (analyze path — INTERNAL for MVP caregiver)

| Module | Status | Verify |
|--------|--------|--------|
| `caregiver-load-engine` | **INTERNAL · IMPLEMENTED** | `verify:caregiver-load-engine` |
| `caregiver-load-index` | **INTERNAL · IMPLEMENTED** | `verify:caregiver-load-index` |
| `emotional-load-signal` | **INTERNAL · IMPLEMENTED** | `verify:emotional-load-signal` |
| `load-interpretation` | **INTERNAL · IMPLEMENTED** | `verify:load-interpretation` |
| `interaction-load-signal` | **INTERNAL · IMPLEMENTED** | `verify:interaction-load-signal` |
| `caregiver-psychological-load` | **INTERNAL · IMPLEMENTED** | `verify:caregiver-psychological-load` |
| `attention-engine` | **INTERNAL · IMPLEMENTED** | `verify:behavioral-spec-v1` |
| `priority-engine` + Priority Contract | **INTERNAL · IMPLEMENTED** | `verify:priority-engine`, `verify:priority-contract` |
| `time-engine` + `time-weighting` | **INTERNAL · IMPLEMENTED** | `verify:time-engine` |
| `crisis-prevention-layer` | **INTERNAL · IMPLEMENTED** | crisis PRD verify path |
| `confidence-layer` | **INTERNAL · IMPLEMENTED** | confidence PRD verify path |
| `delegation-layer` | **INTERNAL · IMPLEMENTED** | suggest-only |
| `fail-safe-mode` | **INTERNAL · IMPLEMENTED** | `verify:fail-safe-mode` |
| `safety-enforcement` | **INTERNAL · IMPLEMENTED** | `verify:safety-enforcement` |
| `human-trust-layer` | **INTERNAL · IMPLEMENTED** | `verify:human-trust-layer` |
| `family-intelligence` | **INTERNAL · IN-MEMORY** | strategic 5-asset facade |
| `confidence-calibration-system` | **INTERNAL · IMPLEMENTED** | layered-architecture |

---

## v1.4 STATE / BELIEF / EXPLANATION (analyze — INTERNAL for MVP caregiver)

| Module | Layer | Status | Verify |
|--------|-------|--------|--------|
| `solenos-layers/state` | STATE canonical | **INTERNAL · IMPLEMENTED** | `verify:layered-architecture` |
| `resolution-engine` | Situation lifecycle | **INTERNAL · IMPLEMENTED** | `verify:resolution-engine` |
| `demand-engine` | Demands | **INTERNAL · IMPLEMENTED** | `verify:demand-engine` |
| `responsibility-graph` | Ownership graph | **INTERNAL · IN-MEMORY** | `verify:responsibility-graph` |
| `solenos-layers/belief` | BeliefItem unified | **INTERNAL · IMPLEMENTED** | layered-architecture |
| `assumption-registry` | Assumptions | **INTERNAL · IMPLEMENTED** | `verify:assumption-registry` |
| `missing-information-queue` | Missing info | **INTERNAL · IMPLEMENTED** | `verify:missing-information-queue` |
| `conflict-detection` | Belief/priority conflicts | **INTERNAL · IMPLEMENTED** | `verify:conflict-detection` |
| `solenos-layers/explanation` | Timeline + WHY | **INTERNAL · IMPLEMENTED** | layered-architecture |
| `continuity-properties` | SRL, EUM, OML, FDLL | **INTERNAL · IMPLEMENTED** | `verify:continuity-properties` |
| `unknowns-engine` | Disease-agnostic unknowns | **INTERNAL · IMPLEMENTED** | `verify:unknowns-engine` |

---

## Persistence & graph

| Surface | Status | Notes |
|---------|--------|-------|
| ACS / CRS durable JSON (`.data/`) | **IN-MEMORY** | `living-care-record-persistence` |
| Event-sourced CareEvents | **IN-MEMORY** (+ optional Postgres telemetry) | Rebuild invariant |
| PostgreSQL `care_situations` / graph | **SCHEMA-ONLY · FUTURE** | MVP = ACS + event attributes |
| `users.care_profile_state` | **SCHEMA-ONLY** | No full TS reader/writer |
| Case Memory Postgres adapter | **STUB** | noop in map |
| Family Intelligence Postgres adapters | **STUB** | noop |
| Caregiver load engine Postgres persist | **STUB** | session Maps only |
| Auth credential path | **STUB · SCHEMA-ONLY** | columns exist; MVP soft keys |
| Situation Graph UI | **FUTURE** | Phase 4 defer |

---

## Identity & collaboration

| Module | Status | Notes |
|--------|--------|-------|
| `care-recipient-identity` | **IMPLEMENTED · IN-MEMORY** | One recipient per LCR |
| `care-identity` | **IMPLEMENTED** | Contributor attribution |
| `multi-caregiver-context-model` | **STUB · FUTURE** | Types; not MVP social feed |
| Household / family workspace | **FUTURE** | Out of MVP scope |

---

## Voice & I/O

| Surface | Status | Notes |
|---------|--------|-------|
| Text + document input (ADR-018) | **IMPLEMENTED** | Scan / Snap / Upload / Share contract |
| `src/lib/voice` (STT/TTS) | **STUB · FUTURE** | ADR-017 contract; ADR-018 unmounts MVP |
| Voice Conversation UI | **FUTURE** | Ops devtools panel only |
| Whisper / cloud TTS | **FUTURE** | ADR-013 upgrade path |

---

## Future capabilities (`assertFutureCapabilityNotMvp()`)

| Capability | Status |
|------------|--------|
| Care Moment / I Need Clarity UI | **FUTURE** |
| Care Understanding Confidence screens | **FUTURE** |
| Care Transition Mode UI | **FUTURE** |
| Help Me Communicate This | **FUTURE** |
| Family chat / social feed | **FUTURE** |
| Situation Graph visualization | **FUTURE** |
| PostgreSQL graph as runtime truth | **FUTURE** |

---

## Known stubs & gaps

| Gap | Module | Status |
|-----|--------|--------|
| Human override (dismiss priorities) | `human-override` | **STUB** |
| Reality drift detection | `reality-drift` | **STUB** |
| ELS recovery time minutes | `emotional-load-signal` | **STUB** (labeled values) |
| Memory correction ingest wire | detect + ingest | **IMPLEMENTED** (Slice 2.4 · `verify:memory-correction`) |
| `ADDITIONAL_CONTEXT` SRE return | SRE evaluate | **STUB** |
| Auto-reassign delegation | delegation-layer | **FUTURE** (forbidden MVP) |

---

## PRD index (affected modules)

| PRD | Primary modules | Status summary |
|-----|-----------------|----------------|
| [care-graph-prd](../02-product/prds/care-graph-prd.md) | responsibility-graph, care-profile, FI care-graph | **INTERNAL · IN-MEMORY** |
| [case-memory-prd](../02-product/prds/case-memory-prd.md) | case-memory | **INTERNAL · IN-MEMORY** |
| [careload-prd](../02-product/prds/careload-prd.md) | load-engine, CLI, ELS, attention | **INTERNAL · IMPLEMENTED** |
| [confidence-engine-prd](../02-product/prds/confidence-engine-prd.md) | confidence-layer | **INTERNAL · IMPLEMENTED** |
| [crisis-engine-prd](../02-product/prds/crisis-engine-prd.md) | crisis-prevention-layer | **INTERNAL · IMPLEMENTED** |
| [delegation-engine-prd](../02-product/prds/delegation-engine-prd.md) | delegation-layer | **INTERNAL · IMPLEMENTED** |
| [deterministic-prioritization-prd](../02-product/prds/deterministic-prioritization-prd.md) | deterministic-prioritization | **INTERNAL · IMPLEMENTED** |
| [voice-conversation-mvp](../02-product/prds/voice-conversation-mvp.md) | voice | **FUTURE** |
| [voice-observation-capture](../02-product/prds/voice-observation-capture.md) | voice, observation-intelligence | **FUTURE** (text obs **INTERNAL**) |

---

## Conflict ADRs (Phase 3.2)

Doc/code disagreements locked by ADR — update ADR in same PR if intentionally changing behavior.

| Topic | ADR | Resolution |
|-------|-----|------------|
| Emotional phrasing | [ADR-023](../15-architecture-decisions/ADR-023-emotional-phrasing-record-voice.md) | Composer **bans** “That sounds difficult” / therapy empathy; **allows** record voice (“You mentioned…”) |
| Epistemic labels | [ADR-024](../15-architecture-decisions/ADR-024-epistemic-labels-internal-vs-lcr.md) | **Internal:** Known/Likely/Unknown · **Caregiver UI:** understanding / changed / still unclear |
| G61 placement | [ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md) | CI assert + optional compose-path gate (dev throw / prod log); never blocks capture |

---

## Phase 4 scope lock (ACTIVE until Phase 5)

| Deferred | Gate |
|----------|------|
| Situation Graph UI · pipeline reorder · postgres graph runtime · runtime NS block · analyze as caregiver primary | `assertPhaseScopeLockNotMvp` |
| Care Moment / I Need Clarity / voice UI | `assertFutureCapabilityNotMvp` + `scanDeferredSurfaceContent` on deferred paths |

**Doc:** [scope-lock.md](./scope-lock.md) · **Verify:** `verify:scope-lock` · `verify:golden-scenario-map` · `verify:phase4-scope-lock` · `verify:future-capabilities`

---

## When to update

Same PR as: behavior change · new verify script · ADR moving a marker · completing Slice 2.4 / Phase 5 wiring · new PRD module.
