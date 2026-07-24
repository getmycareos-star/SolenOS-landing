# SolenOS Engineering Leadership Charter

**Status:** Permanent governing document  
**Authority:** Highest engineering priority for this repository  
**Scope:** Every plan, implementation, refactor, review, and approval  
**Do not** treat this as a one-time prompt. It remains in force until explicitly replaced by a newer version of this Charter.

**Companion documents (also mandatory):**

- [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) — Product Steward identity and caregiver promise  
- [`docs/02-product/solenos-input-reality-directive.md`](./docs/02-product/solenos-input-reality-directive.md) — Input Reality (anything can enter)  
- [`docs/architecture/SOLENOS_CTO_OPERATING_DIRECTIVE.md`](./docs/architecture/SOLENOS_CTO_OPERATING_DIRECTIVE.md) — CTO operating standard and trust rules  

---

## Core promise

Every implementation should move SolenOS closer to:

> Preserve the continuity of a person's care journey through trustworthy understanding that reduces caregiver burden.

SolenOS is **Care Reality Intelligence** built around a **Living Care Record**.  
The Living Care Record—not the AI—is the product.

---

## Architectural authority

This Charter has **higher priority** than:

- implementation convenience  
- temporary workarounds  
- feature velocity  
- unnecessary AI sophistication  
- architectural shortcuts  

If there is a conflict, **the Charter wins**.

Before planning, implementing, refactoring, reviewing, or approving any code change:

1. Read this Charter.  
2. Read `PRODUCT_PRINCIPLES.md`.  
3. Read the CTO Operating Directive when the change affects architecture, caregiver copy, ACS, Care Reality State, or Living Care Record UX.  
4. If a requested implementation conflicts with the Charter, **do not silently implement it**. Explain the conflict, explain why, and propose an alternative that preserves the Charter.

---

## Permanent review checklist

Before every significant change, verify:

| # | Question | Required answer |
|---|----------|-----------------|
| 1 | Does this strengthen caregiver trust? | Yes |
| 2 | Does this preserve continuity? | Yes |
| 3 | Does this reduce caregiver cognitive load? | Yes |
| 4 | Does this reinforce the Living Care Record as the product? | Yes |
| 5 | Does this strengthen Care Reality State? | Yes (when relevant) |
| 6 | Does this strengthen Active Care Situation? | Yes (when relevant) |
| 7 | Does this fit the long-term architecture? | Yes |
| 8 | Does this avoid duplicate logic? | Yes |
| 9 | Does this preserve consistency across the application? | Yes |
| 10 | Could this introduce regressions? | Mitigated |
| 11 | Can this be simplified without reducing value? | Prefer yes |

If any required answer is **No**, redesign before writing code.

---

## North Star (what SolenOS is not)

SolenOS is **not**:

- a chatbot  
- a document summarizer  
- a note-taking app  
- a reminder app  
- a medical diagnosis tool  
- an AI assistant  

SolenOS **is** a Care Reality Intelligence platform. Continuity over isolated interactions. Understanding over information. Trust over impressive AI.

---

## Continuity pipeline (canonical)

```
Input → Capture → Care Context → Active Care Situation
  → Progressive Understanding → Care Reality State
  → Living Care Record → Timeline
```

Every observation must strengthen Care Reality State, Care Context, Active Care Situation, Person Baseline, Timeline, and Decision Memory. Nothing should feel isolated, forgotten, or require the caregiver to reconstruct the story manually.

---

## Progressive understanding (mandatory)

Never treat every message as a new workflow. Every new observation must first answer:

1. Does this belong to the current Active Care Situation?  
2. What did we already know?  
3. What changed?  
4. What uncertainty was resolved?  
5. What new uncertainty appeared?  
6. Does this affect what matters now?  

Responses must **evolve**. They must never restart.

---

## Trust rules

Never:

- invent facts  
- overstate certainty  
- fabricate urgency  
- expose internal AI reasoning  
- display developer terminology to caregivers  
- leak implementation details  
- show confidence percentages without meaningful explanation  
- repeat response templates unnecessarily  
- merge observation (what happened) with interpretation (what it may mean) without separation  

Internal concepts belong only in engineering / ops tools—never in caregiver-facing experiences.

---

## Cognitive load budget

Before displaying anything, ask: **Does the caregiver need this information right now?**  
If not, do not display it. Reveal understanding progressively.

---

## Definition of done

A change is **not** complete because it compiles or tests pass.

It is complete only when an exhausted caregiver would feel:

- understood  
- remembered  
- oriented  
- less overwhelmed  
- more confident about what changed  

If those outcomes are not achieved, continue refining.

---

## Conflict protocol

When a request conflicts with this Charter:

1. Name the principle(s) in conflict.  
2. Explain the trust / continuity / load risk.  
3. Propose an alternative that achieves the goal while preserving the Charter.  
4. Prefer the option that best satisfies the Charter even if it requires more engineering effort.

---

## Continuous responsibility

Do not wait for reminders. Use this Charter as the reference standard throughout the lifetime of SolenOS unless it is explicitly replaced by a newer version.

