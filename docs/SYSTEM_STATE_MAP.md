# SolenOS — System State Map (Core Behavior Model)

SolenOS is **not pages or features**. It is a **state transformation machine** for human cognitive load.

---

## State pipeline

```
RAW_INPUT_STATE
    ↓ interpret()
INTERPRETED_STATE
    ↓ computeLoad()
COGNITIVE_LOAD_STATE
    ↓ prioritize()
PRIORITY_STATE
    ↓ generateActions()
ACTION_STATE
    ↓ generateClarity()
CLARITY_STATE (user sees CareOutput)
    ↓ evaluateLoop()
LOOP_STATE (session feedback)
```

Implementation: `src/lib/engine/`

---

## States

| State | Purpose |
|---|---|
| **RAW_INPUT** | Unstructured, emotional, incomplete caregiver input |
| **INTERPRETED** | Normalized meaning, entities, uncertainty flags |
| **COGNITIVE_LOAD** | Complexity, emotional intensity, urgency — the differentiator |
| **PRIORITY** | IMMEDIATE / SOON / MONITOR / IGNORE |
| **ACTION** | do_now, do_today, ask_professional, do_not_do |
| **CLARITY** | Final structured output (immutable contract) |
| **LOOP** | Relief detected, confusion persisted, loop closed |

---

## Architecture

```
/api/analyze → care_analysis_tool → domain engine (pure logic) → CareOutput
```

- **No data layer** — ephemeral request processing only
- **No memory** — disabled
- **Single route** — `/api/analyze`

---

## Domain model

See `src/lib/engine/domain/types.ts`

---

## Critical insight

Not building UI, chatbot, or AI assistant.

Building: **a state transformation engine that converts emotional medical chaos into structured cognitive relief.**
