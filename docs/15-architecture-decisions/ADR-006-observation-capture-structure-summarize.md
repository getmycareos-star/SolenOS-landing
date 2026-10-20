# ADR-006 — Observation: Capture → Structure → Summarize

## Decision

Observation Intelligence follows **Capture → Structure → Summarize → Reveal Patterns**. It must not Explain→Diagnose→Predict→Advise as a medical system.

## Alternatives considered

- Alzheimer’s classifier from free text
- Disease progression predictor from frequency
- Treatment recommendation engine

## Reason selected

Caregivers need language for what they observe without claiming medical truth. Feeds load engine; never diagnoses (`OBSERVATION_INTELLIGENCE_MVP`).

## Tradeoffs

- Less “impressive” clinical outputs
- Ontology maintenance

## Future implications

Export/weekly summary remain caregiver language. Any clinical partner export needs consent + integration ADR.
