# Product Integrity Rules (SolenOS MVP)

**Status:** Locked — applies to all Path A caregiver-facing work  
**Companion:** [`../13-infrastructure/preview-qualification.md`](../13-infrastructure/preview-qualification.md)  
**Cursor rule:** `.cursor/rules/solenos-product-integrity.mdc`

---

## Final MVP product test

A caregiver writes: *“I don't even know where to start. Things feel different with Mom.”*

After using SolenOS, do they feel:

- Wrong: *“I used another AI tool.”*  
- Right: *“Someone helped me organize what is happening.”*

Only the second qualifies.

---

## Rules

1. **Meaning before information** — Did understanding improve? Not “how much data did we collect?”
2. **Never convert care into tasks too early** — Understand change before organizing action.
3. **Unit of intelligence is change** — Not documents, messages, or uploads as the product object.
4. **No false continuity** — Never invent prior knowledge or relationships.
5. **Preserve unknowns as first-class** — Unknowns are care reality, not failure.
6. **The caregiver is not the problem to optimize** — Reduce mental burden; never engagement metrics.
7. **No engagement tricks** — No streaks, badges, usage goals, “come back tomorrow.”
8. **Situation before solution** — Understand → change → uncertainty → considerations — never Problem → AI answer.
9. **Preserve the person behind the condition** — Dementia is entry; the person is the subject.
10. **Every statement needs evidence level (internal)** — Never flatten high/medium/low into one truth in UI.
11. **Response quality standard** — Clarity · preserve uncertainty · dignity · reduce load — any No fails.
12. **Golden dementia scenarios = messy real life** — No harsh correction, diagnosis FAQ, side-picking, emergency theater, or motivational scripts.
13. **Architecture follows philosophy** — Care Reality objects (events, observations, decisions, outcomes, relationships, unknowns, evidence) — not documents→summaries→tasks→chat.
14. **MVP success metric** — After one interaction: what changed · why it might matter · what I know · what I don't · what to pay attention to next.

---

## Implementation posture

- Do **not** add UI chrome to pass the “looks advanced” test.  
- Do **not** weaken verify gates.  
- Fix implementation when product-path fails.

## Product-path caregiver behavior (paste / restart)

`npm run verify:product-path` includes `verify:caregiver-paste-behavior` (plus initial assessment, care-reality language, output-quality). Green means:

1. Returning ACS turns do **not** restart with Initial Assessment filler  
2. Caregiver copy does **not** speak “related note was added” or `Related:` full-sentence raw paste  
3. Two-turn doctor → refuse eat/sleep shows **care-reality change / continuity** language  

Phrase bans alone are not enough — these scripts compose the real caregiver path.
