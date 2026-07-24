# Telemetry Persistence Contract

Postgres is **only** a measurement + validation layer for cognitive relief reliability — not a product surface.

## System identity

SolenOS is a **stateless deterministic cognitive decompression engine** with minimal telemetry used ONLY to validate that structured clarity reliably reduces cognitive overload.

## Postgres role (strictly limited)

**IS:** telemetry + validation store for system performance

**NOT:** user modeling, behavioral profiling, memory, care journey tracking, personalization

## Tables (only allowed)

### `users`
Required: `id`, `created_at`, `last_seen_at`, `total_sessions`  
Optional: `trust_score` (derived metric only)  
Forbidden: name, email, phone, demographics, medical data, care relationships, behavioral profiles

### `interactions`
One row = one cognitive relief event (NOT a session or conversation).  
Required: `user_id`, `input_raw`, `output_structured`, `risk_level`, `relief_signal`, `latency_ms`, `structure_valid`

### `feedback`
Trust signal only — did clarity reduce cognitive overload?  
Required: `user_id`, `helpful_yes_no`, `reduced_confusion_yes_no`

## Architecture consequences

- **Frontend:** stateless input → output; no dashboards, history, or timeline UX
- **Backend:** `/api/analyze` remains deterministic; telemetry writes are non-blocking
- **Model:** fixed 6-field schema; no user adaptation or memory influence
- **Database:** measurement only — drift prevention enforced in `src/lib/telemetry-persistence/`

## Migration

```bash
psql $DATABASE_URL -f db/migrations/001_telemetry_schema.sql
```

Set `DATABASE_URL` in `.env.local`. Without it, an in-memory telemetry store is used for dev (same schema shape, not a product feature).

## Final truth

> SolenOS is the Living Care Record — durable care reality understanding. Telemetry Postgres measures whether structured outputs reduce cognitive load; it is not the product identity and must not become a user CRM or engagement warehouse. Care continuity state lives in the Living Care Record spine, not in telemetry tables.
