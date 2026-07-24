# Decision Memory + Care Continuity

**Status:** Product directive — **IMPLEMENTED** (Decision Memory + ingest/composer path)  
**Authority:** Product Steward · promoted from cursor rule (Phase 3 Slice 3.4)  
**Cursor rule:** [`.cursor/rules/solenos-decision-continuity.mdc`](../../.cursor/rules/solenos-decision-continuity.mdc) — pointer only; **this file is SoT**

**Onboarding:** Read with [product-truth-path.md](../17-canonical-architecture/product-truth-path.md) before changing decision ingest, G13 behavior, or document→care loops.

**Companions:**  
[`solenos-mvp-situation-relationship-architecture.md`](./solenos-mvp-situation-relationship-architecture.md) ·  
[`solenos-input-reality-directive.md`](./solenos-input-reality-directive.md) ·  
[`solenos-evidence-visibility-directive.md`](./solenos-evidence-visibility-directive.md) ·  
[`caregiver-response-contract.md`](./caregiver-response-contract.md) ·  
[`golden-scenario-map.md`](../17-canonical-architecture/golden-scenario-map.md) (G13) ·  
[ADR-024](../15-architecture-decisions/ADR-024-epistemic-labels-internal-vs-lcr.md) (Known/Unknown internal vs LCR copy)

**Module:** `src/lib/decision-memory` · **Verify:** `verify:continuity-core-tier1` (G13, G13b, G13c)

---

## Pipeline (locked)

```
Input → Care Reality Understanding → Situation Relationship Engine
  → Decision Memory → Evidence-backed Care Context → Living Care Record
```

**Reject:** Input → Document summary → Generic answer.

**Product truth path:** Decision Memory runs in **Path A** after SRE + ACS ingest — before `composeCaregiverResponse`. See [product-truth-path.md](../17-canonical-architecture/product-truth-path.md).

---

## Decision Memory fields

What · When · Who · Context · Evidence · Alternatives · Reason · Outcome · Status  
(Active / Pending / Changed / Completed)

Value = **why the decision existed**. Unknown reason is first-class trust data — never invent or hide.

**Golden:** G13 — record question answered from held evidence, not a Clarity form. G13c — unified `decision-signal.ts` wires SRE + ingest + composer why-path.

---

## Documents are evidence

Discharge / med lists enter the same Care Reality loop. Never respond with “here is your document summary.”

Separate **Known → Interpretation → Unknowns** internally ([ADR-024](../15-architecture-decisions/ADR-024-epistemic-labels-internal-vs-lcr.md)). Caregivers see understanding / changed / still unclear — not extraction chrome.

---

## Preparation, not advice

Move “what should I do?” → “what is happening, what changed, what is known/unknown, what may help the next conversation.”

Never recommend rehab vs home / medical choices. Never task-ify the caregiver load.

---

## Continuity

Connect **before** (baseline) → event → clinical input → **after** (life change).

| Piece | Status |
|-------|--------|
| Decision Memory + record questions (G13) | **IMPLEMENTED** · IN-MEMORY |
| Unified decision signal | **IMPLEMENTED** |
| SRE `ADD_RELATED_EVENT` for improvement (G2) | Skips Decision Memory by design |
| Explicit memory correction (“she didn’t fall”) | **IMPLEMENTED** — Slice 2.4 · `verify:memory-correction` |
| Decision extraction (choice · who · why / Reason unknown · evidence) | **IMPLEMENTED** — `solenos-decision-extraction.md` · `care-reality-extraction` · Decision Memory wire |
| Care Transition Mode UI | **FUTURE** |

---

## Timeline spine

Person → Observations · Events · Decisions · Outcomes · Evidence · Unknowns · Relationships

Never: Documents → Summaries as the product.

---

## Success

Caregiver understands the situation better — not notes created or docs uploaded.

---

## Implementation status (honest)

| Piece | Status | Notes |
|-------|--------|-------|
| `recordDecisionFromText` + store | **IMPLEMENTED · IN-MEMORY** | Durable JSON via LCR persistence |
| `decision-memory/decision-signal.ts` | **IMPLEMENTED** | SRE Signal 6 + ingest + composer |
| G13 / G13b / G13c verify | **IMPLEMENTED** | `verify:continuity-core-tier1` |
| Composer why-path on record questions | **IMPLEMENTED** | No Clarity form; evidence-backed |
| `recordMemoryCorrection` ingest | **IMPLEMENTED** | ACS `ingestMemoryCorrection` → CRS; prior kept disputed · `verify:memory-correction` |
| Care Transition Mode UI | **FUTURE** | Signals + Decision Memory only in MVP |

**Index:** [module-status.md](../17-canonical-architecture/module-status.md)
