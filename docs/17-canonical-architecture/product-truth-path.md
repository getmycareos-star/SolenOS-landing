# Product truth path vs internal compile

**Status:** Canonical architecture — **IMPLEMENTED** (caregiver path) · **INTERNAL** (parallel compile)  
**Authority:** Resolves doc/code conflicts about pipeline order, `final_output`, disclosure, and “what caregivers see.”  
**Machine twin:** `PRODUCT_TRUTH_PATH` in `src/lib/solenos-layers/architecture-map.ts`  
**Companions:** [system-architecture.md](./system-architecture.md) · [ADR-022](../15-architecture-decisions/ADR-022-caregiver-response-contract.md) · [`solenos-response-contract.md`](../02-product/solenos-response-contract.md) · [`caregiver-response-contract.md`](../02-product/caregiver-response-contract.md)

---

## Rule (locked)

> **Caregiver product truth = the composer / Living Care Record path only.**  
> Anything compiled before ACS + CRS + Decision Memory + `composeCaregiverResponse` is **internal telemetry / arbitration**, not what a tired caregiver should trust.

If `final_output` and the composer disagree, **the composer wins** for MVP workspace, panel, and caregiver DTO surfaces.

---

## Two paths in `situation-entry`

`POST /api/situation` → `processSituationInput` (`src/lib/situation-entry/pipeline.ts`) runs **both** paths. Only one is product truth.

### A — Product truth path (caregiver-facing)

**What caregivers see** in `CognitiveWorkspace` → `SituationResponsePanel` → `LivingCareRecordPanel`.

```
Input (text / document)
  → DARE / CareEvents (capture always)
  → Situation Relationship Engine (spine link before append)
  → Active Care Situation ingest
       → care-epistemics (care-worthy vs product meta)
       → progressive understanding (delta, gaps, asks)
       → Care Reality State (CRS — current belief SoT)
       → Decision Memory (when decisions / record questions)
  → composeCaregiverResponse (sole copy authority)
       → decideReliefDisclosure → selectResponseFacets
       → resolveCareTurnConfirmation (care-story gate)
       → buildResponseIntelligenceOutput
       → assertResponseAcceptanceGate
  → buildLivingCareRecordResponse (merge disclosure for panel)
  → LivingCareRecordPanel
```

| Step | Module | Role |
|------|--------|------|
| Care-worthy gate | `src/lib/care-epistemics`, `progressive-understanding/questions` | Product meta ≠ care evidence; `careWorthyCount`, `latestIsCareWorthy` |
| Relief disclosure | `src/lib/response-contract/relief-decision.ts` | When Clarity / asks / follow-up may disclose |
| Confirmation | `src/lib/care-memory-maturity` (`resolveCareTurnConfirmation`) | Never “Added to the care story” until care-worthy evidence on a care-worthy turn |
| Transformation gate | `src/lib/response-acceptance-gate` | Reject summarization, empathy scripts, fake continuity |
| Panel | `src/lib/living-care-record-ux/build-response.ts` | Projects composer output; overrides CRS plan with `composed.show_clarity` |

**Verify:** `verify:relief-reasoning` · `verify:caregiver-response-composer` · `verify:response-intelligence-upgrade` · `verify:care-memory-maturity`

### B — Internal compile path (not product truth)

**Runs earlier in the same pipeline** (~`enforceCompiledDominantOutput` in `pipeline.ts`).

```
Input
  → continuous execution loop / runtime arbitration
  → state_of_care · adoption wedge · clarification · crisis modes
  → final_output (dominant mode compile)
  → (later) post-hoc patches: care-reality-intelligence snapshot, engine foundation on final_output only
```

| Property | Status |
|----------|--------|
| Feeds MVP caregiver panel? | **No** |
| May diverge from composer? | **Yes** — by design until unified or demoted |
| Search Demand refusal | **Yes** — `applySearchDemandContinuityRedirect` on `final_output` |
| Exposed on API? | Partial — DTO may still carry stripped fields; not primary LCR render |
| Use for product QA? | **No** — use composer + acceptance gate + golden verifies |

**Honesty marker:** `final_output` = **INTERNAL / TELEMETRY-ADJACENT** for MVP caregiver product. Not deprecated — used for arbitration, north-star search redirect, and ops — but **not** the Living Care Record promise.

---

## Pipeline order (documented vs actual)

Product docs often show an **ideal narrative spine**:

```
Input → Care Reality Understanding → Situation Relationship Engine → Decision Memory → CRS → Response
```

**Actual runtime order in `processSituationInput`:**

1. Capture + DARE + CareEvents  
2. SRE spine link (relationship decision on raw input)  
3. **Internal compile** → `final_output`  
4. ACS ingest → epistemics → progressive understanding → CRS → Decision Memory  
5. **Composer response** (returned to workspace via ACS turn + LCR build)

**Alignment rule for docs:** When describing **caregiver behavior**, use path **A** order. When describing **situation-entry internals**, acknowledge step 3 as internal compile, not caregiver truth.

SRE-on-raw-input before full CRS update is **accepted MVP behavior** — relationship is decided from ACS state + content signals, then understanding/CRS catch up in ingest.

---

