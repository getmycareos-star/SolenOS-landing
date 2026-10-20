# SolenOS — Canonical Deterministic Output Contract (Final)

**HARD CONTRACT** — intelligence is design-time; runtime is fixed mapping execution only.

## System identity

> a deterministic input → structured clarity transformation engine

**NOT:** reasoning system, probabilistic model, chatbot, adaptive assistant, creative language system.

## Core failure

SolenOS **FAILS** when identical or semantically equivalent inputs produce **any meaningful output variation** — even if outputs are "better".

## Trust principle

> Consistency is more important than quality variation.

## Fixed output structure

| # | Display | Schema field |
|---|---------|--------------|
| 1 | WHAT THIS MEANS | `what_is_happening` |
| 2 | WHAT MATTERS NOW | `what_matters_now` |
| 3 | WHAT TO ASK NEXT | `what_to_ask_next` |
| 4 | RISK LEVEL | `risk_level` |
| 5 | WHAT CAN WAIT | `what_can_wait` |

Plus `follow_up_items` and `_meta` — fixed order, no extra keys.

## Risk level

`low | medium | high | unknown` — urgency signal only.

## Mandatory validation (section 11)

| Check | Failure type |
|-------|--------------|
| Repeated input test | `CONSISTENCY_FAILURE` |
| Structure drift check | `STRUCTURE_DRIFT_DETECTED` |
| Priority stability check | `PRIORITY_DRIFT_DETECTED` |
| Interpretation stability check | `INTERPRETATION_DRIFT_DETECTED` |

## Verify

```bash
npm run verify:deterministic-output
npm run verify:consistency-determinism
```

## One-line truth

> SolenOS is a deterministic input-to-structure mapping system with strict output schema enforcement, zero runtime interpretive variation, and fully locked prioritization logic.
