# Care Reality Intelligence

**Category (not product rename):** Care Reality Intelligence  
**Product:** SolenOS  
**Foundation:** The Living Care Record  

SolenOS maintains an evolving understanding of a person's changing care reality — not notes, tasks, chat, or document storage.

## Thesis

> Documents are the doorway. The Living Care Record is the product. SolenOS is the evolving intelligence layer that maintains it.

Other products organize information. SolenOS creates **understanding**.

## Intelligence chain (engine spine)

Every insight should traverse:

```
Events → Changes → Decisions → Outcomes → Context → Confidence
```

| Stage | Question |
|-------|----------|
| Events | What happened? |
| Changes | What is different from before? |
| Decisions | What was decided, by whom, why? |
| Outcomes | What happened afterward? |
| Context | Why does this matter for this person? |
| Confidence | How certain are we — and what is missing? |

## Six core capabilities (composition, not separate apps)

1. **Living Care Record** — events, decisions, outcomes, observations, uncertainty, patterns  
2. **Care State Understanding** — current state of care, not document inventory  
3. **Moment-of-Need Guidance** — clarity when something is happening (`moment-of-need-engine`)  
4. **Person-Specific Understanding** — baseline + profile vs generic condition knowledge  
5. **Decision Memory** — what, when, who, context, evidence, alternatives, reason, outcome, status (`src/lib/decision-memory`) — value is *why* the path existed; unknowns first-class; preparation not advice  
6. **Human Context** — family dynamics, routines, what helps — not diagnosis  

**Decision Memory honesty:** IMPLEMENTED for G13 record questions + outcome linking via ACS ingest. Not a recommendation engine. 

## Comparison engine

**Ask:** Is this different for this person?  
**Reject:** Is this common in dementia?

Module: `src/lib/baseline-intelligence-engine` + `src/lib/care-reality-profile-engine`

## Facade module

`src/lib/care-reality-intelligence` composes existing engines — **no duplicate logic, no new pillar**.

Wired in `situation-entry/pipeline.ts` after `continuity_properties_layer`.

## Trust architecture

Build an **evidence engine**, not a guessing engine.

- Conservative understanding over confident guessing  
- Evidence before interpretation  
- Context before classification  
- Never escalate beyond evidence  
- Preserve original input; never overwrite source material  
- Surface uncertainty — it is valuable information  

See also: `src/lib/evidence-preservation`, `src/lib/continuity-properties`, `src/lib/forbidden-build-zone`

## Do not build

- Symptom checker / dementia FAQ / generic health chatbot  
- Medical recommendation engine  
- Document vault, task manager, reminder app, or family chat as **primary identity**  
- Dashboard-first UI before spine exists  

## Future (not MVP UI)

- **Care Transition Mode** — temporary continuity brief after major transitions  
- **Care Communication Translation** — meaning translation across family/clinical voices  

Signals: `care_transition_signals` table (migration `074`) — mode is `FUTURE`.

## Persistence

| Migration | Purpose |
|-----------|---------|
| `074_care_reality_intelligence.sql` | `care_loop_outcomes`, `care_transition_signals`, `care_reality_intelligence_snapshots` |

Runtime engines remain primarily in-memory; Postgres holds snapshots/telemetry.

## Verify

```bash
npm run verify:care-reality-intelligence
```

## Architecture map

`CARE_REALITY_INTELLIGENCE` in `src/lib/solenos-layers/architecture-map.ts` (`notANewPillar: true`).