## Disclosure: two authorities, one caregiver surface

Two systems propose what may show:

| Authority | Source | Primary for… |
|-----------|--------|----------------|
| **Relief decision tree** | `decideReliefDisclosure` → `selectResponseFacets` | **Clarity triad**, ask cap, follow-up, what-is-happening |
| **CRS disclosure plan** | `buildDisclosurePlan` / `disclosureStageFor` | Evidence maturity, stage labels, remembered themes |

**Merge rule (locked):** At `buildLivingCareRecordResponse`, **composer gates win** for Clarity and asks:

- `show_what_matters_now: composed.show_clarity`
- `max_questions` from composed ask count
- `resolveCareTurnConfirmation` wins for Held / care-story chrome

CRS plan remains useful for **evidence depth** and stage copy — not a second Clarity gate.

**Connection disclosure:** `show_connection` is composer-owned — set when returning continuity warrants a separate “How this connects” section; panel and LCR view gate on `disclosure_plan.show_connection`, never `observation_count` alone.

---

## Decisions: what is aligned vs deferred

| Decision type | Product truth path | Notes |
|---------------|-------------------|--------|
| SRE: update / related / answer uncertainty / new unrelated | **Yes** — spine + ACS | `verify:situation-relationship-engine` |
| Decision Memory schema + record questions | **Yes** — ingest + composer | G13 |
| Relief disclosure modes incl. `product_meta_turn` | **Yes** | `verify:relief-reasoning` |
| `REINFORCE_EXISTING` | **IMPLEMENTED** | G15: ingest short-circuit; spine events merge without duplicate ACS row |
| `UNCERTAIN_NEEDS_REVIEW` → caregiver ask | **IMPLEMENTED** | G17: ingest holds ACS; composer one soft ask; acceptance gate rejects care-story chrome |
| Decision epistemic signal | **IMPLEMENTED** | `decision-memory/decision-signal.ts` — unified SRE Signal 6 + Decision Memory + composer; SRE `ADD_RELATED_EVENT` for improvement (G2) intentionally skips Decision Memory |
| `ADDITIONAL_CONTEXT` enum | **STUB** | ACS multi-contributor override; not returned from SRE evaluate |
| North Star `feature_gate_passed` | **TELEMETRY** | Does not block runtime features |
| PostgreSQL `care_situations` graph tables | **SCHEMA-ONLY · FUTURE** | MVP = ACS + event attributes |
| Memory correction ingest wire | **IMPLEMENTED** | Principle-based detect → ACS `ingestMemoryCorrection` → CRS; prior kept disputed — Slice 2.4 · `verify:memory-correction` |

**Honest markers index:** [`module-status.md`](./module-status.md) · **Golden map:** [`golden-scenario-map.md`](./golden-scenario-map.md)

---

## Responses & reasoning: single writer

| Concern | Product truth | Internal only |
|---------|---------------|-----------------|
| Caregiver sentences | `caregiver-response-composer` | `final_output` strings |
| Response Contract fields | `buildResponseIntelligenceOutput` | Arbitration templates |
| Never-say / empathy ban | acceptance gate + composer bans | — |
| Known / Likely / Unknown labels | MVP maps to Known / Changed / Still unclear in copy | — |
| Risk level | Evidence → `attention_label`; no scores in UI | `risk_level` on contract DTO |
| G61 Real Caregiver Test | Verify scripts (`real-caregiver-test`) | Not runtime compose gate ([ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md)) |
| Care Reality Intelligence facade | — | Post-hoc snapshot; does not feed composer |
| Engine foundation 13 phases | Baseline note bridge only | Mutates `final_output` post-compile |

**Reasoning depth:** Product moat test = composer path reconstructs change, gaps, and continuity from messy input. Internal compile must not be used to claim “SolenOS understood” in caregiver QA.

---

## When to update this doc

Update in the same PR when:

- `processSituationInput` order changes  
- `final_output` becomes caregiver-visible (should not happen without ADR)  
- Disclosure merge rules change in `build-response.ts`  
- A second caregiver copy path is introduced  
- SRE edge decisions get composer wiring (`UNCERTAIN`, `REINFORCE`, `ADDITIONAL_CONTEXT`)

---

## Quick reference for engineers

**Adding caregiver-facing copy?** → Only `caregiver-response-composer` (+ output-quality helpers).  
**Adding a Clarity gate?** → Only `relief-decision.ts` (+ verify-relief-reasoning).  
**Adding care-story / Held chrome?** → Only `resolveCareTurnConfirmation` (+ acceptance gate).  
**Testing caregiver behavior?** → Golden verifies + composer path — **not** `final_output` alone.  
**Ops / analyze / v1.4 pipeline?** → Separate surface; not MVP workspace product truth.

---

## Build sequence

Phases 1–5 slice order, verify gates, and ~90→95 maturity targets: [`spine-build-sequence.md`](./spine-build-sequence.md).

**Onboarding (Phase 3 exit):** Read **this doc** + [`solenos-decision-continuity.md`](../02-product/solenos-decision-continuity.md) before touching caregiver or decision behavior. Optional depth: [`module-status.md`](./module-status.md) · [`golden-scenario-map.md`](./golden-scenario-map.md).
