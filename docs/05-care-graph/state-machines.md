# State Machines — Care, Caregiver, Family, Delegation

**Status:** Behavioral states are computed each analyze pass (mostly DERIVED/STATE flags). This is the governed vocabulary for transitions. Persistence of historical state machines across restarts is **not** durable today.

## 1. Care system states (operational)

| State | Meaning | Typical triggers | Rollback / exit |
|-------|---------|------------------|-----------------|
| **stable** | Load LOW/MODERATE; graph healthy; no fail-safe | Calm input; pressures handled | N/A |
| **overloaded** | CLI HIGH or fatigue HIGH; surface limits shrink | Many high-pressure demands; interaction load | Complete/delegate demands; load drops |
| **at-risk** | Graph at_risk OR rising burnout OR unresolved HIGH situations | Unassigned ownership; conflicts; missing critical | Assign owners; resolve conflicts; clarify beliefs |
| **crisis** | Crisis risks emitted and/or CLI CRITICAL + containment/fail-safe | Predictive P thresholds; acute triad | Address top risk; safety-gated actions only |

**Note:** `care_context_state` on interactions (`active_care | crisis | post_care | uncertain`) is **observational telemetry**, not the product mode engine.

## 2. Caregiver states

| Signal | Source | Effect |
|--------|--------|--------|
| Load bands LOW→CRITICAL | CLI | Surface limit 4→1 |
| Burnout rising / critical | Load engine (~0.55 / 0.75) | Burden messages; action reduction |
| Acute burnout / containment | Psych load high-signal (emotional+sleep+uncertainty) | Max 1 action |
| Attention Now/Watch/Later | Attention engine | Ranking language |
| Fail-safe engaged | Fail-safe mode | Clarify-before-action; confidence cap |

**Rollback:** New analyze with reduced structural load / completed critical demands — not an explicit undo stack (human override STUB).

## 3. Family system states

| State | Triggers | Notes |
|-------|----------|-------|
| Coordinated | Shared caregivers; healthy graph | Coordination load still counted |
| Fragmented | Unassigned / blocked ownership | Delegation candidates appear when load elevated |
| Conflicted | Open conflicts / family_conflict demands | Belief confidence penalty; family crisis P |
| Single-caregiver pressure | Profile / depletion flags | Support-signal evaluate may fire |

## 4. Delegation states

| State | Meaning |
|-------|---------|
| **inactive** | CLI not HIGH/CRITICAL → suggestions `[]` |
| **suggesting** | Suggestions computed (max 3); ownership **unchanged** |
| **accepted** | FUTURE — decision history may record accept; auto-apply ownership **not built** |
| **rejected / ignored** | FUTURE learning signal; ignore tracking **partial** via compounding stores only |

## Edge cases

- Crisis state without medical category match → caregiver/family/financial only
- Overloaded + no persons → overloaded without delegation relief
- Override API records intent only — **no transition rollback of STATE**

## Related engines

- Care graph: `05-care-graph`
- Load: `06-careload-engine`
- Crisis: `08-crisis-engine`
- Delegation: `09-delegation-engine`
