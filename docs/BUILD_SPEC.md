# SolenOS — Cursor Build Spec (v1)

**Canonical build contract.**

```
process(input: string, state: SolenOSState) => { output, new_state }
```

## Pipeline (strict order)

1. Input Classification
2. Signal Extraction
3. Domain Tagging
4. Decision Engine
5. Response Mapping
6. Validation
7. Output (+ SAFE MODE when required)

Implementation: `src/lib/process/`

## Output contract

```json
{
  "what_is_happening": "",
  "what_matters_now": "",
  "what_to_ask_next": "",
  "risk_level": "low | medium | high | unknown",
  "what_can_wait": "",
  "follow_up_items": [],
  "decision_trace": {}
}
```

## Core principle

Input chaos → compressed next step. Not a chatbot. Not a reasoning engine.
