# SolenOS — Product Constitution

> **Care should never depend on someone's ability to remember everything.**

This is worldview and engineering direction — not a marketing doc.

## Product

SolenOS is **not** a document processing application. Documents are one input.

The product is a continuously evolving **Living Care Record**: understanding of a person's care journey so caregivers know what matters now.

**Job:** Reduce uncertainty — confidence that nothing important is being missed.  
**Metric:** Did the caregiver leave more certain than when they entered?  
**Feeling:** Relief.

## CareRecord spine (build before UI)

```
CareRecord
 ├── Person Profile
 ├── Events
 ├── Observations
 ├── Medications
 ├── Decisions
 ├── Tasks
 ├── Risks
 ├── Unknowns
 └── Confidence Scores
```

Module: `src/lib/product-constitution` (+ Care State Engine spine fields).

## Layers

1. Capture chaos (messy inputs)  
2. Care memory (longitudinal)  
3. Understanding (interpret, not only summarize)  
4. Missing information (“what I don’t know”)  
5. Daily Care Confidence projection  

## Decision filter

Improves Care State? Reduces uncertainty? Identifies change? Exposes blind spots? Reduces burden? Strengthens Living Care Record? Builds trust? Matters in five years?

Unclear → do not build.

## Related

- Cursor rule: `.cursor/rules/solenos-product-constitution.mdc`
- North Star constraint: `src/lib/product-north-star`
- Canonical: `docs/17-canonical-architecture/system-architecture.md`
