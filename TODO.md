# Phase 6 — Summarizer/Compression Isolation (DARE-B-Gone)

## Completed Analysis

### Architecture boundaries verified

The caregiver response pipeline is correctly isolated from the /api/analyze ops/engine compressor (DecisionSnapshot). Key findings:

| Path | Produces 6-field shape? | Feeds caregiver? | Acceptable? |
|------|------------------------|------------------|-------------|
| `deterministic-prioritization/compress-to-decision-snapshot.ts` | Yes | No — analyze-pipeline only | ✅ Correct |
| `caregiver-response-composer/project-to-response-contract.ts` | Yes | Yes — via `contract_output` | ✅ Correct (source: CareSituationUnderstanding) |
| `case-memory/shape-output.ts` (shapeSolenOSFromDecisionSnapshot) | Yes | No — analyze-pipeline only | ✅ Correct |
| `situation-entry/pipeline.ts` | No | N/A | ✅ No compression |
| `response-intelligence/index.ts` (buildResponseIntelligenceOutput) | Falls back when no projection | Compose-time fallback | ⚠️ Prefers projection |

### What was confirmed

1. **`compressToDecisionSnapshot` is OPS/ENGINE ONLY** — its output feeds Case Memory + Human Trust layers, never the caregiver panel.
2. **`projectCareSituationToResponseContract` is the PRIMARY projection** — the caregiver composer correctly uses this as its primary source.
3. **`shapeSolenOSFromDecisionSnapshot` only runs in /api/analyze** — not in the caregiver response pipeline.
4. **Response Contract projection includes `assertProjectionGrounded`** — strict validation gate.

### Key Principle Confirmed

> Compression is not understanding.
> 
> DARE/DecisionSnapshot keyword-score compression produces the same 6-field JSON shape as the caregiver-facing Response Contract, but it does NOT understand the care situation. The caregiver response must come from structured understanding (CareSituationUnderstanding), not keyword compression.

## Next: Phase 7 — Disagreement Detection in Understanding
