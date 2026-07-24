# SolenOS MVP Reasoning Examples (Evaluation Only)

**Status:** Evaluation corpus — **NOT product logic**  
**Authority:** Behavioral specification only  
**SoT behavior:** [`solenos-mvp-response-behavior.md`](./solenos-mvp-response-behavior.md)  
**Companions:** [`solenos-illustration-vs-implementation.md`](./solenos-illustration-vs-implementation.md) · [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md)  
**Verify:** `verify:mvp-response-behavior` (structural pattern checks — never exact wording)

---

## CRITICAL INSTRUCTION

These examples are **NOT** hardcoded product behaviors.

**Do NOT create:**

- keyword matching  
- if/else rules  
- fixed responses  
- situation-specific templates  

Wrong:

> If user mentions fall → show fall response.

That would make SolenOS a brittle rule system.

These examples define the **reasoning pattern** SolenOS should learn and generalize to situations it has never seen.

```
Messy caregiver input
        ↓
Understanding
        ↓
Structured care reality
        ↓
Meaning extraction
        ↓
Unknowns and questions
        ↓
Helpful clarity
```

---

## What to evaluate (not copy)

For any input — including novel paraphrases — the system should recognize **patterns**:

1. Something changed  
2. Something happened before  
3. A decision was made  
4. Information conflicts  
5. Important context is missing  
6. Caregiver needs clarity  

**Not:** exact sentences from this file as product output.

---

## Examples 1–10 (reasoning illustrations)

### Example 1 — New confusion

**Input (illustration):** *Dad has started asking where his wife is every evening. She passed away years ago, but he seems really upset.*

**Expected reasoning pattern:** event (repeated confusion about past relationship) · change (evening distress pattern) · care context (emotionally affected) · unknowns (timing, prior occurrence, other changes) · clarifying questions — **never diagnosis**.

### Example 2 — Medication conflict

**Input (illustration):** *The hospital gave us new medication instructions, but the old medication list still has the previous ones.*

**Expected reasoning pattern:** event (med info changed) · change (possible conflicting records) · risk area as uncertainty · unknowns (which list current, who confirmed) — **never invent which list wins**.

### Example 3 — Family conflict

**Input (illustration):** *My sister thinks mom is fine living alone. I don't think she is safe anymore.*

**Expected reasoning pattern:** different views as contributor context · care need for shared observations · unknowns about specific safety concerns — **family disagreement is context, not the primary care-recipient story**.

### Example 4 — Repeated hospital visits

**Input (illustration):** *Mom has been in the emergency room twice this month because she keeps getting confused.*

**Expected reasoning pattern:** multiple acute visits · recurring confusion · pattern vs baseline · unknowns about cause and return to baseline — **never “dementia is worsening.”**

### Example 5 — Caregiver mental load

**Input (illustration):** *I have work, kids, and taking care of my dad. I feel like everything depends on me.*

**Expected reasoning pattern:** care responsibility concentrated · competing responsibilities as context · unknowns about hardest parts and shared load — **never diagnose burnout/depression/anxiety**.

### Example 6 — Fall and change over time

**Input (illustration):** *Before January mom walked everywhere by herself. After her fall she needs someone nearby.*

**Expected reasoning pattern:** before → event → after · mobility change · possible connection · preserve unknowns about injury/recovery — **structure, not fall-keyword template**.

### Example 7 — Eating changes

**Input (illustration):** *Dad used to cook every day. Now he forgets meals and leaves food sitting.*

**Expected reasoning pattern:** before/after daily living change · unknowns about timing, appetite, weight — **never meal-refusal FAQ**.

### Example 8 — Care decision history

**Input (illustration):** *We decided not to put mom in a facility last year because she was still managing well at home.*

**Expected reasoning pattern:** decision + when + reason + status may need review · unknowns about what changed since — **preserve why**.

### Example 9 — Contradicting information

**Input (illustration):** *The doctor says dad should walk more, but he refuses and says he cannot.*

**Expected reasoning pattern:** conflict between sources · keep both · unknowns about limitation type — **never pick a winner**.

### Example 10 — Document upload

**Document (illustration):** hospital discharge summary.

**Wrong:** “Here is a summary of your document.”

**Expected reasoning pattern:** hospital event · important changes (meds, follow-ups, instructions) · connect to prior care history · what is unclear (temporary vs new baseline) — **care reality first**.

---

## Examples 11–22 (additional reasoning illustrations)

### Example 11 — New behavior that may be a change

Anger / “hiding things” that “never used to” → new behavior pattern · change from previous · unknowns about timing and co-occurring changes.

### Example 12 — Lost context after doctor visit

Healthcare discussion occurred · follow-up actions unclear · recover from after-visit materials when held — **not advice theater**.

### Example 13 — Baseline shifting (functional)

Before: managed bills · Now: asks caregiver to check → daily living responsibility shifted · gradual vs sudden unknown.

### Example 14 — Missing timeline

“She has been different lately.” → change noticed · type/timing/impact unknown · ask for concrete example — **do not invent what “different” means**.

### Example 15 — Multiple problems at once

Sleep + missed appointment + family coordination → competing threads · prioritize by understanding, not a task list · ask which cannot wait.

### Example 16 — Medication timing + observation

New medication then more tired → possible relationship held · **do not conclude causation** · ask timing and prior tiredness.

### Example 17 — Remote caregiver

Shared responsibilities · limited visibility · unknowns about who manages what — **not family chat product**.

### Example 18 — Routine disruption after move

Environment change then increased confusion → timing connection · unknowns about pre-move baseline and adjustment.

### Example 19 — Disagreement about reality

Short-visit vs daily observations · need shared understanding from observations over time — **keep both perspectives**.

### Example 20 — Improvement after intervention

Routine change → calmer evenings → outcome linked to action · do not treat one good period as fully resolved · unknowns about what helped.

### Example 21 — Reconstructing history

Surgery then decline remembered vaguely → timeline unknowns · first noticeable change · **help reconstruct, do not invent dates**.

### Example 22 — Preparing for appointment

Continuity symptom: prepare from held changes, unanswered questions, decisions — **not generic “what to ask your neurologist” FAQ**.

---

## Novel-input test (required)

After any intelligence change, test with situations **not listed above**.

Success = the system produces Care Reality structure and orientation for unseen wording.  
Failure = keyword recognition of these example sentences.

---

## Where this lives

| Location | Role |
|----------|------|
| This file | Evaluation / behavioral illustrations |
| `docs/10-ai-systems/solenos-reasoning-guidelines.md` | Reasoning guidelines for AI systems |
| Application logic | **Must not** embed these texts as templates |
