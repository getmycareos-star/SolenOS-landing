# Golden scenario → verify → runtime map

**Status:** Canonical architecture — Phase 3 Slice 3.3  
**Module markers:** [module-status.md](./module-status.md)  
**Purpose:** **Single onboarding table** — G1–G19 + dementia set + G61 → verify script → composer yes/no → runtime path.  
**SoT scenarios:** [`solenos-golden-caregiver-scenarios.md`](../02-product/solenos-golden-caregiver-scenarios.md)  
**Conflict ADRs:** [ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md) (G61 verify-only)

**Composer column**

| Value | Meaning |
|-------|---------|
| **yes** | Asserts `composeCaregiverResponse` and/or `buildLivingCareRecordResponse` output |
| **partial** | Pipeline / spine / unit test; composer not primary assertion |
| **no** | Engine-only; no compose assertions |
| **verify-only** | G61 bar in CI scripts only — not runtime compose gate |

**Runtime path (Path A):** `Input → DARE → SRE → ACS ingest → epistemics → progressive understanding → CRS → Decision Memory → composer → LCR panel`

---

## Master map (G1–G19 · dementia · G61)

| ID | Set | Scenario (short) | Verify script(s) | Composer | Runtime path |
|----|-----|------------------|------------------|----------|--------------|
| G1 | Core | First soft note | `verify:caregiver-response-composer`, `verify:relief-reasoning` | yes | ACS → CRS → `decideReliefDisclosure` → composer (gather-first, no Clarity) |
| G2 | Core | Improvement while situation open | `verify:situation-relationship-engine`, `verify:caregiver-response-composer` † | yes | SRE `ADD_RELATED_EVENT` → ACS improvement turn → composer (no distress reframe) |
| G3 | Core | New contributor, same person | `verify:continuity-core-tier1` | partial | Same ACS/CRS; `perspective-attribution` on observations |
| G4 | Core | Document only | `verify:continuity-core-tier1`, `verify:document-intake` | yes | Document → same pipeline; no analyzer/OCR chrome |
| G5 | Core | Emotional only | `verify:continuity-core-tier1`, `verify:golden-dementia-baseline` | yes | `emotional_only` turn → gather-first; no CareLoad/scores in UI |
| G6 | Core | Long chat / email | `verify:continuity-core-tier1`, `verify:live-thread-wire` | partial | `looksLikeCareThread` → `ingestCareThread`; source preserved; LCR strips envelope |
| G7 | Core | Hard safety | `verify:caregiver-response-composer`, `verify:dementia-entry-extended` | yes | Evidence-based risk + Clarity-faster after linked context; no kind shortcut |
| G8 | Core | Pushback / already answered | `verify:caregiver-response-composer` | yes | Acknowledge pushback; zero re-asks |
| G9 | Core | Guidance symptom (“what should I do?”) | `verify:caregiver-response-composer` ‡ | yes | Continuity Demand relief from held care; no invented facts |
| G10 | Core | Done for now → return | `verify:return-continuity`, `verify:done-for-now-continuity` | partial | Pause session; one soft invite; ACS/CRS persist |
| G11 | Core | Welcome → Begin restore | `verify:return-continuity`, `verify:welcome-first-visit` | partial | Durable care key restores ACS/CRS; new interaction session only |
| G12 | Core | Source conflict (doc vs note) | `verify:continuity-core-tier1` | yes | `source-conflict`: both retained; clinical/document orients |
| G13 | Core | Record question | `verify:continuity-core-tier1` (G13, G13b, G13c) | yes | `decision-memory` → composer why-path; not Clarity form |
| G14 | Core | Same words, different meaning | `verify:situation-relationship-engine`, `verify:caregiver-response-composer` | partial | SRE context-not-keywords; composer no decline assumption |
| G15 | Core | Duplicate / reinforce | `verify:situation-relationship-engine` | partial | `REINFORCE_EXISTING` ingest short-circuit; no duplicate ACS row |
| G16 | Core | Contradictory observations | `verify:continuity-core-tier1`, `verify:situation-relationship-engine` | yes | Both kept; `perspective-attribution` visible; not chat feed |
| G17 | Core | Identity mismatch | `verify:situation-relationship-engine`, `verify:caregiver-response-composer` | yes | One soft ask; `identity_mismatch` hold; no care-story chrome |
| G18 | Core | Long absence return (~3 mo) | `verify:return-continuity` | partial | `care-history-compression` + recent/unresolved projection; no dump |
| G19 | Core | Empty / thin input | `verify:caregiver-response-composer` | yes | `empty_or_thin`; no hallucinated work |
| G31 | Dementia-ext | Repeated questions → pattern | `verify:dementia-entry-extended` | partial | Pattern not N events; never “dementia worsening” |
| G32 | Dementia-ext | Personhood language | `verify:dementia-entry-extended` | yes | Ban “dementia patient” framing in composed copy |
| G33 | Dementia-ext | Routine disruption | `verify:dementia-entry-extended` | partial | Stop of usual activity held — not dismissed |
| G34 | Dementia-critical | Familiarity baseline | `verify:golden-dementia-baseline` | partial | `care-epistemics` person-told usual; change vs *their* usual |
| G35 | Dementia-ext | Same question 5× → pattern | `verify:dementia-entry-extended` | partial | With G31 — pattern label, not five unrelated events |
| G36 | Dementia-ext | Situation behind fact | `verify:dementia-entry-extended` | partial | Hold situation; never diagnose fear/confusion |
| G37 | Dementia-critical | Interpretation vs observation | `verify:golden-dementia-baseline` | yes | Epistemic separation in composed copy |
| G38 | Dementia-ext | Dignity language | `verify:dementia-entry-extended` | yes | Composer ban phrases (“failed to remember”, etc.) |
| G39 | Dementia-ext | Care transition memory | `verify:dementia-entry-extended` | yes | Transition framing in composed summary |
| G40 | Dementia-critical | Small signals → pattern | `verify:golden-dementia-baseline` | partial | `evaluateGradualChange`; progressive understanding |
| G41 | Dementia-critical | Preserving past self | `verify:golden-dementia-baseline` | partial | Personhood / life-change pattern |
| G42 | Dementia-ext | “Is this normal?” care signal | `verify:dementia-entry-extended` | partial | Held as signal; no empty reassure |
| G43 | Dementia-critical | Fluctuation not progression | `verify:golden-dementia-baseline` | partial | Day-to-day fluctuation; no “improved disease” |
| G44 | Dementia-critical | Caregiver memory transfer | `verify:golden-dementia-baseline`, `verify:care-context-durability` | partial | Durable care key restores ACS + CRS + familiarity |
| G45 | Dementia-critical | Unknown cause | `verify:golden-dementia-baseline` | partial | Change with unknown cause preserved |
| G46 | Dementia-critical | Change vs crisis | `verify:golden-dementia-baseline` | partial | Contained change vs elevated safety — no panic theater |
| G47 | Dementia-critical | Safety context memory | `verify:golden-dementia-baseline` | partial | Recurring safety area from prior evidence |
| G48 | Dementia-critical | Preference / personhood | `verify:golden-dementia-baseline` | partial | Preference recall by content overlap |
| G49 | Dementia-ext | Caregiver role transition | `verify:dementia-entry-extended` | partial | Role shift held over time |
| G50 | Dementia-critical | No caregiver blame | `verify:golden-dementia-baseline` | yes | Missed-care timing — manage, never judge |
| G51 | Dementia-critical | Family disagreement | `verify:golden-dementia-baseline` | partial | Disagreeing views held; no sides |
| G52 | Dementia-ext | Historical importance | `verify:dementia-entry-extended` | partial | Prior hazard ↔ later mobility linked |
| G53 | Dementia-ext | Journey milestones | `verify:dementia-entry-extended` | partial | Firsts / major turns as milestones |
| G54 | Dementia-critical | Natural language variability | `verify:golden-dementia-baseline` | partial | Everyday language; no medical vocab required |
| G55 | Dementia-critical | Question behind the question | `verify:golden-dementia-baseline` | partial | Continuity worry orients known/changed |
| G56 | Dementia-critical | No forced tracking | `verify:golden-dementia-baseline`, `verify:mvp-research-validation` | yes | No check-in homework / task-list product |
| G57 | Dementia-critical | Long-term evolution | `verify:golden-dementia-baseline`, `verify:return-continuity` | partial | `care-history-compression`; recent + important only |
| G58 | Dementia-ext | Ambiguous “acting strange” | `verify:dementia-entry-extended` | partial | Ask what differed; never assign meaning |
| G59 | Dementia-ext | No population comparison | `verify:dementia-entry-extended` | yes | Ban “other dementia patients…” in composer |
| G60 | Dementia-ext | Advanced care sensitivity | `verify:dementia-entry-extended` | partial | Held with care; not medical decision engine |
| G61 | Meta | Real Caregiver Test (2 AM) | `verify:golden-dementia-baseline`, `verify:continuity-core-tier1` (G13 spot) | partial | CI `assertRealCaregiverTest`; optional compose-path gate after acceptance ([ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md) amended) |

