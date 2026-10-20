# SolenOS — Communicate Understanding, Not Summarize

**Status:** Locked MVP output contract (transformation layer)  
**Authority:** Care Reality Engine · Response Intelligence · Document-only inputs  
**Companions:** [`solenos-response-intelligence-upgrade.md`](./solenos-response-intelligence-upgrade.md) · [`solenos-care-reality-engine-principles.md`](./solenos-care-reality-engine-principles.md) · [`solenos-document-only-inputs.md`](./solenos-document-only-inputs.md) · [`solenos-output-quality.md`](./solenos-output-quality.md)  
**Module:** `src/lib/caregiver-understanding-output` · gate: `src/lib/response-acceptance-gate`  
**Verify:** `verify:caregiver-understanding-output`

---

## Current problem (identity failure)

SolenOS must **not** behave like:

```
Input/upload → extract → summary/internal notes → done
```

That is a **document intelligence tool**.

Intended product:

```
Input/upload → understand care situation → update Care Reality
  → explain what changed → show what matters → ask useful questions
  → guide next understanding
```

The missing layer is not “better summaries.”  
It is **caregiver-facing understanding**.

---

## Core rule

SolenOS is **not** an input→output summarizer.

| Wrong question | Right question |
|----------------|----------------|
| What should I say about this input? | What does this change about our understanding of this person's care? |
| What is this text about? | What does this tell us about this person's care reality? |

Every input is **evidence** about an ongoing care situation — not a request for a paraphrase.

---

## Pipeline (intelligence before response)

```
Caregiver Input
        ↓
Extract facts
        ↓
Identify events
        ↓
Compare with existing Care Reality
        ↓
Detect changes / decisions / outcomes / unknowns
        ↓
Link evidence
        ↓
Update Living Care Record
        ↓
Generate caregiver understanding (response)
```

The AI response is the **final presentation layer**.  
It is not the primary reasoning layer.

The **Care Reality Model / Living Care Record** is the product.  
The response is a window into that model.

---

## Caregiver-facing understanding structure

After any input (text, Snap, Scan, Upload, Share), the caregiver should see orientation that answers:

1. **Current Understanding** — What do we understand now?  
2. **What Changed** — What is different from previous reality? (or: first layer — prior unknown)  
3. **What Matters Now** — What deserves attention for next understanding?  
4. **What Is Unclear** — What is missing / unknown?  
5. **Questions Worth Answering** — Only asks that reduce uncertainty (≤1–3)

Do **not** build: “Here is a summary of your document.”  
Build: “Here is what this means for the care situation.”

---

## Illustrations only (never product if-branches)

**Bad:** *Summary: Patient discharged. Medication changed. Follow-up recommended.*  
**Good:** Hospital visit → medication plan may no longer be current → follow-up expected → which med / why / symptoms after = unclear → useful questions.

Doc examples teach the **pattern**, not fixed copy.

---

## Moat reminder

Any company can summarize a PDF.  
The hard part is state over time · relationships · decisions/why · uncertainty · evidence.

Optimize for **understanding over time**, not better summaries.

---

## Enforcement

- `response-acceptance-gate` rejects summarizer theater  
- Composer must produce understanding fields from Care Reality, not echo  
- Documents use the same loop as text ([document-only inputs](./solenos-document-only-inputs.md))
