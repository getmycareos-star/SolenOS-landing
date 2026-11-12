# Telemetry Persistence Contract

This document governs the **separate interaction telemetry subsystem only**. It is not the application-wide PostgreSQL contract and does not define the SolenOS product identity or Living Care Record schema.

## Product identity boundary

SolenOS is the **Living Care Record (LCR) for family caregivers**. The backend care-domain PostgreSQL schema is authoritative for identity-scoped care records and longitudinal history. This telemetry subsystem measures interaction quality and feedback; it is not a source of care facts.

## Telemetry database role (strictly limited)

**IS:** interaction telemetry, feedback, and bounded grounding data for the analyze capability.

**NOT:** the authoritative Living Care Record, care journey tracking, accepted care facts, behavioral profiling, or personalization.

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

- **Frontend:** this analyze capability is a constrained input → output experience; it does not define the wider LCR workspace.
- **Backend:** `/api/analyze` returns a bounded structured response; telemetry writes are non-blocking.
- **Model:** this endpoint uses a fixed response schema; it cannot promote or mutate care-record state.
- **Database:** telemetry measurement only — authoritative care records are stored through backend care-domain workflows.

## Migration

```bash
psql $DATABASE_URL -f db/migrations/001_telemetry_schema.sql
```

Set `DATABASE_URL` in `.env.local`. Without it, an in-memory telemetry store is used for dev (same schema shape, not a product feature).

## Final truth

> SolenOS is the Living Care Record — durable care reality understanding. Telemetry Postgres measures whether structured outputs reduce cognitive load; it is not the product identity and must not become a user CRM or engagement warehouse. Care continuity state lives in the Living Care Record spine, not in telemetry tables.
