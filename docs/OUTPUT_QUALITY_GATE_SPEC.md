# Output Quality Gate — MVP Spec

## Role

Post-LLM **cognitive validity** layer — deterministic readability enforcement under stress.

Sits **after Zod** (structural gate). Does **not** modify output — invalid → regenerate.

## Two-layer validation

| Layer | Module | On failure |
|-------|--------|------------|
| A. Structural | `response-validator` (Zod) | Retry Gemini |
| B. Cognitive | `output-quality-gate` | Retry Gemini |

## Cognitive gates

1. **Single-idea sentences** — no compound actions in one sentence  
2. **No interpretation burden** — no ambiguity phrases (`maybe`, `might`, …)  
3. **Action clarity** — explicit action verb OR `No immediate action required.`  
4. **Jargon elimination** — medical terms need `Term (simple explanation)`  
5. **No explanatory essays** — compressed operational fields only  
6. **Emotion isolated** — emotion must not drive `risk_level` / `what_matters_now`  
7. **Risk determinism** — `risk_level` aligns with urgency signals only  
8. **Field boundaries** — no overlap; `what_to_ask_next` ends with `?`

## Pipeline

```
Gemini → JSON.parse → Zod → Output Quality Gate → Response
```

## Module

`src/lib/output-quality-gate/`

## Verify

```bash
npm run verify:output-quality
npm run verify:analyze
```
