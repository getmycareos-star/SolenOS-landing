# Verification triage — 245 suites, 63 failures

Run 2026-09-29 against the current tree. Every suite executed; no suite skipped.

## The finding that matters

Six suites assert that a caregiver capture feeds six downstream capabilities. I checked every
one: the code exists and works in isolation, and **none of them is called from the caregiver
capture path or the analyze pipeline.**

| Symbol | Defined in | Called from capture/analyze pipeline |
|---|---|---|
| `recordJourneyEventFromCareCapture` | `care-journey/record.ts` | no |
| `processCareJourneyInputAsync` | `care-journey-graph/pipeline.ts` | no |
| `ingestCareEntry` | `cognitive-relief/ingest-entry.ts` | no |
| `syncFromJourneyResult` | `continuity-graph/pipeline.ts` | no |
| `runPatternIntelligence` | `pattern-intelligence/proactive-engine.ts` | no |
| `ingestCaregiverSelfEntry` | `capacity-self/caregiver-profile/ingest-self.ts` | no |

So these six suites are not stale. They are correctly reporting that six capabilities are
orphaned from the product the caregiver actually uses. **Editing those assertions to pass would
delete the only signal that the gap exists.**

## Failure classes

### A. Assertions about unwired capability (do not "fix" by editing the test)
- `verify-capacity-self`, `verify-care-journey`, `verify-care-journey-graph`,
  `verify-cognitive-relief`, `verify-continuity-graph`, `verify-pattern-intelligence` —
  the six above.
- `verify-observation-intelligence`, `verify-support-signal-system`, `verify-solenos-v14`,
  `verify-learning-first-release` — same shape, orphaned subsystems.
- `verify-human-validation`, `verify-relief-validation`, `verify-feedback-containment` —
  `/api/feedback` does not exist, so the containment the response composer reads is never written.
- `verify-continuous-care-record`, `verify-clarification-engine`, `verify-memory-strategy-engine`,
  `verify-network-effect-moat`, `verify-multi-caregiver-context-model`, `verify-success-model`,
  `verify-state-of-care-summary-engine`, `verify-continuity-decay-engine`, `verify-trust-layer-engine`,
  `verify-care-context-diff-engine`, `verify-behavior-interpretation-engine` — assert routes
  that do not exist; the engines behind several are live, the surfaces are not.
- `verify-system-architecture` — `emitSystemEvent` is never called; the analyze route emits
  neither `interaction_created` nor `decision_generated`.

### B. Contract drift — the output contract changed, tests disagree on shape
- `verify-system-identity` "5 sections", `verify-final-contract` "exactly 5 fields",
  `verify-cognitive-load-reduction` "exactly 6 fields", `verify-continuous-care-record`
  "SolenOSResponse schema unchanged", `verify-care-recipient-anchor` and
  `verify-negated-wellbeing-gather` "Clarity without what-is-happening rejected",
  `verify-interaction-load-signal` "normalization in what_is_happening",
  `verify-situation-risk-register` "overloadSimplification", `verify-system-health` ordering.
  These need a decision on which shape is correct, not a mechanical edit.

### C. SQL DDL assertions pointed at TypeScript
`verify-postgres-contract`, `verify-telemetry-persistence`, `verify-multilingual-execution`,
`verify-post-care-insight`, `verify-support-signal-system`, `verify-voice-observation`,
`verify-voice-input-layer`, `verify-care-profile`, `verify-settings-governance`,
`verify-trust-provenance`, `verify-living-care-intelligence`. The schemas now live in
`contract-constants.ts` maps (`POSTGRES_MODULE_TABLE_MAP` and similar), not migration files.
Rewriting these is mechanical and safe.

### D. Caregiver-facing copy and UI expectations
- `verify-brand` (10 components missing the wordmark), `verify-product-identity`,
  `verify-nav-journey`, `verify-welcome-first-visit`, `verify-trust-consent`,
  `verify-visual-language`, `verify-care-reality-language`, `verify-caregiver-first-positioning`,
  `verify-ui-runtime`, `verify-episodic-relief`, `verify-mvp-surface-area`,
  `verify-time-model` (UI ordering), `verify-cognitive-clarity` (system prompt),
  `verify-solenos-v14` (page wiring), `verify-care-identity` (GET hydration),
  `verify-return-continuity`, `verify-product-path`, `verify-dementia-entry-extended`,
  `verify-initial-care-reality-assessment`, `verify-solenos-constitution` (medication detection).

### E. Environment, not code
- Timeouts: `verify-care-reality-behavior`, `verify-care-memory-maturity`, `verify-gemini-contract`,
  `verify-postgres-acs`, `verify-state-change-report-integration`, `verify-phase5-entry-gate`.
- Missing module: `verify-fastify-boundary` imports `fastify-shim/config`, which does not exist.
- `verify-semantic-role-isolation` fails with an empty message; needs investigation.

## Recommendation

Classes A and B are the real work and require product decisions. Classes C, D, E are
mechanical and can be finished safely. Mass-editing A and B to green would produce a suite that
passes while the product stays unwired, which is worse than a red suite.
