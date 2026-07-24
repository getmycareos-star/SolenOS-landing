# Input Stress Normalizer — MVP Spec

## Purpose

Lossless **structural** preprocessor — converts chaotic caregiver input into structured data before any LLM call.

Does **not** interpret, summarize, simplify, or resolve contradictions.

## Pipeline position

```
Input → Input Stress Normalizer → Context Window Strategy → LangChain envelope → Gemini → parse → Zod → Response
```

## Output schema (strict)

```typescript
{
  raw_input: string,
  detected_tags: string[],
  segments: { type: string, content: string }[],
  metadata: {
    has_emotional_language: boolean,
    has_medical_content: boolean,
    has_contradictions: boolean,
    has_incomplete_context: boolean
  }
}
```

## Structural tags (format only)

- `LONG_UNSTRUCTURED_TEXT`
- `EMOTIONAL_OVERLOAD`
- `MEDICAL_FRAGMENT`
- `CONTRADICTORY_STATEMENTS`
- `INCOMPLETE_CONTEXT`
- `MIXED_INPUT`

## Segmentation

Split **only** by line breaks and sentence boundaries (`.`, `?`, `!`). No semantic grouping or reordering.

## Module

`src/lib/input-stress-normalizer/`

## Verify

```bash
npm run verify:stress-normalizer
```
