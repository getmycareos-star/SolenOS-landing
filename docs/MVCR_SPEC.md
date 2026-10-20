# SolenOS — Minimum Viable Cognitive Runtime (v1)

**Event-sourced deterministic runtime with bounded LLM transforms (optional).**

## Flow

```
Input → Classification → Signal Extraction → Decision Engine
→ Response Mapping → Validation → Event Commit
```

## Principles

- Deterministic orchestration, routing, validation, replay
- LLM allowed **only** in bounded modules (signal/classification support) — validated before commit
- Events are append-only source of truth
- Memory affects weighting only — never classification

## API (v1)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/runtime/execute` | Run pipeline + commit events |
| POST | `/api/v1/sessions/create` | Create session |
| POST | `/api/v1/events/append` | Append event (audit/integration) |
| POST | `/api/v1/runtime/replay` | Replay session events |
| POST | `/api/analyze` | Legacy alias for execute |

## Schemas

Strict Zod schemas: `src/lib/schemas/`

## Verify

```bash
npm run verify:store
npm run verify:process
```