† **G2:** composer script block labeled `G3` internally (improvement fixture) — product ID G2 is authoritative.  
‡ **G9:** composer script block labeled `G6` (guidance demand) — product ID G9 is authoritative.

---

## Phase 2 spine verify bundle (+ Phase 4 scope lock)

Run together before Phase 5:

```bash
npm run verify:scope-lock                      # Phase 4 defer list + /api/situation
npm run verify:golden-scenario-map             # this map complete
npm run verify:future-capabilities             # Care Moment / voice gates
npm run verify:situation-relationship-engine   # G2, G14–G17, G15 reinforce
npm run verify:continuity-core-tier1           # G3–G6, G12–G13 (+G13c), G16; G61 spot on G13
npm run verify:caregiver-response-composer     # G1, G2†, G7–G9‡, G14, G17, G19
npm run verify:relief-reasoning                # G1 disclosure
npm run verify:golden-dementia-baseline      # G34–G37, G40–G41, G43–G48, G50–G51, G54–G57, G61
npm run verify:dementia-entry-extended         # G7, G31–G33, G35–G36, G38–G39, G42, G49, G52–G53, G58–G60
npm run verify:return-continuity               # G10, G11, G18, G57 projection
npm run verify:care-memory-maturity            # Held / care-story gate (cross-cutting)
```

