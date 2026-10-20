# SolenOS — Final Implementation Contract (Production)

Aligned with [CANONICAL_EXECUTION_CONTRACT.md](./CANONICAL_EXECUTION_CONTRACT.md) — **hard execution contract, no deviation**.

## One-line definition

SolenOS is a **deterministic, strictly input-grounded transformation system** that produces structured, uncertainty-preserving, explainable outputs without inference, hallucination, or completion of missing reality.

## Core failure (absolute)

SolenOS fails when it produces **ungrounded or hallucinated content** — not merely when a guess is wrong.

## Output schema

```json
{
  "what_is_happening": "grounded restatement only",
  "what_matters_now": "prioritized signals from input + why when grounded",
  "what_to_ask_next": "clarifying questions?",
  "risk_level": "low | medium | high | unknown",
  "what_can_wait": "non-critical context from input",
  "follow_up_items": ["supported actions only"],
  "_meta": {
    "context_completeness": 0.0,
    "missing_critical_fact": "string | null",
    "confidence": "low | medium | high | unknown"
  }
}
```

## Validation order (runtime)

1. Raw capture → JSON parse → Zod
2. **Grounding validation**
3. Consistency check
4. Medical boundary
5. Epistemic safety (uncertainty)
6. Explanation clarity gate (grounded only)
7. Render OR retry

## Verify

```bash
npm run verify:grounding
npm run verify:final-contract
npm run verify:canonical-architecture
```
