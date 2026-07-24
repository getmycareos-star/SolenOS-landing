# Failure Mode & Safety Spec

## Incorrect predictions

| Failure | Detection | Safe degradation |
|---------|-----------|------------------|
| Wrong Priority ranking | Human sense-check; future override | Trust layer “challenge”; override STUB today |
| LLM hallucinated details | Zod + grounding contracts | Prefer uncertainty questions |
| Load under/over detect | Heuristic limits | Action limits + fail-safe still apply |

## False positives (crisis / load)

- Always require explanation on crisis emit
- Tone: sober predictive language (AI behavior spec)
- No auto external escalation
- User may ignore suggestions; must not loop panic

## Missed crises

- CRITICAL×NOW and Safety still operate on present STATE
- Keyword miss → demand may not categorize — accept heuristic limit; improve via ADR + tests
- Do not claim “guaranteed prevention”

## Escalation ladder

1. In-UI clarify / single action  
2. Crisis notice in payload  
3. Support-signal evaluate (template; no push guarantee)  
4. **FUTURE** consented caregiver notify / clinician share  
5. **Never automatic emergency dispatch without ADR + legal review**

## User override

| Capability | Status |
|------------|--------|
| Dismiss priority / override assumption / mark wrong reasoning API | **STUB** — intent log only |
| Undo labels in trust layer | Explanatory, not guaranteed STATE rollback |
| Governance settings request override | Possible per-request; treat carefully |

## Safe degradation principles

- Prefer fewer actions over more when uncertain or overloaded  
- Prefer questions over invented certainty  
- Prefer failing closed on medical claims  
- Prefer analyze availability even if telemetry/family-intelligence persistence fails (non-blocking facades)

## Related verify

`verify:safety-enforcement`, `verify:fail-safe-mode`, `verify:medical-boundary`, `verify:epistemic-safety`
