# AI Behavior Specification

**Status:** Governing rules for all modules. If implementation diverges, **this doc + ADRs win** — fix code.

## Deterministic prioritization (non-negotiable)

1. **Safety Enforcement** — terminal; SAFETY ALWAYS WINS  
2. **Fail-Safe** — pause / clarify under uncertainty & unresolved conflict  
3. **Priority Contract** — deterministic situation ranking (CRITICAL×NOW override)  
4. **Deterministic Prioritization Engine** — issue extract → fixed score formula → compress to 6-field Decision Snapshot (never expose DO_FIRST buckets publicly; ADR-014)  
5. **Attention / Load surface limits** — shrink action count under load  
6. **LLM clarity fields** — explain and compress; do not re-rank against (1–5)  
7. **Crisis / Confidence / Delegation** — advisory layers after decision assembly order in pipeline

## Output prioritization for the user

1. Immediate safety / clarify-before-action if engaged  
2. Single Now action (DecisionCard)  
3. Confidence reassurance without denying open HIGH risks  
4. Crisis predictive notices (sober)  
5. Delegation suggestions only if load HIGH/CRITICAL  

## Uncertainty handling

- Uncertainty is first-class BELIEF (`missing_information`, confidence 0–1)
- High missing-info confidence cap (`HIGH_MISSING_INFO_CONFIDENCE_CAP = 0.55` pattern)
- Prefer questions (`what_to_ask_next`) over invented facts
- Calibrated uncertainty contracts in legacy docs still apply

## Explanation generation

- Human Trust: understand / challenge / undo templates
- Confidence & crisis: plain English factories
- Decision History = WHY; Timeline = WHAT
- No free-form LLM “therapy” when containment engaged

## Tone rules

| Required | Forbidden |
|----------|-----------|
| Calm, specific, load-aware | Panic amplification |
| Guilt reduction under HIGH load | Shame for clarifying |
| Predictive sobriety | Over-warning spam / alarmism |
| Boundary: not a doctor | Diagnosis, disease timelines |
| Short action surface under containment | Tip lists / care-plan dumps |

## Safety thresholds (summary)

- Fail-safe triggers: HIGH_UNCERTAINTY, HIGH_RISK_LOW_CONFIDENCE, UNRESOLVED_CONFLICT  
- Containment: acute triad → max 1 action  
- Crisis emit floors ~0.2–0.25 depending on category  
- CLI CRITICAL surface limit 1  

Exact numbers live in module `contract-constants.ts` — keep docs synchronized when changing.

## Failure behavior

- Degrade to clarify / safer minimal output  
- Never fabricate ownership or medical certainty  
- Telemetry/feedback failures must not crash analyze when non-critical  
- Stub human override must not pretend STATE changed  

## Consistency across modules

All engines share Situation-centric STATE, unified BELIEF items, and DERIVED purity. Facades may rename strategically (Family Intelligence) but must bridge existing modules — not fork truth.
