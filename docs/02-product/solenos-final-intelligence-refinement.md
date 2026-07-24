# SolenOS MVP Final Intelligence Refinement

**Status:** Permanent Product Steward / MVP intelligence gate  
**Authority:** Improves Care Reality understanding — not UI polish  
**Companions:** Response Contract · Care Reality Engine Foundation · Response Intelligence · Baseline Intelligence  
**Implementation:** `src/lib/care-reality-output` · composer · clarity-pillars · `verify:care-reality-output`

**UI rule:** Do **not** optimize screens before these reasoning rules work. The moat is baseline → change → context → decision → outcome → learning — not a timeline widget.

---

## Goal

| Current | Target |
|---------|--------|
| Understood what the caregiver wrote | Beginning to understand the person's **changing care reality** |

Feel after every turn: *“The chaos in my head has been organized.”*  
Never: *“The AI summarized my message.”*

---

## Keep

- Hidden-problem detection (uncertainty, change, disagreement, load)  
- “How we got here” continuity  
- “You do not have to reconstruct the thread”  
- Living Care Record as product surface  

---

## Baseline Memory (highest priority)

Without baseline, SolenOS only stores events.  
With baseline: compare **this person** to **their usual** — that is care intelligence.

Always prefer: change from this person's normal over isolated event statements.

---

## Critical refinements (intelligence)

1. **Structure, don't reflect** — Organize situation; do not echo caregiver uncertainty as “Current understanding.”  
2. **Situation objects** — Build evolving situations from messy input (observations, people, unknowns) — not conversation storage.  
3. **Multiple perspectives** — Preserve different observation windows; never pick a winner.  
4. **What matters now** — Specific to held reality + baseline change, not “Stay with what is already held.”  
5. **What may become serious** — Evidence-based monitoring language; never “hard days” theater or alarm.  
6. **Unknowns layer** — Known / Unknown / Need to observe.  
7. **Separate** Observed · Interpretation · Concern — never merge.  
8. **Timeline intelligence** — Before / Change / After when evidence allows.  
9. **Caregiver experience** — Preserve load/uncertainty as care reality (never diagnose burnout).  
10. **Not a chatbot** — No thanks / empathy / pep talk.  
11. **Person-specific** — Meaning from difference vs this person's patterns.  
12. **Patterns over single notes** — “Appeared more than once,” not diagnosis.  
13. **Internal confidence** — Said vs inferred vs uncertain (never % in UI).  
14. **Significance** — Why an event matters for later decisions.  
15. **Urgency ≠ importance** — Separate urgent / visible / historical.  
16. **Decisions before outcomes** — Store reason + unknown outcome.  
17. **Never false confidence** — Uncertainty stays uncertainty; no accidental diagnosis.  
18. **Highest-value ask only** — Missing context that would clarify; never “tell me more.”  
19. **Memory value test** — Useful six months later, or it is only conversation.  
20. **Care context memory** — Remember situation around events, not events alone.  
21. **Not a task list** — Caregiver load → understanding, not checklist.  
22. **No generic healthcare articles** — Stay connected to this person’s held evidence.  
23. **Temporal anchoring** — When known / when unknown for important observations.  
24. **Escalation without alarm** — “Worth noticing,” never “something is wrong.”  

## Epistemic trust

Never convert uncertainty into false confidence or diagnosis.  
Questions = highest-value missing context only.  
Every output must have **memory value** six months later.

## Output orientation order

1. What is understood about this situation  
2. What changed (vs baseline when known)  
3. Known / perspectives  
4. Unknowns  
5. What matters now / can wait  
6. What will be remembered  
7. Next useful observation  

## Never hardcode

Design examples (any named person, falls, meds, family visit disagreements) are **illustrations only**. Derive every response from actual evidence in the Living Care Record.

## Final test

Who is this person? What is changing? Compared with what baseline? Who observed? What is known / uncertain? What remains visible / can wait / should be remembered?
