# Hard Rejection Test & Intelligence Validation Layer (SolenOS)

**Status:** Locked architecture directive  
**Authority:** Response Acceptance Gate · Response Intelligence Upgrade · Situation Generator · Care Recipient Anchor  
**Companions:** [`solenos-response-intelligence-upgrade.md`](./solenos-response-intelligence-upgrade.md) · [`solenos-situation-generator.md`](./solenos-situation-generator.md) · [`solenos-care-reality-memory.md`](./solenos-care-reality-memory.md) · [`solenos-output-quality.md`](./solenos-output-quality.md) · [`solenos-response-contract.md`](./solenos-response-contract.md) · [`solenos-caregiver-understanding-test.md`](./solenos-caregiver-understanding-test.md)  
**Module:** `src/lib/care-reality-intelligence/intelligence-validation.ts`  
**Verify:** `verify:intelligence-validation`

---

## Problem

A response can contain correct information, good grammar, extracted facts, and summaries — and still **fail** the caregiver need.

| Weak pipeline | Required pipeline |
|---------------|-------------------|
| Message → important sentences → summary | Message → care reality model → situation understanding → human orientation |

---

## Core rule

Every major SolenOS response must pass a **rejection test** before the caregiver sees it:

> Does this response help the caregiver understand the **changing care reality** better?

If not → **do not show it** (reject / regenerate). MVP: hard reject (throw) so failed output never reaches the panel.

---

## Hard failure modes (must reject)

| # | Failure | Why |
|---|---------|-----|
| 1 | **Sentence summary** — restates the message as a list | No change, connection, mattering, or unknown |
| 2 | **Task generator** — monitor / call / checklists | Work without understanding |
| 3 | **Generic safety** — “contact a provider” without context | Ignores baseline, timing, related events, uncertainty |
| 4 | **Family distraction** — centers sibling disagreement | Care recipient is the center |
| 5 | **Excessive questioning** — interview battery | Overwhelm; need one high-value missing piece |

---

## Success pattern (illustration only — never templates)

Current understanding of connected changes · what changed · what may connect · what we know · what remains unclear · **one** next understanding step.

Never invent causation. Never diagnose.

---

## Internal checklist (before respond)

1. Who is this care story about?  
2. Compared against known baseline (or initial assessment when none)?  
3. What changed identified?  
4. Related events connected (possible, not proven)?  
5. Uncertainty preserved?  
6. Cause not pretended?  
7. Confusion reduced?  
8. Unnecessary work avoided?  
9. Would this help a caregiver at midnight?

Critical “no” → reject.

---

## MVP acceptance

Table stakes (summarize, extract meds, timelines, keywords) are **not** success.

Success: caregiver thinks *“This understands what is happening with my person.”*  
Failure: *“This summarized what I typed.”*

---

## Architecture principle

```
Information → Meaning → Change → Context → Understanding
```

SolenOS is not a smarter notes app, chatbot, or document processor.  
It preserves the story of a person's care reality over time.
