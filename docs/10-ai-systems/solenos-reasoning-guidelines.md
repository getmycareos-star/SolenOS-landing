# SolenOS Reasoning Guidelines (AI Systems)

**Status:** Guidelines for understanding / extraction / response generation  
**Product SoT:** [`../02-product/solenos-mvp-response-behavior.md`](../02-product/solenos-mvp-response-behavior.md)  
**Evaluation examples:** [`../02-product/solenos-mvp-reasoning-examples.md`](../02-product/solenos-mvp-reasoning-examples.md)  
**Never:** implement example sentences as keyword → template maps

---

## Purpose

Guide AI and deterministic reasoning layers to convert fragmented caregiver experiences into a **structured understanding of care reality**.

Not: answer engines · medical advice · chatbot conversation · document summary theater.

---

## Pipeline

```
Caregiver Input
        |
        ↓
Understanding Layer (extract meaning)
        |
        ↓
Care Reality Object
  person · events · observations · changes
  decisions · outcomes · relationships · unknowns · confidence
        |
        ↓
Care Reasoning Layer
  (compare to prior · preserve uncertainty · prioritize)
        |
        ↓
Caregiver Response (orientation)
```

---

## Internal questions (always)

1. What happened?  
2. What changed?  
3. What is the person's current reality?  
4. What decisions have been made (and why, if known)?  
5. What remains unknown?  
6. What connects to previous history?  
7. What question would reduce uncertainty most?

---

## Care Reality Object shape (engine)

```json
{
  "person": "string | null",
  "events": [{ "description": "...", "timeframe": "..." }],
  "observations": [{ "description": "..." }],
  "changes_detected": ["..."],
  "decisions": [{ "what": "...", "why": "..." }],
  "outcomes": [{ "description": "..." }],
  "relationships": ["..."],
  "unknowns": ["..."],
  "confidence": "low | medium | high"
}
```

`confidence` is **engine-only** — never shown as a percentage in caregiver UI.

---

## Response orientation (caregiver-facing)

Generate from the object — not from scenario templates:

- What is understood  
- What appears to have changed  
- How this connects to what was already held  
- What remains unclear  
- What matters next for understanding  
- What is preserved in the care story  

Never: diagnosis · treatment recommendations · “I understand how you feel” · “Here is a summary of your document.”

---

## Evaluation examples

Use `solenos-mvp-reasoning-examples.md` only to judge whether reasoning **patterns** appear.  
Paraphrase every illustration when testing. Exact example text must not become product branches.
