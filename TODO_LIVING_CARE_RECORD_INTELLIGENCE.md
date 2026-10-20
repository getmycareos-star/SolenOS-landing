# Living Care Record Intelligence v2 — Focused Implementation TODO

> Improve the QUALITY of the Living Care Record, not the number of modules.
> Constraint: extend before creating, compose before duplicating, single source of truth.

## Phase 1 — Document Intelligence Quality (Highest Priority)

- [ ] 1a. Enrich `change-detection.ts` — surface medication safety change types
       (uncertain medications, duplicate-dose potential, missed-dose, refill-problem).
- [ ] 1b. Improve `timeline-events.ts` — richer, evidence-backed `whatMattersNext`.
- [ ] 1c. Strengthen `verify-document-intelligence-care.mts` with quality assertions.

## Phase 2 — Longitudinal Reasoning (orchestration only, no duplication)

- [ ] 2a. Confirm existing engines (change-detection, contradiction-detection-engine,
       pattern-intelligence, priority-engine) cover the longitudinal questions.
- [ ] 2b. If a real gap exists, add a lightweight longitudinal layer that COMPOSES
       existing engines — never reimplements them. Document why any new module is needed.

## Phase 3 — First-Screen Integration

- [ ] 3a. Surface the four first-screen answers (changed / attention / prepare / missing)
       from structured data in the Living Care Record projection.
- [ ] 3b. Every statement traceable to evidence; expose confidence internally.

## Acceptance

- [ ] No duplicate reasoning engines.
- [ ] Existing modules reused wherever possible (≥80% shared behavior → compose).
- [ ] First screen is more trustworthy and actionable.
- [ ] Longitudinal reasoning works across prior records, not isolated documents.
