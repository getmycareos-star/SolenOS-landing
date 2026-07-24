# Failure Isolation — MVP Execution Spec

## Product truth

SolenOS/SolenOS MVP is a **failure-isolation prototype** validating whether structured cognitive clarity reduces caregiver mental burden.

It is **not** a product platform, extensible architecture, or feature framework.

## Single pipeline

```
unstructured caregiver input → structured cognitive clarity JSON
```

No other system may modify, extend, or intercept this flow.

## Failure categories (exactly one per event)

| Category | Severity | Definition | Fix layer |
|----------|----------|------------|-----------|
| **model** | critical | Invalid JSON, schema violation, markdown wrappers | Retry LLM; never patch output |
| **prompt** | critical | Valid JSON but violates transformation intent | Tighten system prompt |
| **ux** | high | Valid but verbose or unclear prioritization | UI presentation only |
| **input** | low | OCR noise, fragments, messy text | Accept; normalize only |

## Engineering priority (absolute)

1. Model failure  
2. Prompt failure  
3. UX failure  
4. Input failure  

## Module

`src/lib/failure-isolation/`

- `classifyModelFailure()` — structural / validation failures  
- `classifyInputFailure()` — bad input at boundary  
- `detectPromptFailure()` — post-hoc intent violations (prompt fix, not runtime patch)  
- `detectUxFailure()` — clarity heuristics (UI responsibility)  

## API traceability

Model failure (422):

```json
{
  "error": "unable_to_process",
  "reason": "invalid_model_output",
  "failure_category": "model"
}
```

Input failure (400):

```json
{
  "error": "input must be a non-empty string",
  "failure_category": "input"
}
```

## Forbidden

- New features, agents, workflows, memory, dashboards, analytics  
- Fixes that require new systems  
- Architectural drift beyond MVP validation  

## MVP validation criteria (product)

- User understands output in **<10 seconds**  
- User reports **reduced cognitive load**  
- User **returns voluntarily** with new inputs  

If any fail → system is invalid.

## Verify

```bash
npm run verify:failure-isolation
```
