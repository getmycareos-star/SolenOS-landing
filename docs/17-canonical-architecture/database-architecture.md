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

## Event-sourced storage (IMPLEMENTED — MVP)

Four-layer model in `src/lib/event-sourced-storage` (migrations `063`–`067` accompany runtime arbitration):

| Layer | Role | Rule |
|-------|------|------|
| **Event Store** | Append-only CareEvents | Immutable; never update/delete except legal override |
| **Projection Store** | CareContext computed view | Rebuild from Event Store only; not editable truth |
| **Session Store** | Last visit / engagement | Enables Return Value Loop + first-60s detection |
| **Derived tables** | Analytics / patterns | Disposable; always rebuildable |

Invariant: all CareContext state must be reconstructable from the Event Store alone. Engines emit events/signals — they do not mutate projections directly.