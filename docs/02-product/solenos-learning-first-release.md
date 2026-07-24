# SolenOS Learning-First Release Directive

**Status:** Locked for first external / research preview release  
**Authority:** Engineering Leadership · Product Steward · MVP Research Validation  
**Companions:** [`solenos-mvp-research-validation.md`](./solenos-mvp-research-validation.md) · [`solenos-mvp-input-experience.md`](./solenos-mvp-input-experience.md) · [`solenos-mvp-response-behavior.md`](./solenos-mvp-response-behavior.md) · Product integrity  
**Module:** `src/lib/learning-first-release` · `src/lib/research-feedback`  
**Verify:** `verify:learning-first-release`

---

## Current constraints

- Cursor credits nearly exhausted  
- Netlify deployment resources limited  
- Early access caregivers waiting  
- First real-world product validation  

**Objective is not** a perfect Care Reality Engine.  
**Objective is** a **stable MVP** that can generate **real caregiver feedback**.

---

## Primary goal

**Do not optimize for visual polish. Optimize for learning.**

The release answers one question:

> When caregivers share messy care information, does SolenOS help them understand the situation more clearly than before?

Everything else is secondary.

---

## Before deployment — reliability only

Highest priority:

1. Fix crashes  
2. Prevent data loss  
3. Fix broken workflows  
4. Every input reaches the Living Care Record  
5. Care Timeline / care story updates correctly  
6. Responses follow MVP Understanding / Response Contract  
7. New and existing Care Records behave correctly  

**Do not spend remaining credits on:** UI polish · animations · spacing · typography · cosmetic redesign · visual effects.

---

## This is a research prototype

Not Version 1. Success = learning, not beautiful software.

Learn:

- Did caregivers understand the response?  
- Did SolenOS organize the situation correctly?  
- What important information did it miss?  
- Which questions should it have asked?  
- Would they return after another care event?  

---

## Built-in feedback (required)

After every understanding response, present a simple prompt:

> Did SolenOS help you understand this situation?  
> 👍 Yes · 👎 No  

If **No**, ask (optional free text — skip allowed):

- What did SolenOS miss?  
- What did you expect it to understand?  
- Was anything confusing?  
- Is there something you expected SolenOS to notice?  

**Capture · store · do not discard.** Product research, not engagement hacking.

---

## Transparency (required)

Do not present SolenOS as a finished medical product.

Communicate early research preview clearly, e.g.:

> This is an early research preview of SolenOS. We're learning how caregivers organize complex care situations over time. Your feedback directly helps improve the system.

---

## Non-negotiable (never compromise)

1. **Never fabricate medical information** — unknown stays unknown  
2. **Never lose user data** — notes/documents/messages stay on the Care Record  
3. **Never present assumptions as facts** — separate observations · interpretations · unknowns  
4. **Never make caregivers feel unsafe** — no diagnosis, treatment advice, false certainty, unnecessary alarm  

Almost everything can improve later. These cannot fail: reliability · continuity · truthfulness · history · trust.

---

## Engineering principle

```
Release → Observe → Collect feedback → Identify failures → Improve → Repeat
```

Do not perfect the reasoning engine in isolation.  
The Care Reality Engine improves through real caregiver interactions.

The first deployment is the **beginning of learning**, not the end of development.
