# ADR-005 — Dementia Is Entry Market, Not Product

## Decision

Dementia / progressive dependency caregiving is the **go-to-market entry path**. The product is caregiver load detection, attention prioritization, and continuity intelligence — not dementia diagnosis or care-plan generation.

## Alternatives considered

- Dementia medical companion app
- Disease encyclopedia
- Clinical decision support MVP

## Reason selected

Medicalization fails caregivers’ primary unmet need (burden) and creates regulatory/epistemic hazard. Anti-patterns encoded in `V14_ANTI_PATTERNS`.

## Tradeoffs

- Messaging must carefully avoid clinical claims while still serving dementia families
- Observation ontology can look “clinical” — must stay observational

## Future implications

Vertical expansion keeps load/continuity core; disease-specific modules require new ADRs and must not invert north star.

**Implementation SoT:** [`docs/architecture/CLINICAL_PROFILE.md`](../architecture/CLINICAL_PROFILE.md) · `src/lib/clinical-profile` · Unknowns profiles under `src/lib/unknowns-engine/profiles/`.

Dementia is **ready as MVP default profile**. Other conditions are **registry-ready**, not yet shipped.
