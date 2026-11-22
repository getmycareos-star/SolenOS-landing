# LangChain Adapter — Qwen-only Execution Spec

## Role

`solenos-langchain-adapter` builds deterministic prompts and makes a single
Qwen inference request through the private Ollama service.

It is not an agent, workflow engine, memory system, tool router, or multi-step
chain executor.

## Pipeline position

```
Input
  → Prompt Builder
  → Private Ollama / Qwen
  → Raw Output
  → Existing validation boundary
  → Caller
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `OLLAMA_BASE_URL` | Private Railway Ollama service URL |
| `OLLAMA_MODEL` | Qwen model name; defaults to `qwen3.5:4b` |
| `OLLAMA_API_KEY` | Optional compatibility-client value; not a Qwen API key |
| `SOLENOS_LLM_PROVIDER` | If supplied, must be `ollama`; other values are rejected |

There is no OpenAI-hosted or Gemini provider selection, API key, or fallback
in this adapter. The `@langchain/openai` package is retained only as an
OpenAI-compatible HTTP client for Ollama's `/v1` endpoint; it does not mean
SolenOS sends inference requests to OpenAI.

The production caregiver workflows use the backend's native Ollama HTTP
integration. This adapter is a legacy compatibility surface and must not be
mistaken for proof of deployed production inference.

## Failure behavior

Missing or invalid private Ollama configuration fails explicitly. This adapter
does not switch to another provider.

## Verify

```bash
npm run verify:langchain
```
