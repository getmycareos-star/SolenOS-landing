# SolenOS — Canonical Execution Contract (Cursor Final)

**HARD EXECUTION CONTRACT** — no deviation, no creative interpretation, no partial compliance.

## System definition (immutable)

SolenOS is:

> a deterministic, input-grounded, uncertainty-preserving transformation system for caregiver-facing complex information

**NOT:** reasoning engine, knowledge system, medical/legal authority, predictive system, inference completion system, chatbot.

## Core system failure (absolute)

SolenOS **FAILS** if it produces any **ungrounded or hallucinated content**:

- inferred medical/legal conditions
- guessed causes or missing context
- "likely X is happening" statements
- completion of missing information
- external knowledge injection
- certainty without explicit grounding

## Fundamental invariant

> Structure ≠ compression. Structure = safe comprehension under uncertainty + strict grounding.

## Grounding rule (non-negotiable)

Every output must trace to:

1. explicit user input
2. explicitly labeled "general caregiving pattern" (if used)
3. schema structure only (no semantic invention)

If data is missing → output `unknown`, clarification request, or explicitly labeled ambiguity.

## Output schema (fixed order)

```json
{
  "what_is_happening": "grounded restatement only (no inference)",
  "what_matters_now": "prioritized signals strictly from input",
  "what_to_ask_next": "clarifying questions?",
  "risk_level": "low | medium | high | unknown",
  "what_can_wait": "non-critical context from input",
  "follow_up_items": ["supported actions only"],
  "_meta": {
    "context_completeness": 0.0,
    "missing_critical_fact": "string or null",
    "confidence": "low | medium | high | unknown"
  }
}
```

## Validation pipeline (hard order)

1. Raw input capture
2. Grounding validation (every claim traceable)
3. JSON schema validation (Zod)
4. Fact vs interpretation separation
5. Uncertainty check
6. Consistency check
7. Render OR retry

## Runtime pipeline

```
Input → Stress Normalizer → Context Window → Gemini
→ JSON parse → Zod → Grounding validation → Consistency
→ Medical boundary → Epistemic safety → Explanation gate → Render | retry
```

## Implementation

| Layer | Module |
|-------|--------|
| Contract constants | `src/lib/canonical-architecture/contract.ts` |
| Grounding gate | `src/lib/grounding-validation/` |
| Schema | `src/lib/response-validator/` |
| Pipeline | `src/lib/analyze-pipeline/index.ts` |

## Verify

```bash
npm run verify:grounding
npm run verify:canonical-architecture
npm run verify:final-contract
```

## One-line truth

> SolenOS is a deterministic, strictly input-grounded transformation system that produces structured, uncertainty-preserving, explainable outputs without inference, hallucination, or completion of missing reality.
