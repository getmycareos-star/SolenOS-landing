# SolenOS Input Reality Directive — Anything Can Enter the Care Reality

**Status:** Permanent Product Steward extension  
**Authority:** Product Steward — same force as [`PRODUCT_PRINCIPLES.md`](../../PRODUCT_PRINCIPLES.md)  
**Companions:** Response Behavior Constitution · [`caregiver-response-contract.md`](./caregiver-response-contract.md) · ADR-018 (MVP intake channels) · Living Care Record UX (ADR-019)

---

## Important

SolenOS must **not** assume caregivers will only enter structured observations.

A caregiver's reality is messy.

They may provide:

- short notes
- emotional statements
- questions
- voice notes
- photos
- documents
- discharge summaries
- medication lists
- messages
- emails
- screenshots
- memories
- incomplete information

Examples:

- "Mom refused to eat."
- "She seems different today."
- "Doctor changed her medication."
- "I don't know what is happening."
- [Hospital discharge document uploaded]
- [Medication photo uploaded]

**All of these are valid inputs into the same Care Reality system.**

Do **not** create separate experiences for notes, documents, voice, or questions.

They are different inputs into the **same understanding layer**.

### MVP intake vs architecture (ADR-018)

- **Architecture:** anything that carries care reality may enter the same spine.
- **MVP shipping channels:** messy **text** + **Scan / Snap / Upload / Share** (documents / photos / shared content). See [`solenos-input-entry-contract.md`](./solenos-input-entry-contract.md).
- Voice mic UI remains FUTURE per ADR-018 — when voice lands, it plugs into this same layer, not a new product.
- Entry method never changes Evidence Understanding / SRE / Response Contract.

---

## Core principle

The caregiver should not have to know how to organize information.

**They provide the reality. SolenOS creates structure.**

The caregiver should be able to say:

- "Here is what happened."
- or "Here is the document."

and SolenOS should determine how it contributes to:

- Care Reality State
- Active Care Situation
- Living Care Record
- Timeline
- Decision Memory
- Existing uncertainties

---

## Evidence and "Why" behavior

Transparency must exist from the beginning.

Explanation depth should depend on the **maturity and importance** of understanding.

Do not overwhelm a caregiver with internal explanation before enough understanding exists.

**Principle:**

- Transparency is always available.
- Explanation depth grows as understanding grows.

### Level 1 — New information

Prioritize:

- recording what happened
- acknowledging the observation
- identifying what is unknown
- asking useful (situation-mapped) questions

Why-asks may be available in plain language, e.g.  
*"These questions help understand whether this is a temporary event or a change from Mom's usual pattern."*

Do **not** expose technical reasoning.

### Level 2 — Emerging understanding

When multiple related observations exist, do **not** respond as if they are separate events.

Update understanding: what has changed · evidence (dated notes) · what remains uncertain.

### Level 3 — Important decisions

For decisions, "why" becomes essential.

Preserve in Decision Memory (`src/lib/decision-memory`):

| Field | Meaning |
|-------|---------|
| What | What changed or was chosen |
| When | Date/time |
| Who | People involved when known |
| Context | Situation that caused the decision |
| Evidence | Supporting information + source |
| Alternatives | Options that existed (when mentioned) |
| Reason | Why this path was selected — or explicit unknown |
| Outcome | What happened afterward |
| Status | Active / Pending / Changed / Completed |

Value is **preserving why the decision existed** — not only that it was stored.

---

## Before / during / after continuity

Hospital-to-home transitions reveal the core problem: the hospital knows the medical event; the family knows the person's life. SolenOS connects them.

```
Before (baseline) → Event → Hospital / clinical input → After (life change)
```

Intelligence comes from **relationships between events** — not from storing another discharge summary.

Care Transition Mode UI remains FUTURE. Transition **signals** and Decision Memory are MVP.

---

## Important architecture rule

Never store only the interpretation.

Always preserve:

Original input → Source → Extracted information → Care Event / Observation / Decision → Current understanding → Evidence supporting that understanding

---

## Evidence vs reasoning

Distinguish:

| Caregiver need | Meaning |
|----------------|---------|
| "Why did SolenOS say this?" | Prefer redirect to **evidence**, not model justification |
| "Show me the evidence behind this." | **What caregivers need** |

**Never expose:** chain of thought · internal reasoning · model decisions · technical classifications · `ambiguous_extraction` · entity dumps · confidence percentages · reasoning traces · system states

**Instead show:** what was observed · where it came from · what is known · what is uncertain · why this matters

---

## Source priority (trust hierarchy)

Documents need **source priority rules**. A hospital discharge summary must **not** be treated the same as a caregiver's memory note.

Evidence hierarchy is a core trust feature. When sources conflict or both inform understanding, SolenOS should:

1. Prefer higher-priority clinical artifacts (e.g. discharge summary, signed med list) for the **current attributed fact** (what SolenOS treats as the standing care-system claim)
2. **Always keep** the caregiver note as **lived observation** — never delete, overwrite, or discard either source
3. **Flag the conflict** as uncertainty / disagreement in plain language (both sources visible via evidence maturity)
4. Never invent document claims from memory, and never silently merge into one fiction

**Permanent conflict rule (locked):** Option **B** — prefer higher-priority source for “current fact”; retain caregiver observation; flag conflict; **never remove any**.

**IMPLEMENTED (engine):** `sourcePriorityRank` / `evaluateSourceConflict` in `src/lib/source-conflict` — clinical/discharge > document > note for orientation; both retained; plain-language conflict note. Exact full ranked table can deepen later.

**IMPLEMENTED (API):** `toCaregiverSituationResponse` — caregiver `/api/situation` omits reasoning chains / engine-layer dumps.

**IMPLEMENTED (documents):** `document-evidence` stores original name, mime, extract hash + preview alongside extracted text (binary blob persistence can deepen).

---

## Final product test

A caregiver should be able to drop **anything** into SolenOS and feel:

> "I gave the system my reality, and it helped me understand it."

Not:

> "I have to format information correctly for the AI."

**SolenOS receives the chaos. SolenOS preserves the continuity.**
