# SolenOS — Storage & Persistence Engine (v1)

**Event-sourced cognitive decision runtime.**

## Guarantees

- Every decision is reconstructable
- Every state is replayable
- Every output is traceable
- No hidden state exposed to clients
- No cross-session memory leakage

## Store model

```typescript
SolenOSStore = {
  users, sessions, events, signals, decisions,
  memory, snapshots, causal_links, trust_state
}
```

Implementation: `src/lib/store/`

## Truth layer

**Events are append-only and immutable.** All other artifacts are derived.

Event types: `input_received`, `classification_completed`, `signal_extracted`, `decision_generated`, `risk_assessed`, `safe_mode_triggered`, `user_override`

## API integration

```
POST /api/analyze
{ "input": "...", "session_id": "...", "user_id": "..." }

→ { output, session_id, user_id, event_offset, analyzedAt }
```

Clients hold `session_id` only — not internal store state.

## Replay

```typescript
replaySession(store, sessionId) // deterministic from events + memory
```

## Memory rule

Memory items are **session-scoped**. They affect decision weighting only — never classification or signal extraction.

## Verify

```bash
npm run verify:store
```
