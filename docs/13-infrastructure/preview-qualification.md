# Path A Preview Qualification (SolenOS)

**Status:** Locked — founder/internal preview integrity  
**Audience:** Founder / internal full-system preview  
**Not:** External pilot · cloud production · multi-instance

---

## Mission

Prove the current MVP behaves like a **Care Reality** system — not a chatbot, document summarizer, or task manager.

**Promise:** SolenOS understands a person's changing care reality over time and helps caregivers recognize change, preserve decisions, and understand uncertainty.

**Final test:** After one interaction, does a tired family caregiver feel *someone helped organize what is happening* — not *I used another AI tool*?

---

## Product truth

| SolenOS is | SolenOS is not |
|------------|----------------|
| Living Care Record | Chatbot |
| What happened · changed · decided · still unclear | Medical advice assistant |
| Change over time | Document summarizer |
| Unknowns as first-class | Task manager / productivity dashboard |

---

## Qualified Path A flow

```
Text / Documents
  → POST /api/situation
  → Care Reality Extraction
  → Situation Relationship Engine
  → CRS / ACS / Decision Memory
  → Response Contract
  → Caregiver DTO
  → Living Care Record Panel
```

Every caregiver-visible response must pass through this path.

---

## Qualification gate

```bash
npm run verify:product-path
```

Must exit 0. Do not weaken tests — fix implementation.

Gate includes Path A spine plus:

- `verify:response-intelligence-upgrade` — understanding, not summaries  
- `verify:living-care-record-ux` — LCR is the product surface  
- `verify:golden-dementia-baseline` — real dementia caregiver scenarios  
- `verify:uncertainty-preservation` — no invented certainty  
- `verify:visual-language` — no AI/system chrome  
- `verify:trust-consent` — transparency without legal walls  
- `verify:caregiver-understanding-test` — midnight 30-second test (hard reject)  
- `verify:intelligence-validation` — hard rejection of echo/tasks/interview  
- `verify:caregiver-understanding-output` — not document summarization  
- `verify:mvp-response-behavior` — Care Reality Object before language  
- `verify:learning-first-release` — feedback / research honesty  
- `verify:mvp-faq` + `verify:nav-journey` — trust journey connected  

Do **not** weaken these. Fix implementation when red. Hollow “what matters” placeholders and recognition-only responses must fail.

---

## Durability honesty (this preview)

| Claim | Qualified? |
|-------|------------|
| Same machine restart (single Node + `.data/` JSON) | **YES** |
| New device | **NO** |
| Multiple users / real auth | **NO** |
| Cloud / multi-instance deploy | **NO** |

Do not imply production readiness.

Persistence module: `src/lib/living-care-record-persistence/`

Ops (`?ops_key=`, `/ops`) is **not** the caregiver product.

---

## Manual acceptance (after gate green)

1. `npm run verify:product-path` → 0  
2. `npm run build` → success  
3. `npm run dev` → http://localhost:3000  

Scenarios: messy note → LCR understanding (not summary); medication uncertainty preserved; Done for now → return continuity; document → care reality (not PDF summary).

---

## Integrity rules (enforce in code)

Meaning before information · never task-ify early · unit of intelligence is **change** · no false continuity · unknowns first-class · caregiver is not a workflow metric · no engagement tricks · situation before solution · person behind the condition · evidence levels internal · response must increase clarity, preserve uncertainty, maintain dignity, reduce load.

**Do not** add components/labels/cards to “look advanced.” Strip hollow chrome instead.
