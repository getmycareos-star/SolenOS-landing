# Validation Layer — Zod Hard Gate v1

## Role

`response-validator` is a **strict schema enforcement gate** between LLM/pipeline output and UI rendering.

It is **not** a transformer, formatter, fixer, recovery system, or semantic normalizer.

## Pipeline position

```
LLM / Decision Engine Output
        ↓
VALIDATION LAYER (response-validator)
        ↓
UI Render
```

## Module

`src/lib/response-validator/index.ts`

- `SolenOSResponseSchema` — six required fields, `.strict()`, no coercion
- `validateAIResponse(output: unknown)` — returns valid object or throws `ValidationError`
- `gateForUI(output)` — orchestration helper: extract six fields → validate

## Error contract

```typescript
type ValidationError = {
  type: "INVALID_SCHEMA";
  message: string;
  raw_output: unknown;
};
```

Thrown immediately. Handled by orchestration (API routes). Never consumed inside the validator.

## Forbidden behavior

- No auto-fix, defaults, partial acceptance, coercion, or retry logic
- **INVALID OUTPUT = REJECT ONLY**

## UI payload shape

| Field | Type |
|-------|------|
| `what_is_happening` | string |
| `what_matters_now` | string |
| `what_to_ask_next` | string |
| `risk_level` | `"low" \| "medium" \| "high"` |
| `what_can_wait` | string |
| `follow_up_items` | string[] |

`decision_trace` and other metadata live **outside** this gate (API metadata, event store).

## Verify

```bash
npm run verify:validator
```
