# Medical Responsibility Boundary — Hard Safety Constraint v1

Safety + medical authority firewall. SolenOS is **not** a medical system.

## Purpose

Block diagnosis, treatment recommendations, medication instructions, and clinical authority claims before any response is returned.

## Allowed domain

- Structured interpretation of what is observed (not clinical definition)
- Attention prioritization and urgency signals
- Questions for clinicians
- `risk_level` as urgency only — not diagnosis probability

## Forbidden (hard block)

| Category | Examples |
|----------|----------|
| Diagnosis | "This is pneumonia", "signs of cancer" |
| Treatment | "Increase dosage", "Stop medication" |
| Medication instructions | "Take 10mg twice daily" |
| Clinical authority override | "Ignore the doctor" |
| Diagnostic certainty | "Definitely heart failure" |

## Gate behavior

```
Output Quality Gate → Medical Responsibility Boundary → Determinism Gate → Response
```

1. Detect violations in caregiver-facing fields
2. Apply deterministic safe-language rewrite
3. Re-validate — **never return forbidden content as-is**
4. On persistent failure: retry + log `MEDICAL_BOUNDARY_FAILURE` via failure observability

## Module

`src/lib/medical-responsibility-boundary/`

## Verify

```bash
npm run verify:medical-boundary
```
