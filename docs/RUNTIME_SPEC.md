# SolenOS System Runtime Spec (v1)

**Canonical runtime execution spec.**

```
process(input, state) → output + new_state
```

## Transformation chain

```
INPUT → SIGNAL EXTRACTION → PRIORITY RESOLUTION → DECISION COMPRESSION → STRUCTURED OUTPUT
```

## Immutable execution loop (12 steps)

1. Receive input
2. Normalize input
3. Classify input
4. Extract signals
5. Activate primary domain
6. Evaluate priority and urgency
7. Run decision compression engine
8. Generate structured response
9. Validate output
10. Apply SAFE MODE if necessary
11. Emit output
12. Update minimal memory state

Implementation: `src/lib/process/`

## SAFE MODE

Activates on: ambiguity, conflicting signals, low confidence, validation failure, uncertainty blocking action.

Behavior: minimal inference, uncertainty acknowledged, no aggressive recommendations.

## User-visible output only

```json
{
  "what_is_happening": "",
  "what_matters_now": "",
  "what_to_ask_next": "",
  "risk_level": "low | medium | high | unknown",
  "what_can_wait": "",
  "follow_up_items": []
}
```

No internal architecture, reasoning, or metadata is exposed.

## Final principle

Input chaos → compressed next step. Nothing else.
