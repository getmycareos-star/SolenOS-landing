# Care Signal Understanding Layer (SolenOS)

**Status:** Locked behavior extension — intelligence layer  
**Authority:** Response Contract · Care Reality Engine · Product Integrity  
**Module:** `src/lib/care-signal-understanding`  
**Verify:** `verify:care-signal-understanding`  
**Wired:** `situation-entry` → `care_signal_understanding_layer`

---

## Purpose

Extend SolenOS so caregiver input is interpreted as **fragments of a person's care reality**, not a task list.

```
Caregiver input → Care signals → Care state → What matters now → Missing context
```

Never:

```
Input → Tasks → Checklist
```

---

## Critical — illustrations only

Examples in product docs (medication, eating, insurance, overwhelm, …) are **behavior demonstrations only**.

Do **not** create:

- hardcoded scenario detectors for those nouns  
- special cases per disease  
- task-manager features  

Generalize meaning structure for **any** caregiver input.

---

## Behaviors (required)

1. **Preserve raw input** — exact text; never rewrite/replace the original expression.  
2. **Infer care signals** — meaning domains (engine-only), via existing clinical/situation classification + extraction — not fixed keyword product branches.  
3. **Update care-state understanding** — what the input reveals about current care reality.  
4. **Preserve unknowns** — known / uncertain / what would improve understanding; never invent facts.  
5. **Prioritize by care impact** — health change, urgency, unresolved decisions, uncertainty, caregiver load as context — not task wording.  
6. **Response orientation** — what is happening · what changed · what matters now · what can wait · what is unclear · what helps next.

---

## Caregiver UI

Never expose: `care signal`, signal domain enums, clinical category ids, confidence %, burnout scores, task-list chrome.

---

## Success

Caregiver moves from “everything mixed together” to “I understand the current care situation better.”

Not measured by how many tasks were created.

---

## Pipeline identity

Composes: Care Reality extraction · clinical situation classification · Response Contract fields.  
Does not replace ACS / CRS / Decision Memory — strengthens orientation on the live path.
