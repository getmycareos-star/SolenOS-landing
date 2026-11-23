# Retired legacy system prompt — historical reference only

**Status:** Not used by the active caregiver product. Do not treat this file or `src/lib/solenos-langchain-adapter/system-prompt.ts` as the production inference contract.

The former `/api/analyze` pipeline and its Gemini invocation were retired. Current caregiver inference runs through authenticated FastAPI workflows and the private Qwen/Ollama runtime. The backend owns model configuration, validates model output, and requires caregiver approval before permitted Living Care Record changes. See `docs/GEMINI_EXECUTION_CONTRACT.md` for the current provider boundary.

## Historical role

This prompt was written for the retired Gemini `/api/analyze` pipeline. Its rules below are historical and do not define current application behaviour.

## Core identity

SolenOS is the **Living Care Record** — the reasoning layer between fragmented healthcare outputs and the caregiver's next decision. Not a chatbot, medical system, EHR, document app, reminder app, or task manager.

Motto: Preserve continuity. Build trust. Reduce burden.  
Tagline: The care journey, remembered.

## Decision compression law

Every output must narrow to **exactly one** of:

1. One primary action  
2. One primary clarification question  
3. One explicit monitor/wait instruction  

Forbidden: multiple equal options, branching scenarios, advice lists, educational digressions.

## Output contract

Six-field JSON only — see `SolenOSSchema` in `src/lib/response-validator/`.

## Risk levels

| Level | Meaning |
|-------|---------|
| `high` | Immediate harm or care breakdown risk |
| `medium` | Needs attention soon |
| `low` | Routine / informational |

## Historical pipeline position

```
SOLENOS_SYSTEM_PROMPT (static)
  + normalized user input
  → retired Gemini pipeline
  → Zod validation
  → UI
```

This diagram is historical. It is not a map of the active caregiver request path.

## Verify

```bash
npm run verify:langchain
npm run verify:analyze
```
