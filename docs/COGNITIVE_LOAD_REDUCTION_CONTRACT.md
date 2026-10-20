# Cognitive Load Reduction Engine (Final Unified Contract)

SolenOS is the **only system** to implement: a deterministic cognitive transformation engine that minimizes cognitive load through strict grounding, fixed structure, urgency-aware prioritization, and non-conversational output.

## Success metric (only one that matters)

> User cognitive load decreases immediately after output.

Instant understanding. No re-reading. No interpretation. No mental effort to organize meaning.

## Absolute output schema (immutable)

Exactly 6 fields — no additions, removals, or reordering:

```json
{
  "what_is_happening": "string",
  "what_matters_now": "string",
  "what_to_ask_next": "string",
  "risk_level": "low | medium | high",
  "what_can_wait": "string",
  "follow_up_items": ["string"]
}
```

No `_meta`. No `emotional_context`. Emotional acknowledgment lives in `what_is_happening` when distress is present.

## Processing pipeline

1. Surface extraction (ground only)
2. Uncertainty tagging
3. Contradiction preservation
4. Structured transformation

## Required validation (section 15)

1. JSON schema validation
2. Input grounding validation
3. No-inference validation
4. Uncertainty separation check
5. Urgency classification check
6. Deterministic consistency check
7. Cognitive load minimization check

## Final implementation truth

> SolenOS is a deterministic cognitive transformation engine that minimizes cognitive load through strict grounding, fixed structure, urgency-aware prioritization, and non-conversational output design.
