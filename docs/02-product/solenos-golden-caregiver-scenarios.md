# SolenOS Golden Caregiver Scenarios

**Status:** Product Constitution + Acceptance Test Framework  
**Decision:** Validation step **C** before Response Behavior / Situation Relationship code  
**Authority:** Product Steward  
**Clinical entry:** Dementia / progressive-dependency (ADR-005) — product remains Living Care Record, not a dementia tracker  

**Companions:** All `docs/02-product/solenos-*.md` · [`caregiver-response-contract.md`](./caregiver-response-contract.md) · [`CLINICAL_PROFILE.md`](../architecture/CLINICAL_PROFILE.md) · **[Golden map → verify → composer](../../17-canonical-architecture/golden-scenario-map.md)** (Phase 3.3)

---

## Sequence

1. Architecture / directives (done)  
2. **Behavior definition (this doc)**  
3. **A — Implement** against scenarios — **engine spine first**, not prompts/UI  

```
Input
  → CareContext
  → Situation Relationship Engine
  → Care Reality State update
  → Living Care Record
  → Caregiver response
```

Experience problems are mostly **downstream symptoms of missing understanding state**. Do not start by patching prompts or UI templates.

---

## Acceptance standards

### Orientation bar

> Would an exhausted caregiver feel more oriented after this interaction?

### G61 — The Real Caregiver Test (feature approval)

**Placement:** **CI primary + optional compose-path gate** — golden / tier1 scripts always; `applyRealCaregiverTestComposeGate` after acceptance in non-prod (throw) or feature-flagged prod (log only). Never blocks capture. See [ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md). Runtime quality also = `assertResponseAcceptanceGate` + composer bans.

Before any feature is approved, run:

> If a daughter using SolenOS at 2 AM after a difficult day saw this, would she feel more capable of caring for her parent?

| Pass | Fail |
|------|------|
| Calmer · clearer · more oriented · less alone in the complexity | More confused · more work · more questions without direction · feels like software administration |

### The No Reconstruction Rule

The caregiver should **never** have to reconstruct the story manually.

If the system requires them to remember what happened before, why something mattered, what was already answered, or which events belong together — **SolenOS has failed**.

The system's job is to **preserve continuity**.

### No Prompt Patch Architecture

Scenarios test **behavior**, not wording.

Also: [Response Intelligence](./solenos-response-intelligence-directive.md) — meaning over language patterns; never keyword→response systems.

| Bad | Good |
|-----|------|
| If user says fall → show fall template | Input → CRS → Relationship evaluation → Understanding update → Response |

Cursor must **not** solve scenarios by adding response templates or phrase if-branches.

### Global hard fails (any scenario)

- Diagnosis / medical advice / “what should I do” advice engine  
- Dementia FAQ / population comparison (“other patients usually…”)  
- ChatGPT empathy / therapy voice  
- CareLoad / burnout / confidence % / OCR / extraction labels / relationship enums  
- Restart-from-zero when continuity should exist  
- Re-asking answered or pushback-declined gaps  
- Document-analyzer framing  
- One good day = situation resolved  
- Done for now resolves ACS  
- Silent identity inference / wrong-person attachment  
- Separate Care Realities per contributor for the same person  
- Blame / compliance language toward caregivers  

### Golden Failure Review

For every failed scenario, classify:

| Type | Meaning |
|------|---------|
| **1 — Memory** | System forgot |
| **2 — Understanding** | Stored but did not connect meaning |
| **3 — Trust** | Overstated, invented, or confused |
| **4 — Cognitive load** | Gave too much |
| **5 — Identity** | Attached information to the wrong person |

Do not treat every issue as a UI bug.

---

## How to use

| Column | Meaning |
|--------|---------|
| **Input** | What the caregiver provides (any channel) |
| **Must understand** | Care Reality / ACS / evidence outcomes |
| **Must show** | Caregiver-visible experience |
| **Must not** | Hard fails |
| **Pass?** | Orientation + No Reconstruction + G61 |

Examples are **patterns only**. Dementia-first does **not** mean dementia FAQ.

---

## Setup

1. `/welcome` → Begin → light orientation → **ask once** for display name → capture  
2. Use display name in copy; subject = care recipient; contributor attributed  

---

# Tier 1 — Continuity core (G1–G13)

## G1 — First soft note

