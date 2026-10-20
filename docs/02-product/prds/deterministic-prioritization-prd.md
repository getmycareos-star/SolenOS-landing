# PRD — Deterministic Prioritization Engine

**Module path:** `src/lib/deterministic-prioritization`  
**Implementation status:** **INTERNAL · IMPLEMENTED** (Path B analyze — 6-field Decision Snapshot overlay; not composer Clarity) · verify: `npm run verify:deterministic-prioritization`  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Caregivers dump mixed safety, health, and household chaos. They need: “I know what matters and why” — reduction over expansion. Not a chatbot, journal, reminder list, or three-column task board.

## Success definition

- Issues extracted internally as `{ title, context }`
- HIGH_IMPACT signal for pain / health deterioration / immediate safety / active harm
- Deterministic score: `safety*3 + time*2 + cost*2 + reversibility*1 + relief*1`
- Internal buckets only: top 20% DO_FIRST, middle 50% SAFE_TO_DELAY, bottom 30%/uncertain WATCH_CLOSELY
- Every issue has `explanation: { whyHere, whyNotHigher, whyNotLower }` or engine invalid
- Public compress = **exactly** six fields:
  - `what_is_happening`, `what_matters_now`, `what_to_ask_next`, `risk_level`, `what_can_wait`, `follow_up_items`
- `what_matters_now` ≤ 3 actions; no DO_FIRST strings in public text
- Authority: risk signals + prioritization only — user is final decision maker

## Pipeline

After Priority Engine facade → Deterministic Prioritization → overlays Decision Snapshot → PRP/Trust assembly uses compressed text for SolenOS semantic fields.

Debug payload: `deterministic_priority_layer` (scores + explanations + snapshot). Never merge internal buckets into primary SolenOS 5-field `result`.

## Edge cases

| Case | Expected |
|------|----------|
| Electrical hazard + dental + laundry + repaint | Hazard/dental above laundry/repaint; HIGH_IMPACT sorts first |
| Uncertain / thin text | WATCH_CLOSELY bucket internally; clarifying ask in `what_to_ask_next` |
| No HIGH_IMPACT | `risk_level` from max score bands |

## Anti-patterns

- Chatbot / notes / reminders / care-tracker UI
- Exposing DO FIRST cards as RESULT
- Extra public JSON fields beyond the six
- Claiming medical/finance/legal authority

## Related

- ADR-014, ADR-003, Case Memory Decision Snapshot (ADR-012)
- Docs: `docs/06-careload-engine/deterministic-prioritization.md`
