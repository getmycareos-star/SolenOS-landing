# UX Logic Spec — Decision Surface

**Status:** IMPLEMENTED (logic).  
**UI (primary):** B&W four-state cognitive workspace — `src/components/mvp-workspace` + `src/app/page.tsx` (ADR-016).  
**UI (runtime adapters):** `src/lib/ui-runtime` + `src/components/ui-runtime` (sidebar / situation continuity).  
**Principle:** Logic over pixels for ranking; layout follows ADR-016 (calm B&W split workspace, not chat).

## Frontend flow (MVP landing)

```
REAL_MOMENT (text notes + document upload / camera)
  → extract docs via POST /api/extract (when attached)
  → POST /api/situation (primary Care Record path) and/or POST /api/analyze
CARRYING (reflection of load — not advice)
  → CLARITY (Matters now / Can wait / May become serious)
  → CONTINUITY (recorded + deferred + rest)
  → New entry → REAL_MOMENT
```

Render envelope: `what_is_happening`, `what_matters_now`, `what_to_ask_next`, `risk_level`, `what_can_wait`, `follow_up_items`, `watch_for` (derived when omitted).

Accessibility float (`Aa`): theme inversion (black↔white panels), Serif/Sans, Standard/Large/XL — apply instantly, persist in `localStorage`.

### Capture / OCR notes

| Path | Status |
|------|--------|
| Text / paste → `POST /api/situation` (+ analyze) | IMPLEMENTED (live, no mocks) |
| Image/PDF / camera → `POST /api/extract` (Tika + Tesseract) | IMPLEMENTED best-effort |
| Voice mic / Whisper / TTS / Hear SolenOS | FUTURE (ADR-018) — libraries unmounted |
| PaddleOCR self-host | FUTURE — not wired; Tesseract stands in for images |

Failed extraction still lists the attachment; only ready text is concatenated into the understanding input. MVP accepts messy incomplete input — no perfect structure required.

## Job of the decision surface

Answer: **“What should I do now?”** with clarity sections on the CLARITY panel (still one primary trajectory from `decision-mapper` / SolenOS fields), never a tip dump or chat thread.

## Generation path

```
Input → Load engines → Attention (Now/Watch/Later)
  → STATE/BELIEF → Responsibility Graph → CLI → ELS
  → Priority Contract (deterministic ranking)
  → LLM structured clarity JSON (5 fields only)
  → Fail-Safe → Crisis → Confidence → Delegation
  → Human Trust explanation → Safety enforcement
  → DecisionCard / sidebar adapters
```

Canonical order: `V14_PIPELINE_ACTUAL_ORDER` in `architecture-map.ts`.

## Urgency

| Source | Role |
|--------|------|
| Priority Contract | Situation ranking: risk×severity, time curves, uncertainty, dependency, completion — **not** LLM preference |
| Attention Engine | Class A/B/C → Now / Watch / Later after load scoring |
| CRITICAL × NOW | Hard override — always top (`priority-contract`) |
| Fail-Safe | Forces clarify-before-action under high uncertainty / unresolved conflict |
| Safety Enforcement | Terminal gate — **SAFETY ALWAYS WINS** |

## Recommendation ranking

1. Priority Contract scores situations (pure DERIVED function).
2. Emotional load / CLI adjust surface limits (`topN` / fatigue surface: 4→1 as load rises).
3. Containment / high-signal stress may force **max 1 action**.
4. LLM fills the MVP clarity envelope; it does **not** replace Priority Contract ranking.
5. Crisis risks may appear as predictive warnings without reordering CRITICAL×NOW ownership.

## Confidence message construction

Produced by `computeConfidenceState` (DERIVED), surfaced via confidence layer payload:

- Score 0–100 with plain-English explanation templates.
- Fail-safe engaged → reassurance that **clarifying is correct**, not failure.
- Heavy load → reduce guilt; focus harm reduction.
- Never replaces priority list wording as authority.

## UX expectations

- **One** primary next action when load-first / acute / containment.
- No panic amplification (tone rules → `10-ai-systems/ai-behavior-specification.md`).
- Timeline shows WHAT; Decision History shows WHY.
- Delegation suggestions only when CLI is HIGH/CRITICAL and are **suggest-only**.

## Failure / empty states

| Condition | Surface behavior |
|-----------|------------------|
| Pipeline validation fail | HTTP 422; no inventing urgency |
| Missing GEMINI_API_KEY | HTTP 503 on analyze |
| Fail-safe engaged | Clarify prompts; capped confidence |
| No situation | Soft empty — system has no STATE root |

## Related code

- `src/lib/ui-runtime/decision-mapper.ts`
- `src/lib/solenos-layers/derived/priority-contract.ts`
- `src/lib/attention-engine/`
- `src/lib/human-trust-layer/`
