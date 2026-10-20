# Integration Contracts

**Honest status:** SolenOS MVP has **no live doctor/hospital/pharmacy/school integrations**. This document defines expectations for future work and safe offline behavior today.

## Principles

- Integrations must never bypass Safety / Fail-Safe / Priority Contract
- SolenOS is not a medical device router
- Offline-first continuity: analyze + local/in-memory graph must work without partners
- Webhooks inbound must be authenticated (future); never trust raw partner payloads as STATE truth without validation

## Partner surfaces

| Partner | MVP | Future expectation | Failure / offline |
|---------|-----|--------------------|-------------------|
| **Doctors / clinics** | STUB | Share care summaries with explicit user consent; read-only appointment hints | Continue without EMR; no invented meds |
| **Hospitals** | STUB | Discharge continuity events → care event ingest | Queue locally; retry with backoff |
| **Pharmacies** | STUB | Refill due signals as demands (user-confirmed) | Keyword crisis already heuristics-only |
| **Schools** (dependent care) | STUB | Schedule disruption events | Ignore if unreachable |
| **Secondary caregivers** | PARTIAL | Invite links / shared graph (needs durable auth) | In-process persons only today |
| **Push notification providers** | OUT OF SCOPE | Support-signal templates evaluated only | `evaluate` returns deliver flag; no push |

## API expectations (future)

```
POST /integrations/{partner}/events   # authenticated ingest → pending care events
POST /integrations/{partner}/webhooks # signature-verified
GET  /integrations/{partner}/health
```

Retry: exponential backoff; max attempts; dead-letter to `system_events`.  
Idempotency keys required on ingest.

## Webhook failure

- Invalid signature → 401, no STATE write
- Schema fail → 422, log only
- Downstream timeout → partner retries; SolenOS remains available for `/api/analyze`

## Offline fallback (current truth)

- All core intelligence runs without external partners
- LLM requires Gemini key (or alternate provider env) — local Ollama path exists as optional provider
- Postgres optional; memory telemetry fallback

## Do not implement without ADR + PRD

- Auto-message clinicians
- Auto-call emergency services
- Silent PHI export
- Partner write access into BELIEF as ground truth