**Input:** `"Mom refused to eat."`  
**Pass:** Held · ≤1–3 mapped asks · L1 evidence · no diagnosis/alarm/chat  
**Bar:** Chaos out of head without learning an app.

## G2 — Improvement while situation open

**Input:** `"She ate better today."` after eating ACS  
**Pass:** Related improvement outcome · understanding updated · **not** auto-resolved · no “is it resolved?”  
**Bar:** Connected to what came before.

## G3 — New contributor, same person

**Input:** Brother adds confusion note  
**Pass:** Same Care Reality · attribution · relationship evaluated  
**Bar:** Shared understanding, not sibling fragmentation.

## G4 — Document only

**Input:** Discharge PDF, no text  
**Pass:** Same pipeline · person-focused response · ≤1–3 asks if needed · no analyzer chrome  
**Bar:** Document helped the journey.

## G5 — Emotional only

**Input:** `"I'm exhausted."`  
**Pass:** Record-based acknowledge + invite care context · no therapy/scores  
**Bar:** Path to make the situation clearer.

## G6 — Long chat / email

**Pass:** Multiple linked events · source preserved · not one summary  
**Bar:** Messy conversation → what matters.

## G7 — Hard safety (same loop)

**Pass:** Acknowledge → ≤1–3 safety-priority asks → Clarity faster · context linking  
**Bar:** Oriented without panic UI.

## G8 — Pushback / already answered

**Pass:** Gap closed forever · never re-ask  
**Bar:** Felt heard.

## G9 — Guidance symptom

**Input:** `"what should I do?"`  
**Pass:** Continuity symptom · Decision from evidence · never advice engine  
**Bar:** Clearer from held care.

## G10 — Done for now → return

**Pass:** Pause only · soft one-time invite · no restart  
**Bar:** Remembers where we left off.

## G11 — Welcome → Begin restore

**Pass:** New session · durable reality restored  
**Bar:** Story continues.

## G12 — Source conflict (doc vs note)

**Pass:** Priority for current fact · keep both · flag conflict  
**Bar:** Nothing erased.

## G13 — Record question

**Input:** `"Why is Mom taking this medication?"`  
**Pass:** Decision memory path · not forced Clarity form  
**Bar:** Evidence-backed, not a form.

---

# Tier 2 — Architecture risk (G14–G19)

## G14 — Same words, different meaning

**Purpose:** Prevent keyword matching.  
**Input:** `"Mom is sleeping a lot."`  
**Contexts:** busy day vs post-med change vs weeks-long pattern  

| Check | Pass |
|-------|------|
| Understanding | Considers existing Care Reality first |
| Relationship | Context, not words alone |
| Response | Avoids assuming decline |
| Must not | “Sleeping more means dementia progression” |

**Bar:** Context, not just sentences.

## G15 — Duplicate information

**Input:** Fall note, then `"Just reminding you Mom fell yesterday."`  

| Check | Pass |
|-------|------|
| Record | No duplicate incidents |
| Understanding | Recognizes reinforcement |
| Evidence | May update source/time |
| Must not | Multiple fake incidents |

**Bar:** Remembers what already happened.

## G16 — Contradictory caregiver observations

**Daughter:** eating normally · **Son:** barely ate  

| Check | Pass |
|-------|------|
| Reality | Same Care Reality |
| Conflict | Uncertainty preserved |
| Attribution | Who said what visible |
| Must not | Silent winner |

**Bar:** Perspectives organized, not erased.

## G17 — Care recipient identity protection

**Existing:** Mom · **Input:** `"Dad had a doctor's appointment today."`  

| Check | Pass |
|-------|------|
| Identity | Does not attach to Mom |
| Action | Ask or appropriate identity path |
| Must not | Dad facts in Mom’s record |

**Bar:** Protects the person's story. **Failure Type 5** if violated.

## G18 — Long absence return (e.g. 3 months)

| Must show | Must not |
|-----------|----------|
| Reality restored · recent relevant changes · important unresolved | First-time UX · dump entire history · unnecessary total summary |

**Bar:** Remembers what matters.

## G19 — Empty / low-value input

**Input:** `"Update"` / `"Nothing new"`  

| Pass | Must not |
|------|----------|
| No hallucinate · no fake events · ask naturally if needed | Force a workflow |

**Bar:** Does not create work for the caregiver.

---

# Tier 3 — Dementia-first critical (must pass before coding)

> Dementia care is not only about events. It is about gradual change, uncertainty, behavior shifts, caregiver interpretation, and preserving dignity.

