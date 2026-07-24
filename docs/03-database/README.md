# 03 — Database

**Migrations:** `db/migrations/*.sql` (001–013; sequential with documented purpose).  
**Runtime:** `DATABASE_URL` → `PostgresTelemetryStore`; else `MemoryTelemetryStore`.

## Product stance

Postgres is an **evidence / telemetry ledger**, not caregiver memory of record and not a profiling warehouse.  

**Living Care Record spine (CareContext + Active Care Situation)** is durable under `.data/care-context/` and `.data/active-care-situation/` (filesystem JSON, same pattern as consent). Process Maps are cache only — a server bounce must not empty the caregiver’s record. Analyze / telemetry STATE stores remain primarily IN-MEMORY unless `DATABASE_URL` is set. Observation capture runtime is **IN-MEMORY** with SCHEMA in migration 013. See [data-contracts/](./data-contracts/).

## Tables (after all migrations)

### `users`
| Column | Notes |
|--------|-------|
| `id` UUID PK | `gen_random_uuid()` |
| `created_at`, `last_seen_at` | |
| `total_sessions` | ≥ 0 |
| `trust_score` | DEPRECATED (do not use for product) |
| `email`, `password_hash`, `auth_enabled` | SCHEMA for optional auth — **app signup does not write these today** |
| `language_preference`, `ui_language`, `voice_language` | Multilingual (010) — exact 10 codes; drives Gemini + **all TTS** |
| `tts_voice_profile` | `female` \| `male` (013) — Polly/Google voice preference |
| `governance_settings` JSONB | Settings governance (011) |
| `care_profile_state` JSONB | SCHEMA-ONLY (012) — unused in TS path |

**`language_preference` CHECK (010):** `'en','es','zh','tl','vi','ko','fa','ar','ru','hy'` — never silently expand.

**RLS:** `users_self_isolation` (`id = auth.uid()`)  
**Index:** unique email where not null

### `interactions`
Telemetry of analyze exchanges: `input_raw`, `output_structured`, latency, validity flags, `risk_level`, relief fields, care_context_state, depletion signals, etc.  
**RLS:** user isolation. **Indexes:** `user_id`, `created_at`.

### `feedback`
Relief feedback rows; optional `interaction_id` FK. **RLS:** user isolation.

### `documents`
User document extract ledger (`file_url`, `extracted_text`, `structured_output`). **RLS:** user isolation.

### `knowledge_base`
System grounding chunks + `embedding vector(1536)`. **No RLS** (system-scoped).

### `policy_facts`
Safety/policy facts `(category, key)` unique. **No RLS**.

### `support_signal_events`
Delivery/suppress telemetry. **RLS:** user isolation.

### `cases` / `system_events`
Architecture foundation events. **No RLS** (append-oriented; privileged backend).

### `observations` / `structured_observations` (013 — SCHEMA)
| Table | Columns | Notes |
|-------|---------|-------|
| `observations` | `id`, `caregiver_id`, `transcript`, `raw_text`, `source_type`, `source`, `created_at` | Voice\|text identical shape. Runtime MVP: IN-MEMORY store |
| `structured_observations` | `id`, `observation_id`, `category`, `severity`, `extracted_signal`, `signal`, `created_at` | Multi-signal per observation. Never diagnoses |

## Migrations map

| File | Purpose |
|------|---------|
| 001 | users, interactions, feedback core |
| 002 | relief validation columns |
| 003 | semantic_valid |
| 004 | risk_level CHECK expansion |
| 005 | evidence contract, auth columns, documents, kb, policy_facts, RLS |
| 006 | care_context_state |
| 007 | caregiver depletion signals |
| 008 | support_signal_events + RLS |
| 009 | cases, system_events |
| 010 | multilingual columns (`language_preference` + 10-code CHECK) |
| 011 | governance_settings |
| 012 | care_profile_state JSONB |
| 013 | `tts_voice_profile` + observations / structured_observations SCHEMA |

## RLS security note

Policies assume Supabase `auth.uid()`. App `DATABASE_URL` typically uses a **service role that bypasses RLS**. Treat RLS as defense-in-depth for direct Supabase client access — **not** the Next.js API authorization model. See `12-security`.

## How future engineers modify safely

1. Add a new numbered migration (never edit applied SQL silently).
2. Update `03-database` + data contracts + `postgres-contract` verify if needed.
3. Do not store medical diagnoses, free-text psych profiles as first-class columns without ADR.
4. Prefer JSONB extension columns only with lifecycle docs.
5. Do not add/remove/rename the 10 language codes without ADR.
