# Intelligence Layer — Do Not Hardcode Examples (SolenOS)

**Status:** Locked product SoT · Intelligence Layer constraint  
**Authority:** Care Reality Engine · Response Intelligence · Extraction layers · Golden scenarios  
**Companions:** [`solenos-response-intelligence-directive.md`](./solenos-response-intelligence-directive.md) · [`solenos-care-reality-language.md`](./solenos-care-reality-language.md) · Observation / Event / Decision / Outcome / Relationship / Unknown extraction · [`solenos-golden-caregiver-scenarios.md`](./solenos-golden-caregiver-scenarios.md) · [`solenos-care-reality-situation-model.md`](./solenos-care-reality-situation-model.md) · [`solenos-illustration-vs-implementation.md`](./solenos-illustration-vs-implementation.md) · [`solenos-generalized-care-understanding.md`](./solenos-generalized-care-understanding.md) · [`solenos-care-signal-understanding.md`](./solenos-care-signal-understanding.md)
**Module:** `src/lib/care-reality-intelligence/no-hardcode-contract.ts` · acceptance gate  
**Verify:** `verify:intelligence-no-hardcode` · `verify:generalized-care-understanding`

---

## Core rule

**Do not build SolenOS around fixed words, phrases, or predefined symptom lists.**

Examples in product docs are **not keywords to detect**.  
They are **categories of care reality change** that the system should understand from messy human input.

A caregiver may describe the same reality using thousands of different expressions.  
The system must **infer meaning from context**, not match phrases.

This keeps the MVP aligned with the **Care Reality Engine** — never a dementia symptom classifier.

---

## Real user input is messy

Assume unstructured information through:

- emotional text dumps  
- voice transcripts  
- photos of documents  
- hospital discharge papers  
- medication photos  
- screenshots  
- messages copied from family conversations  
- handwritten notes  
- incomplete thoughts  

### Illustration only (never product if-branches)

A caregiver will **not** write: *“Patient experiencing increased cognitive decline.”*

They may write: *“Mom keeps asking where Dad is even though he passed years ago. She got upset when I told her.”*

The system must understand the **underlying care reality**.

---

## Build around care-reality meaning — not keywords

Identify meaningful changes by understanding **categories of change**, not phrase lists.

### Priority 1 — Changes in care reality

Recognize concepts such as (illustrations of *shape*, never keyword banks):

| Concept category | Understand from many expressions of… |
|------------------|--------------------------------------|
| Cognitive / understanding changes | Not making sense like before · forgetting familiar knowledge · repeating questions · seeming lost in familiar places · not recognizing situations |
| Behavioral / personality changes | Acting differently · more withdrawn · not how they normally behave · personality feels different |
| Functional changes | Difficulty with normal activities · needing more help · struggling with routines · changes in independence |
| Physical / daily pattern changes | Eating, sleeping, moving differently · increased weakness · reduced activity |

**Ask:** *What changed from this person’s previous baseline?*

### Priority 2 — Safety-relevant events

Recognize safety changes **from context** — not only the word “fall.”

Illustration of *shape*: *“I found her sitting on the bathroom floor and she said she didn’t know how she got there.”* → possible safety-relevant event.

Also: near-falls · leaving home unexpectedly · unsafe situations · medication errors · inability to complete normal activities safely.

### Priority 3 — Care decisions and interventions

Recognize: medication changes · hospital visits · clinician recommendations (acted on) · new support · living-arrangement changes · family decisions.

Capture not only **what changed**, but **why** when known — and preserve Reason unknown when not.

Illustration of *structure* (never phrase triggers):

| Input shape | Understanding |
|-------------|----------------|
| Treatment stopped in a care encounter | Decision + Event context + Unknown reason + Follow-up for outcome |

---

## Always reason through this structure

**Never output:**

> Detected keywords: confusion, medication, fall.

**Instead create:**

1. **Current understanding** — What appears to be happening?  
2. **What changed** — What is different from previous reality?  
3. **Important context** — What events, decisions, or observations connect?  
4. **Still unclear** — What information is missing?  
5. **What would help complete the picture** — Usually **one** simple question.

---

## Ranking when many things appear

Prioritize (engine attention order — never expose as caregiver chrome):

1. Changes in the person’s condition  
2. Safety-related events  
3. Recent care decisions  
4. Functional changes  
5. Unknowns and missing context  
6. Caregiver emotions and family dynamics  

Family conflict, frustration, and emotional statements are **preserved as context**.  
They must **not** become the primary care situation unless they directly affect care decisions.

---

## Product principle

SolenOS is **not** extracting information from text.  
SolenOS is **reconstructing the changing reality of a person’s care**.

| Answer this | Never answer this |
|-------------|-------------------|
| What is happening with this person, what changed, what decisions happened, and what remains uncertain? | What words appeared in the caregiver’s message? |

---

## Caregiver UI

Never show: keyword lists · “detected” · confidence % · symptom classifier language · internal ranking enums.  
Internal category names (if any) stay engine-only — caregiver copy stays Care Story language ([`solenos-care-reality-language.md`](./solenos-care-reality-language.md)).