**These 10 + G61 are the highest-priority dementia-entry gates:**

## G34 — Familiarity baseline

Mom’s normal is unique (wake time, tea, calls). Change measured against **her** baseline.  
**Must not:** “Normal dementia progression.”  
**Bar:** Knows what normal means for Mom.  
**Store:** Person-told usual under Care Reality key (`resolveCareRealityStoreKey`) — contributor id lookup must still resolve. Implementation: `care-epistemics` `recordFamiliarityFromText` / `listFamiliarityBaseline`.

## G37 — Interpretation vs observable fact

**Input:** `"Mom is being difficult lately."`  
Preserve caregiver experience **and** observables (refused meds, upset during bathing).  
**Must not:** Treat interpretation as fact.  
**Bar:** Helps organize confusion.

## G40 — Multiple small signals becoming meaningful

Forgot appointment → left stove on → needed help dressing (weeks).  
Eventually: daily-living changes over time.  
**Must not:** Wait for crisis.  
**Bar:** Helps families notice gradual change.

## G41 — Preserving past self

`"Mom loves gardening."` → later gardening stopped = meaningful life change.  
**Bar:** Remembers who Mom is.

## G43 — Avoid false progression / fluctuation

Bad day confused · good day conversational.  
**Must not:** “Dementia improved.”  
**Prefer:** Today appeared better vs recent observations.  
**Bar:** Understands fluctuation.

## G44 — Caregiver memory transfer

Primary unavailable; another family member enters.  
Must understand who Mom is, current situation, history, decisions, routines.  
**Bar:** Knowledge does not live in one head.

## G45 — Unknown cause preservation

`"Mom is quieter than usual."` → store change; cause unknown; explore areas without inventing explanation.  
**Must not:** Jump to depression / worsening / meds as fact.  
**Bar:** Notices without pretending to know why.

## G46 — Change vs crisis separation

Keys misplaced vs left house and could not find way back.  
**Must not:** Constant alarms.  
**Bar:** What matters without making everything scary.

## G47 — Safety context memory

Stove left on → later wants to cook alone → safety situation updated, not independent events.  
**Bar:** Recurring safety areas connect.

## G48 — Preference / personhood memory

`"Mom hates hospitals."` remembered when hospital discussed.  
**Must not:** Only store problems.  
**Bar:** Knows the person, not only care tasks.

## G50 — Avoid caregiver blame

`"I forgot to give Mom her medication."` → missed timing language, not “adherence failed.”  
**Bar:** Helps manage care, not judge.

## G51 — Family disagreement without escalation

Sibling A needs more help · Sibling B she’s fine.  
Store both + evidence; surface different views; **never choose sides.**

## G54 — Natural language variability

`"She isn't herself"` / `"Something feels off"` = valuable observations.  
**Must not:** Require medical vocabulary.

## G55 — Question behind the question

`"Mom forgot my name today."` may carry “Is she getting worse?”  
Respond with known / changed / context — not only literal sentence.  
**Must not:** Generic reassurance or diagnosis.

## G56 — No forced tracking burden

Accept random notes/docs/threads.  
**Must not:** Daily check-ins, forms, category homework, dashboards as primary.

## G57 — Graceful long-term evolution

Years of history: summarize intelligently, preserve important evidence, reduce noise.  
**Must not:** Unreadable multi-year dump.

---

# Tier 4 — Dementia-first extended (architecture-aware)

Implement against Tier 1–3 first. Tier 4 remains acceptance law for regressions.

| ID | Focus | Must not |
|----|-------|----------|
| G31 | Behavior change without interpretation (repeated questions) | “Dementia is worsening” |
| G32 | Personhood language (Mom declined dinner) | “Dementia patient…” |
| G33 | Routine disruption (stopped watering plants) | Dismiss as unrelated |
| G35 | Same question 5× → pattern, not 5 events | Five unrelated events |
| G36 | Situation behind fact (won’t leave house) | Diagnose fear/confusion |
| G38 | Dignity language | “Failed to remember” / “behavior problem” |
| G39 | Care transition memory | Random event framing |
| G42 | “I don’t know if this is normal” as care signal | Generic reassurance |
| G49 | Caregiver role transition over time | Static caregiver |
| G52 | Historical importance (old fall ↔ new mobility) | Recent-only amnesia |
| G53 | Journey milestones | Ordinary timeline only |
| G58 | Ambiguous “acting strange” → ask what differed | Assign meaning |
| G59 | No population comparison | “Other dementia patients…” |
| G60 | Advanced care sensitivity (architecture-aware) | Medical decision engine |

