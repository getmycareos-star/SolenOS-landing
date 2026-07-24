# ADR-024: Epistemic labels — internal Known/Likely/Unknown vs caregiver Changed/Still unclear

**Status:** Accepted  
**Date:** 2026-07-20  
**Deciders:** Product Steward  
**Conflicts resolved:** Response Contract field names vs Living Care Record panel section titles

---

## Context

Two label systems coexist:

1. **Response Contract / intelligence layer:** `Known` · `Likely` · `Unknown` (and risk enums) — structured output for transformation and disclosure planning.
2. **Living Care Record UX:** Caregivers see **What is understood** · **What changed** · **Still unclear** — never engine enums.

Docs and code occasionally drift toward exposing internal epistemic enums in the panel.

---

## Decision

| Layer | Labels | Caregiver-visible? |
|-------|--------|-------------------|
| Internal contract / CRS planning | Known · Likely · Unknown · risk_level | **No** — never render as section headers or badges |
| Living Care Record panel | Current understanding · What changed · Still unclear | **Yes** — sole caregiver epistemic framing |

**Mapping (MVP):**

- Known / held facts → `what_we_know` / current understanding lines  
- Change delta → `what_changed` / understanding revision copy  
- Unknowns / gaps → `still_unclear` (≤3 asks)  

Never show “Likely” or confidence percentages in caregiver UI.

---

## Consequences

- Composer and `buildLivingCareRecordResponse` project human sections only.
- Internal `buildResponseIntelligenceOutput` may retain Known/Likely/Unknown for arbitration and tests — not panel fields.
- PRs that add caregiver labels must use LCR vocabulary or update this ADR.

---

## References

- ADR-019 Living Care Record UX  
- ADR-021 Care Reality State  
- ADR-022 Caregiver Response Contract  
- `docs/02-product/solenos-evidence-visibility-directive.md`
