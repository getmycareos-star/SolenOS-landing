# Database Architecture

**Doc status:** Canonical architecture  
**Module markers:** [module-status.md](./module-status.md) — runtime truth mostly **IN-MEMORY**; Postgres = telemetry + **SCHEMA-ONLY** gaps

## Two planes

| Plane | Role | Durability |
|-------|------|------------|
| Runtime STATE/BELIEF/EXPLANATION | Product truth for decisions | Mostly **in-process Maps** today |
| Postgres telemetry / evidence | Interactions, feedback, documents, events | When `DATABASE_URL` set |

## Schema

Authoritative table docs: [`../03-database/`](../03-database/). Contracts: [`../03-database/data-contracts/`](../03-database/data-contracts/).

## Rules

- DERIVED engines must not become “score tables” as authority
- Auth columns exist; app credential path does not fully use them yet
- `care_profile_state` SCHEMA-ONLY
- RLS assumes Supabase `auth.uid()`; service DB role bypasses

## Future durable architecture

Snapshot STATE/BELIEF/EXPLANATION per user/care-system; recompute DERIVED; FI assets persist beside graph — requires ADR.

## Legacy event-store prototype — not production persistence

The `src/lib/event-sourced-storage` module is an in-process Map implementation used by legacy runtime-arbitration code and verification scripts. Its event, projection, session and derived stores are cleared on process restart and have no PostgreSQL repository or durable API integration. It is **not** the authoritative care record and must not be described as a production event store.

The production caregiver application reads and writes care information through authenticated backend APIs. PostgreSQL tables such as `care_events`, `evidence`, `care_assertions`, their revision/provenance records, and the related workflow tables are authoritative. Derived views must be rebuilt from those persisted records. A module-level Map, local JSON file, or browser cache is never evidence of a successful care-record save.

Any future replacement of the prototype must use the existing backend models and Alembic chain, preserve caregiver/person authorization, and prove PostgreSQL create/read/update/history behavior across a new session and process restart before it can be called implemented.