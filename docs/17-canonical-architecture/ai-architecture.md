# AI Architecture

**Doc status:** Canonical architecture  
**Module markers:** [module-status.md](./module-status.md) — LLM on analyze path (**INTERNAL**); composer path = deterministic transformation + acceptance gate

## Split brain

| Path | Technology | Responsibility |
|------|------------|----------------|
| Deterministic engines | TS pure functions + heuristics | Load, Attention, Priority, Crisis, Confidence, Delegation, Fail-Safe |
| LLM | Gemini 1.5 Pro (T=0) via LangChain | 5-field cognitive clarity compression |
| Template explanation | human-trust-layer | Understand / challenge / undo |
| Observation MVP | Regex + ontology | Capture→Structure→Summarize |
| Voice / TTS | FUTURE libraries (`src/lib/voice`) — not MVP UI (ADR-018) | Same pipeline later: speak → understand → Care Record |

## Non-negotiables

- Priority Contract not LLM
- Load signal detection not LLM (MVP)
- Safety terminal after trust
- AI Behavior Spec governs tone and uncertainty

## Context management

Context window strategy modules prepare envelopes; memory-influence adjusts envelopes — does not dump raw chat history as medical fact.

## Failure

Missing key → 503; invalid JSON → gate; uncertainty → fail-safe; unsafe → safety enforcement.

Detail: [`../10-ai-systems/`](../10-ai-systems/).
