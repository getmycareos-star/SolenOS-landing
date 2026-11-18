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
- PostgreSQL (`pg`) — server-side code can attempt writes to `solen_events`; the current repositories do not contain a migration that provisions this table. The writer falls back to process memory if the table is unavailable; durable production ingestion is therefore unverified.
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

`OPS_SECRET` and `METRICS_SECRET` protect the internal pages. `DATABASE_URL` is required for database-backed reads. The current repositories do not include the historical migration `075_solen_ops_events.sql`; do not assume `solen_events` exists or that event writes are durable. Browser telemetry remains disabled.

## Module

`src/lib/ops-console/`