---

## CI meta-verify (Slice 4.2)

```bash
npm run verify:golden-scenario-map
```

Checks:

- **Exact set** — all 50 required IDs (G1–G19 + dementia + G61) in master table, no duplicates, no extras
- **Row completeness** — each row has `verify:*` script(s), composer (`yes` / `partial` / `no` / `verify-only`), runtime path
- **G61** — composer = `partial` or `verify-only` ([ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md) amended: optional compose-path gate)
- **Scripts resolve** — every referenced `verify:*` exists in `package.json` and `scripts/verify-*.mts`

**Phase 4 bundle:** `npm run verify:phase4-scope-lock`

**Module:** `src/lib/golden-scenario-map` · **Machine twin:** `GOLDEN_SCENARIO_MAP` in `architecture-map.ts`

---

## Gaps (honest)

| Gap | Status |
|-----|--------|
| Memory correction (“she didn’t fall”) | **IMPLEMENTED** — Slice 2.4 · `verify:memory-correction` |
| Verify script internal IDs ≠ product IDs (G2/G3, G6/G9) | Documented above († ‡); rename verify comments in future hygiene PR |
| Single script for all IDs | **Not required** — this map is SoT |
| G61 on every verify | **No** — tier1 G13 + dementia baseline only ([ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md)) |
| G9 dedicated verify label | Covered under composer ‡ block; no separate `G9` string in scripts yet |

---

## When to update

Same PR as: new golden scenario · new verify script · composer path change · SRE edge wiring · ADR moving G61 placement.
