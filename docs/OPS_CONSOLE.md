# SolenOS Ops Console (INTERNAL)

**Status: PARTIAL · DURABLE TELEMETRY PERSISTENCE UNVERIFIED** · Internal only · Not user-facing · Not marketing · Not BI

Product-learning and system-health console for founders, engineering, and authorized investors.

## Routes

| Route | Audience | Secret |
|-------|----------|--------|
| `/ops?key=OPS_SECRET` | Founders / eng / product | `OPS_SECRET` (≥32 chars) |
| `/metrics?key=METRICS_SECRET` | Investors / advisors | `METRICS_SECRET` (≥32 chars) |

Invalid key → **404**. Both excluded via `public/robots.txt`.

Production domain: https://solenosai.netlify.app

## Stack

- Next.js App Router
- PostgreSQL (`pg`) — server-side code attempts writes to `solen_events`, provisioned by `db/migrations/075_solen_ops_events.sql`. If the database is unavailable or the table is missing, the writer falls back to process memory and explicitly reports `memory_only`; durable production ingestion remains unverified until the migration is applied and a database-backed write is confirmed.
- No Mixpanel / GA / Segment

## Layers

1. **Server-side event insertion:** `insertSolenEvent()` writes only from trusted server code; it is not exposed as a browser HTTP endpoint.  
2. **Storage:** `db/migrations/075_solen_ops_events.sql`; persistence must be confirmed from the returned status.  
3. **Client emitter:** `src/lib/trackEvent.ts` is intentionally a no-op; there is no `/api/track` route.  
4. **Ops dashboard:** internal diagnostics and event views; empty or unavailable telemetry must remain visible as such.  
5. **Investor dashboard:** aggregates only — no PII / sessions / errors  

## Continuity metric filter

Every metric answers: *Is SolenOS becoming a caregiver's external memory system?*

## Runtime requirements and limitation

`OPS_SECRET` and `METRICS_SECRET` protect the internal pages. `DATABASE_URL` is required for database-backed reads and writes. The migration `db/migrations/075_solen_ops_events.sql` is present in this repository, but this code change does not prove it has been applied to any target database. Treat events as durable only when `insertSolenEvent()` returns `server_persisted`; `memory_only` is not durable. Browser telemetry remains disabled.

## Module

`src/lib/ops-console/`
