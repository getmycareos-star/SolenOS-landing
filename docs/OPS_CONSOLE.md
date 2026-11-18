# SolenOS Ops Console (INTERNAL)

**Status: INTERNAL DASHBOARD IMPLEMENTED; CLIENT TELEMETRY INGESTION DISABLED** · Not user-facing · Not marketing · Not BI

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
- PostgreSQL (`pg`) — table `solen_events` + read-only production tables (`users`, `cases`, `care_events`, …). Server-side event insertion exists; browser telemetry is disabled.
- No Mixpanel / GA / Segment

## Layers

1. **Server-side event insertion:** `insertSolenEvent()` writes only from trusted server code; it is not exposed as a browser HTTP endpoint.  
2. **Storage:** `db/migrations/075_solen_ops_events.sql`; persistence must be confirmed from the returned status.  
3. **Client emitter:** `src/lib/trackEvent.ts` is intentionally a no-op; there is no `/api/track` route.  
4. **Ops dashboard:** internal diagnostics and event views; empty or unavailable telemetry must remain visible as such.  
5. **Investor dashboard:** aggregates only — no PII / sessions / errors  

## Continuity metric filter

Every metric answers: *Is SolenOS becoming a caregiver's external memory system?*

## Netlify env

Set `OPS_SECRET`, `METRICS_SECRET`, and `DATABASE_URL`. Run migration `075` against production Postgres.

## Module

`src/lib/ops-console/`
