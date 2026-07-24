# PRD — CareLoad Engine

**Module paths:** `caregiver-load-engine`, `caregiver-load-index`, `emotional-load-signal`, `load-interpretation`, `interaction-load-signal`, `caregiver-psychological-load`, `attention-engine`  
**Implementation status:** **INTERNAL · IMPLEMENTED** (Path B analyze) · session Maps **IN-MEMORY** · Postgres persist **STUB** · ELS recovery minutes **STUB**  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Caregivers ask for tips while drowning. More information increases load. They need the system to **recognize burden first**, shrink action surface, and prioritize attention.

## User behavior

- Pastes stressed, repetitive, sleep-deprived, vigilance-heavy language
- Expects validation (“this is heavy”) before advice
- Under acute stress, must not receive multi-step care plans

## Success definition

- Five load dimensions scored (cognitive, emotional, sleep risk, uncertainty, dependency)
- Unified burnout probability with floors for acute language
- CLI bands LOW→CRITICAL with surface limits 4→1
- Load-first / containment can force max 1 action
- Attention Class A/B/C → Now / Watch / Later
- LLM classification **forbidden** for MVP signal detection

## Edge cases

| Case | Expected |
|------|----------|
| High tips demand + high load | Load-first wins; tip volume compressed |
| Emotional harm + sleep + uncertainty all present | High-signal stress → Containment Mode |
| Interaction repetition / boundary stress | Boosts CLI; sleep protection maxActions=2 |
| Low load calm input | Normal surface limits; tips allowed within product boundary |

## Failure states

- Mis-detect load from medical jargon → still must not diagnose
- Under-detect load → fail-safe / safety still gate dangerous outputs
- Persistence loss → load history does not compound across restarts

## UX expectations

- Burden messages in human language (not clinical)
- DecisionCard shrinks under CRITICAL fatigue
- Confidence tone reduces guilt when load HIGH/CRITICAL

## Constraints

- Primary unmet need = burden reduction, not more information
- Dementia entry market ≠ dementia product
- Recovery time minutes in ELS are **labeled stub** values

## Design reasoning

Deterministic regex/heuristic scoring beats LLM mood classification for safety and verifyability. Alternatives rejected: tip-first UX, medical severity as primary ranking, chatbots that expand task lists under burnout.
