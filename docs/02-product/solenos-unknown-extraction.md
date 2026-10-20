# Unknown Extraction Rule (SolenOS)

**Status:** Locked product SoT  
**Authority:** Boundary layer of Care Reality Intelligence  
**Companions:** Observation · Event · Decision · Relationship extraction · [`solenos-open-uncertainties-return.md`](./solenos-open-uncertainties-return.md) · [`solenos-uncertainty-preservation.md`](./solenos-uncertainty-preservation.md) · Response Contract  
**Module:** `src/lib/care-reality-extraction/unknowns.ts`  
**Verify:** `verify:care-reality-extraction`

---

## Core instruction

> **Do not remove uncertainty. Uncertainty is part of the care reality.**

The Unknown layer must **preserve what is not known**, not fill gaps.

| Wrong question | Right question |
|----------------|----------------|
| How do we make the record look complete? | What important information is missing, uncertain, or requires confirmation? |

A strong care record does not only know facts.  
**It knows what it does not know.**

---

## Stack position

```
Observation → Event → Decision → Relationship → Response Contract
                         ↑
              Unknown (knowledge boundary — throughout)
```

Unknown is not a substitute for Observation/Event/Decision. It holds the **edges of current knowledge** so Response Contract can surface calm “still unclear” lines without inventing facts.

---

## Required fields

| Field | Meaning |
|-------|---------|
| Question / missing information | What is unclear |
| Related object | The observation, event, or decision connected to the uncertainty (when known) |
| Source | Who expressed or created the uncertainty |
| Importance | Why this missing information matters |
| Status | `open` · `answered` · `declined` · `no_longer_relevant` (engine-internal only) |

---

## Rules

1. **Never** convert uncertainty into facts.  
2. **Never** guess missing information.  
3. **Never** remove uncertainty because it makes the record incomplete.  
4. Preserve caregiver questions.  
5. Preserve conflicting information (keep both; mark the gap).  
6. Allow unknowns to remain **open** over time (lifecycle may later answer / decline / mark irrelevant — extraction never invents closure).

### Illustration only (never product if-branches)

Caregiver: *“Not sure if Mom is still taking the medication.”*

| Wrong | Correct |
|-------|---------|
| Medication stopped. | Unknown: current medication usage requires confirmation. |

---

## Purpose

The Unknown layer is the **boundary of current knowledge**. It lets SolenOS understand:

- what is missing  
- what needs confirmation  
- where uncertainty exists  
- what questions matter later  

Without unknowns, SolenOS fakes completeness.  
With unknowns, SolenOS stays trustworthy.

---

## Caregiver surface

Composer / Living Care Record may surface open gaps as calm questions or “still unclear” lines.  
Never show: unknown status enums · confidence % · “extracted unknown” · engine object ids.
