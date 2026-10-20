# Scaling Roadmap

**Doc status:** Canonical architecture  
**Module markers:** [module-status.md](./module-status.md) — H0 = **IN-MEMORY**; durable STATE/BELIEF = **FUTURE** (requires ADR)

| Horizon | Capability | Blockers today |
|---------|------------|----------------|
| **H0 Now** | Single Node process, optional Postgres telemetry | IN-MEMORY care graph/auth |
| **H1** | Durable STATE/BELIEF/EXPLANATION + session store | Persistence ADR + migrations beyond telemetry |
| **H2** | Multi-instance Next / container | Shared store; sticky sessions insufficient |
| **H3** | Multi-caregiver auth + real RLS alignment | Production IAM; cookie/JWT; write auth columns |
| **H4** | Partner event ingest | Integration contracts; consent |
| **H5** | B2B2C caregiver risk infrastructure | Explicitly future; separate product contract |

Horizontal scaling **before** durable STATE will drop continuity (moat leak).
