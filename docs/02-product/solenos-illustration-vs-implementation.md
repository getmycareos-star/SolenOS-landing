# Illustration vs Implementation Separation (SolenOS)

**Status:** Locked architecture directive  
**Authority:** All SolenOS product docs · Cursor rules · Care Reality Intelligence · Identity Naming (Locked A)  
**Companions:** [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md) · [`solenos-mvp-identity-naming.md`](./solenos-mvp-identity-naming.md) · [`solenos-golden-caregiver-scenarios.md`](./solenos-golden-caregiver-scenarios.md) · [`solenos-response-intelligence-directive.md`](./solenos-response-intelligence-directive.md)  
**Module:** `src/lib/care-reality-intelligence/illustration-vs-implementation.ts`  
**Verify:** `verify:illustration-vs-implementation`

---

## Critical instruction

Examples, scenarios, caregiver stories, and phrases in SolenOS architecture documents are **NOT product content**.

They are **illustrations only**.

Their purpose is to help implementers understand:

- the intended reasoning process  
- the expected system behavior  
- the type of intelligence SolenOS should create  

They must **never** be directly converted into:

- code branches  
- database records / schema fields  
- UI copy or default content  
- fixed categories  
- hardcoded scenario logic  

---

## Example interpretation rule

When docs show lines like *"Mom is confused"* / *"tried leaving the house"* / *"medication changed"* / *"Brother thinks…"*:

| Do NOT implement | Do implement |
|------------------|--------------|
| `{ name: "Mom", condition: "confused" }` | Care recipient + observation + change detection |
| Hardcoded `"Mom"` product paths | Any care recipient identity (Locked A: ask once) |
| Fixed dementia scenarios | Condition-agnostic care-reality structure |
| Example-specific workflows / buttons / DB fields | Universal objects: Observation → Change → Related event → Decision → Outcome → Unknown |

These are fictional representations of possible situations.  
The system must work for **any** care recipient, family relationship, long-term condition, and caregiver situation.

---

## Correct interpretation

Illustration: *"Mom tried leaving the house."*

Means understand the **structure**:

```
Care Recipient → Observation → Baseline comparison → Possible safety-related change
→ Unknown cause → Relationship to prior events
```

**Implement the structure, not the sentence.**

---

## Prompt markers

When architecture docs say **Example:** / **Imagine:** / **Scenario:** / **Illustration:**

Interpret as: *"Understand the intended behavior."*  
Never as: *"Add this exact thing to the product."*

---

## Data model rule

Store universal structures — never example-shaped fields.

| Wrong | Correct |
|-------|---------|
| `mom_confusion_event: true` | `type: observation`, subject, description, timestamp, confidence, related_events |

---

## UI rule

Do not display examples as default content.

Do not ship: sample caregiver stories · fake timelines · demo situations · prefilled patient information — unless **explicitly** requested as demo mode.

Production begins **empty** and learns from the caregiver’s own reality.

Identity placeholders that invite *what they call the person* (e.g. Mom / Dad / a given name) are **not** demo stories — they are Locked A naming UX.

---

## Architecture rule

Never build around examples. Build around underlying objects:

```
Care Recipient → Observation → Change Detection → Related Event → Decision → Outcome → Unknown
```

Not: Mom → Confusion → Medication (as fixed product spine).

---

## Pre-commit gate question

> Am I implementing the **intelligence behind** this example, or am I accidentally implementing the **example itself**?

If the second → do not build it. Replace with generalized system behavior.

---

## Relationship to no-hardcode

| Directive | Focus |
|-----------|--------|
| [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md) | Do not use fixed words/symptom lists as detectors |
| **This directive** | Do not turn doc illustrations into product data, UI defaults, schema, or scenario code |

Both apply. Examples teach the pattern — they are never what SolenOS stores.
