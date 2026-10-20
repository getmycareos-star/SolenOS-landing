# Deterministic Prioritization Engine

**Path:** `src/lib/deterministic-prioritization`  
**Status:** IMPLEMENTED (heuristic MVP)  
**ADR:** [ADR-014](../15-architecture-decisions/ADR-014-deterministic-prioritization-fixed-schema.md)  
**PRD:** [deterministic-prioritization-prd.md](../02-product/prds/deterministic-prioritization-prd.md)

## Identity

SolenOS cognitive compression: caregiver chaos → minimal, explainable decision summary via fixed schema. Product is **SolenOS** only.

## Formula (NON-NEGOTIABLE)

```
priorityScore = safety*3 + time*2 + cost*2 + reversibility*1 + relief*1
```

Dimensions ∈ {0,1,2,3}. Max score = 27.

Score *inputs* may be heuristic (MVP) or LLM-assisted later; formula and ranking sort stay deterministic.

## Pipeline steps

1. **Extract issues** — atomic `{ title, context }`, no ranking  
2. **Human impact** — pain / deterioration / safety / harm → `prioritySignal = HIGH_IMPACT`  
3. **Score + classify** — formula; internal DO_FIRST (top 20%) / SAFE_TO_DELAY (middle 50%) / WATCH_CLOSELY (bottom 30% or uncertain)  
4. **Explain** — `whyHere`, `whyNotHigher`, `whyNotLower` required or throw  
5. **Rank** — HIGH_IMPACT first, then score desc  
6. **Compress** — exactly six public fields (trust via why-direction in text, not extra keys)

## Public schema

```json
{
  "what_is_happening": "string",
  "what_matters_now": "string",
  "what_to_ask_next": "string",
  "risk_level": "low | medium | high",
  "what_can_wait": "string",
  "follow_up_items": ["string"]
}
```

Internal buckets never appear in public JSON or RESULT UI.

## vs Priority Contract / Attention Engine

| Engine | Role |
|--------|------|
| Priority Contract | Situation ranking (CRITICAL×NOW) |
| Priority Engine facade | Multi-signal action vectors |
| Attention Engine | Now / Watch / Later from load classes |
| **Deterministic Prioritization** | Issue ranking + Decision Snapshot compression |

## Analyze wiring

`processDeterministicPrioritization` runs after Priority Engine; on guarantee pass, overlays `case_memory_layer.decision_snapshot`. Payload: `deterministic_priority_layer`.

## Verify

```bash
npm run verify:deterministic-prioritization
```
