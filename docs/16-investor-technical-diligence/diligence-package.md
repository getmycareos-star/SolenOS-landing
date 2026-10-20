# Investor Technical Diligence Package

## 1. Architecture

- Situation-centric continuous intelligence system
- Layers: STATE / BELIEF / EXPLANATION + DERIVED pure engines
- Orchestration: `analyze-pipeline` with documented order in `architecture-map.ts`
- Strategic facade: `family-intelligence` (5 assets)
- Detail: [`17-canonical-architecture`](../17-canonical-architecture/)

## 2. Data flywheel

```
Caregiver input → structured STATE/BELIEF → decisions (WHY)
  → load/crisis/confidence/delegation signals
  → feedback/relief telemetry
  → family intelligence compounding (intended)
```

**Today:** heuristics + in-process compounding + optional Postgres evidence ledger.  
**Not today:** model fine-tuning from feedback; durable multi-year graph.

See `02-product/system-learning-metrics.md`.

## 3. Moat

See [moat-defensibility.md](./moat-defensibility.md). Primary asset: accumulated family responsibility intelligence.

## 4. Scaling roadmap

| Stage | Requirement |
|-------|-------------|
| Single-node MVP | Current — Next.js + optional Postgres |
| Multi-instance | Shared durable STATE/session store (missing) |
| Multi-caregiver | Real auth + RLS that matches app identity |
| Partner ingest | Integration contracts in `11-api-reference/integrations` |
| B2B2C risk infra | Documented future only — not built |

## 5. AI behavior model

- Deterministic ranking & load & crisis & confidence
- LLM for cognitive compression JSON only (Gemini, T=0)
- Tone: no panic amplification; load-first; safety terminal
- Spec: `10-ai-systems/ai-behavior-specification.md`

## 6. Security model

- Output safety gates + fail-safe + containment
- Postgres RLS defense-in-depth (Supabase pattern); app service role bypasses
- Auth stub; not production IAM
- Spec: `12-security/`

## 7. Risks (diligence honesty)

| Risk | Mitigation path |
|------|-----------------|
| Persistence gap erodes moat | Durable graph ADR |
| Heuristic crisis misses | Safety + Priority; improve tests |
| Regulatory if over-medicalized | Explicit anti-patterns + verify |
| LLM vendor dependency | Narrow LLM role; Ollama optional |

## Evaluation question (internal)

> Does this increase SolenOS' understanding of the family responsibility system over time?
