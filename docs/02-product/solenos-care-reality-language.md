# Care Reality Language — Not Care Notes (SolenOS)

**Status:** Locked product SoT  
**Authority:** Product Steward / Product Constitution / North Star  
**Companions:** [`solenos-output-quality.md`](./solenos-output-quality.md) · [`solenos-response-intelligence-upgrade.md`](./solenos-response-intelligence-upgrade.md) · Visual Language · Response Contract  
**Module:** `src/lib/output-quality` · `src/lib/response-acceptance-gate` · composer / Living Care Record UI  
**Verify:** `verify:care-reality-language` · acceptance gate

---

## Problem

SolenOS must **not** think like a documentation system.

Wrong mental model: caregiver input as notes to store · information to organize · text to summarize.

Caregivers already have phones, notebooks, WhatsApp, paper, hospital summaries, family conversations.

**The missing thing is not storage. The missing thing is understanding.**

---

## Product principle

A caregiver should never feel:

> “SolenOS stores my notes.”

They should feel:

> “SolenOS understands what is happening with my loved one.”

SolenOS does not preserve notes.  
It preserves the **meaning** of a person’s care journey.

---

## Forbidden (documentation / database language)

Never generate caregiver-facing copy that uses or implies:

| Ban | Why |
|-----|-----|
| Care notes | Product is not a notes app |
| Stored notes / saved information | Storage theater |
| Note history / supporting notes | Database chrome |
| More complete records | Completeness theater |
| Evidence maturity | Engine-only — never caregiver UI |
| Lower attention items | Admin ranking language |
| “I have added this to your care notes” | Productivity tool |
| “Your notes show…” | Notes app |
| “Based on your previous entries…” | Logbook |

Also reject: “I saved a note…”, “related notes are connecting”, “A related note was added…”, “today’s notes”, “Add related note” as primary CTA wording.

---

## Required (human understanding concepts)

Prefer:

- What we understand  
- What changed  
- What connects these events  
- What is still unclear  
- What happened before / after  
- What needs attention now  
- What remains important over time  

Every interaction contributes to the **Care Story**:

Who is this person? · What is normal? · What changed? · What decisions shaped now? · What worked / did not? · What remains uncertain?

---

## Pipeline (required)

```
Message → Care Reality → Meaning → Connection → Care Story Update → Human Understanding
```

Never:

```
Message → Note → Summary
```

---

## Caregiver voice (illustrations only — never templates)

Use feel of:

- “Based on what we understand about [their] care journey…”  
- “Looking at the changes over time…”  
- “This appears connected to the recent hospital visit and medication change…”  

Never feel of:

- “I have added this to your care notes.”  
- “Your notes show…”  
- “Based on your previous entries…”

Doc examples are illustrations only — never product if-branches on scenario nouns.

---

## Acceptance test (illustration fixture)

Input: *“Dad stopped eating normally after his fall. The doctor changed his medication last week.”*

| Fail | Succeed |
|------|---------|
| “I saved a note about Dad's eating and medication.” | Change in eating after the fall, around the same period as a medication change; connection not confirmed; may matter for the care team. |

---

## Engine vs UI

Internal code may still say `rawText`, `observation`, `entry` as technical terms.  
**Caregiver UI and composer strings** must speak Care Reality / Care Story — never notes-app chrome.


## Plain American English — every caregiver-facing surface

This rule applies to every caregiver-facing screen, message, label, question, summary, notification, error, document result, appointment view, and handoff.

- Use familiar American English, short sentences, and active voice.
- Prefer common words over clinical, engineering, database, or AI terminology.
- Use one main idea per sentence. Explain unfamiliar care terms when they are necessary.
- Use American spelling: **behavior**, **organize**, **organization**, **prioritize**, **color**, **center**, and **recognize**.
- Use clear US date and time wording. Avoid ambiguous numeric dates.
- Say who reported or noticed something and when, using ordinary language.
- Keep reports, observations, possibilities, and confirmed information distinct.
- Never make a statement sound more certain just to make it shorter.
- Do not expose internal terms such as *epistemic status, provenance, reconciliation, assertion, extraction pipeline, OCR, API, JSON, schema, database,* or *model inference*.
- Replace technical status messages with a clear explanation of what happened and what the caregiver can do next.

Examples:

| Do not show | Say instead |
|---|---|
| Evidence provenance is incomplete. | We cannot tell where this information came from yet. |
| Reconciliation is pending. | We are still checking how this fits with the rest of the care record. |
| OCR extraction failed. | We could not read this page. |
| The model inference is uncertain. | We are not sure what this means yet. |
| Assertion accepted. | You confirmed this information. |

Technical terms may remain in code, internal logs, and engineering documentation. They must not appear in caregiver-facing copy.
