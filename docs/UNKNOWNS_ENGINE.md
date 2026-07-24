# Unknowns Engine + Presentation + Evidence (One Continuity System)

> Dementia is the **first clinical profile**, not the architecture.

## Unknowns Engine (`src/lib/unknowns-engine`)

Disease-agnostic reasoning:

```
Unknowns Engine
 └── Clinical profiles (dementia MVP, future: Parkinson's, stroke, …)
```

Every State of Care carries **Known / Inferred / Explicit Unknowns**.  
Clarification questions come from high-priority unknowns (max 1–2).

## Presentation (`src/lib/presentation-engine`)

Modes: `essential` | `standard` | `detailed`  
**Same CareContext.** Only density/verbosity changes. Never mutates facts, confidence, unknowns, or timelines.

## Evidence (`src/lib/evidence-preservation`)

Every conclusion → Evidence Object (event_ids, timeline, confidence, reliability, reasoning).  
Never “because AI said so.”

## Privacy + Institutional readiness (`src/lib/privacy-institutional-contracts`)

Roles and sensitivity are **metadata on CareEvents**. Institutions get projections of the same CareContext — never a forked hospital mode.

## Verify

```bash
npm run verify:unknowns-engine
```
