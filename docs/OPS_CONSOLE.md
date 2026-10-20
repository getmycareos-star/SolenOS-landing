# SolenOS Ops Console (INTERNAL)

**Status: IMPLEMENTED** · Not user-facing · Not marketing · Not BI

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
- PostgreSQL (`pg`) — table `solen_events` + read-only production tables (`users`, `cases`, `care_events`, …)
- No Mixpanel / GA / Segment

## Layers

1. **Ingest:** `POST /api/track` → insert only  
2. **Storage:** `db/migrations/075_solen_ops_events.sql`  
3. **Client emitter:** `src/lib/trackEvent.ts` (`track()` — fail silent)  
4. **Ops dashboard:** full diagnostics + raw stream  
5. **Investor dashboard:** aggregates only — no PII / sessions / errors  

## Continuity metric filter

Every metric answers: *Is SolenOS becoming a caregiver's external memory system?*

## Netlify env

Set `OPS_SECRET`, `METRICS_SECRET`, and `DATABASE_URL`. Run migration `075` against production Postgres.

## Module

`src/lib/ops-console/`
