# LangChain Adapter — MVP Execution Spec v1

## Role

`solenos-langchain-adapter` is a **deterministic prompt builder + single-pass LLM invocation wrapper**.

It is **not** an agent, reasoning system, workflow engine, memory system, tool router, or multi-step chain executor.

## Pipeline position

```
Input
  → Prompt Builder (deterministic)
  → LangChain LLM Call (single pass)
  → Raw Output (plain string)
  → Zod Validation Layer (response-validator — external)
  → UI
```

## Core API

```typescript
function runSolenOSLLM(input: string, context?: any): Promise<string>
```

### Behavior

1. **Build prompt** — inject fixed SolenOS system prompt, user input, optional context
2. **Call LLM** — LangChain `invoke()` only (Gemini or OpenAI-compatible)
3. **Return raw output** — exact model text; no parsing, validation, or transformation

## Module layout

| File | Purpose |
|------|---------|
| `system-prompt.ts` | Static SolenOS JSON schema instructions |
| `prompt.ts` | Deterministic user-message assembly |
| `model.ts` | Provider resolution + chat model factory |
| `index.ts` | `runSolenOSLLM` export |

## Configuration

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini (default when set) |
| `OPENAI_API_KEY` | OpenAI or compatible endpoint |
| `OPENAI_BASE_URL` | Optional base URL (Llama / local OpenAI-compatible) |
| `SOLENOS_LLM_PROVIDER` | Force `gemini` or `openai` |
| `SOLENOS_LLM_MODEL` | Model name override |

Stable defaults: `temperature: 0`, `maxRetries: 0`.

## Forbidden inside this module

- Agents, ReAct, tool calling, memory, state, loops, retries
- Output parsing, schema validation, correction, or interpretation

## Integration with validation

```typescript
import { runSolenOSLLM } from "@/lib/solenos-langchain-adapter";
import { validateAIResponse } from "@/lib/response-validator";

const raw = await runSolenOSLLM(input, context);
const parsed = JSON.parse(raw); // orchestration layer — not in adapter
const output = validateAIResponse(parsed); // hard gate
```

## Verify

```bash
npm run verify:langchain
```
