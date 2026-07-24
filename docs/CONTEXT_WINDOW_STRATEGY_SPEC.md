# Context Window Strategy — MVP Contract v1

Deterministic lossless context compression for caregiving-critical information under token constraints.

## Purpose

Preserve medical facts, action instructions, contradictions, and time-sensitive information while allowing compression of repetition and emotional verbosity only.

**Not:** summarization, reasoning, semantic interpretation, or medical analysis.

## Pipeline position

```
Input → Input Stress Normalizer → Context Window Strategy → LangChain envelope → Gemini → …
```

## Priority order (hard)

1. **action_critical** — medication, dosage, discharge, caregiver tasks, escalation triggers
2. **medical_facts** — diagnoses, symptoms, vitals, treatment status
3. **time_sensitive_events** — today/now/yesterday, sudden changes
4. **contradictions** — conflicting reports, uncertainty (never merged)
5. **emotional_context** — compress only if necessary

## Output schema

```typescript
{
  preserved_text: string,
  structured_context: {
    action_critical: string[],
    medical_facts: string[],
    time_sensitive_events: string[],
    contradictions: string[],
    emotional_context: string[]
  },
  compression_applied: boolean,
  source_tags: string[],
  metadata: {
    critical_segments_preserved: number,
    original_length: number,
    preserved_length: number
  }
}
```

## Compression rules

**Allowed:** remove repetition, shorten emotional duplication, trim emotional tail when over `CONTEXT_WINDOW_MAX_CHARS` (6000).

**Forbidden:** drop medication details, merge contradictions, resolve ambiguity, alter clinical meaning.

## Module

`src/lib/context-window-strategy/`

## Verify

```bash
npm run verify:context-window
```
