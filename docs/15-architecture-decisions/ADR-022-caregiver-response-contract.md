/**
 * ADR-022: Caregiver Response Contract
 *
 * Status: Accepted
 * Date: 2026-07-16
 */

# ADR-022 — Caregiver Response Contract (Trust-Critical)

## Context

Multiple engines (ACS, Progressive Understanding, Care Reality State, clarifiers) and surfaces (Living Care Record panel, Continuity Home) could each emit caregiver-facing copy. Disclosure plans existed but the panel always showed Clarity. Continuity Home could re-open quiz-like unresolved lists. Verifies passed while the browser still felt like an interview.

Caregivers are high-trust sensitive. Wrong framing once destroys return trust. This is not an MVP shortcut — it is the product bar.

## Decision

1. **Product SoT (structure):** [docs/02-product/solenos-response-contract.md](../02-product/solenos-response-contract.md) — orientation fields for every input  
2. **Product SoT (surface):** [docs/02-product/caregiver-response-contract.md](../02-product/caregiver-response-contract.md) — disclosure + moments  
3. **Sole copy authority:** `src/lib/caregiver-response-composer` — engines propose state; composer speaks. Contract module: `src/lib/response-contract`.  
4. **Panel obeys disclosure:** `LivingCareRecordPanel` renders only sections allowed by `disclosure_plan` + composed fields.
5. **Asks = understanding gaps only:** At most a few clarifying asks when context is genuinely missing (emotional / empty / interpretation organize). Never kind- or keyword-template quizzes (“if fall → head”, “if eat → fluids”). Text and documents share one path. No emotional interview lists on the caregiver surface.
6. **Improvement hard gates:** No “what may become serious”; zero asks; latest note defines current state.
7. **Continuity Home gated:** Same ask ceiling (max one soft invitation from open gaps); no quiz section when nothing remains.
8. **Done for now:** Pause interaction session only; persist ACS, CRS, LCR, evidence, uncertainties (see Done-for-now continuity directive).
9. **Never hardcode examples:** Design-doc scenarios are illustrations only — never canned responses in code.

## Consequences

- Progressive Understanding may still track internal gaps; caregiver-visible `open_questions` / Continuity Home lists are capped and filtered to caregiver-facing understanding asks — never event-kind phrase templates.
- ADR-021 disclosure stages remain; early no longer implies a quiz — only an ask when a real understanding gap warrants it.
- Golden scenarios G1–G5 locked in `verify:caregiver-response-composer`.
- Freeze: no new response engines until those pass live.

## References

- ADR-019 Living Care Record UX  
- ADR-020 Progressive Understanding  
- ADR-021 Care Reality State  
- Product North Star / Care Reality Intelligence  