---

## Sign-off (MVP coding gate)

### Must pass before spine implementation

| ID | Scenario | Pass? | Failure type (1–5) | Notes |
|----|----------|-------|--------------------|-------|
| G1–G13 | Continuity core | pass | — | G7 Clarity-faster for hard safety after linked context (`verify:dementia-entry-extended`); full Tier 1 via composer + continuity-core + return/SRE |
| G14–G19 | Architecture risk | pass | — | G14–G19 encoded; **G16** caregiver-visible perspective attribution via `perspective-attribution` (not chat feed) |
| G34 | Baseline | pass | — | Principle: person-told usual stored; change vs *their* usual (`care-epistemics`, not illustration nouns) |
| G37 | Interp vs fact | pass | — | Principle: judgment without concrete observation = experience, not fact |
| G40 | Small signals | pass | — | Principle: distinct structural care-signal families accumulate before crisis |
| G41 | Past self | pass | — | Principle: stop/loss overlapping stored identity/preference |
| G43 | Fluctuation | pass | — | Principle: clearer day after hard days = fluctuation, not disease improved |
| G44 | Memory transfer | pass | — | Same durable care key restores ACS + CRS + familiarity after cache clear (`verify:golden-dementia-baseline`) |
| G45 | Unknown cause | pass | — | Principle: change without stated cause stays unknown |
| G46 | Change vs crisis | pass | — | Principle: contained change vs elevated safety concern — not constant alarms |
| G47 | Safety context | pass | — | Principle: later note overlapping prior hazard/safety evidence |
| G48 | Preferences | pass | — | Principle: stored preference recalled by content overlap |
| G50 | No blame | pass | — | Principle: missed care timing language — manage, never judge |
| G51 | Family views | pass | — | Principle: disagreeing views held — never choose sides |
| G54 | Natural language | pass | — | Everyday language accepted; no medical vocabulary required |
| G55 | Q-behind-Q | pass | — | Continuity worry orients known/changed/context — never diagnose or empty reassure |
| G56 | No tracking burden | pass | — | Composer must not demand check-ins / forms / category homework |
| G57 | Long-term evolution | pass | — | `care-history-compression`: recent + important preserved; older noise counted not dumped; wired into return projection |
| G61 | Real caregiver test | pass | — | `real-caregiver-test` gate; emotional turn after held hard day still orients (no hide / no admin dump) |
| G31/G35 | Repeated questions | pass | — | Pattern not N events; never “dementia is worsening” (`dementia-entry-extended`) |
| G32 | Personhood language | pass | — | No “dementia patient” framing |
| G33 | Routine disruption | pass | — | Stop of usual activity held — not dismissed |
| G36 | Situation behind fact | pass | — | Hold situation; never diagnose fear/confusion |
| G38/G59 | Dignity / no population | pass | — | Composer bans |
| G39 | Care transition | pass | — | Transition framing, not random event |
| G42 | Normalcy uncertainty | pass | — | Held as care signal, not empty reassure |
| G49 | Role transition | pass | — | Caregiver responsibility shift held over time |
| G52 | Historical importance | pass | — | Prior fall/hazard ↔ later mobility linked |
| G53 | Journey milestones | pass | — | Firsts / major turns held as milestones |
| G58 | Ambiguous shift | pass | — | Ask what differed; never assign meaning |
| G60 | Advanced care | pass | — | Held with care; never medical decision engine |

**Gate:** Do not implement Response Behavior / Situation Relationship until this framework is the acceptance target. Baseline may fail today — scenarios define the destination.

---

## First implementation target (when starting A)

**Not** prompts. **Not** UI polish.

1. CareContext durability  
2. Situation Relationship Engine  
3. Care Reality State update (+ supporting_evidence / uncertainty)  
4. Living Care Record projection  
5. Caregiver response composer driven by that state  

Verifies encode **behavior principles** from these scenarios — never phrase patches.

---

## Product identity check

| Dementia tracker asks | Care Reality system asks |
|----------------------|---------------------------|
| What symptoms happened? | Who is this person, what has changed, and what does the family need to understand now? |

Feel: *A trusted memory partner that helps my family understand Mom's changing reality.*  
Never: *A system where we record dementia symptoms.*
