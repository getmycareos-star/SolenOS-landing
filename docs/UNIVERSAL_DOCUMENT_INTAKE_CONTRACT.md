# SolenOS — Universal Document Intake + Structured Clarity Contract

## Core identity

> a deterministic, input-grounded, uncertainty-preserving **document transformation engine**

**NOT:** medical/insurance/legal software, document summarizer, expert interpretation engine.

## Universal pipeline (same for all document types)

1. Input normalization
2. Document type tagging (organizational only)
3. Structural extraction
4. Signal prioritization
5. Uncertainty preservation
6. Context window stabilization
7. Structured transformation
8. Strict validation
9. Safety filter
10. UI rendering

## Document type tags (organization only)

`MEDICAL_DOCUMENT`, `INSURANCE_DOCUMENT`, `LEGAL_DOCUMENT`, `FINANCIAL_DOCUMENT`, `GOVERNMENT_BENEFIT_DOCUMENT`, `CARE_INSTRUCTION_DOCUMENT`, `MIXED_UNSTRUCTURED_DOCUMENT`

Tags do **not** trigger domain-specific interpretation logic.

## Canonical document model (internal)

```json
{
  "document_types": [],
  "key_facts": [],
  "action_items": [],
  "deadlines": [],
  "entities": [],
  "uncertainties": [],
  "risk_flags": []
}
```

MVP UI renders via fixed SolenOS schema; document compliance validated on output.

## Absolute rules

- Never interpret legal validity, medical diagnosis, insurance approval, or eligibility
- Never merge multi-document meaning or reconcile contradictions
- Never invent facts or complete missing context

## Verify

```bash
npm run verify:document-intake
```

## Final truth

> SolenOS is a deterministic document-to-clarity transformation engine that restructures complex human information into grounded, uncertainty-preserving cognitive clarity without generating authority, assumptions, or inferred meaning.
