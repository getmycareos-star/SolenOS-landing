# SolenOS — Canonical Architecture Contract (Cursor Implementation Spec v1)

Single source of truth for SolenOS system definition.

## System identity (immutable)

SolenOS is:

> a deterministic, structured, uncertainty-preserving clarity engine for caregiver inputs under stress

**NOT:** medical system, diagnostic engine, reasoning agent, chatbot, expert system, decision-maker, summarization tool.

## Core design principle

> Structure ≠ brevity. Structure = safe comprehension under uncertainty.

Outputs must be structured, deterministic, explainable, uncertainty-preserving, cognitively readable under stress, and trust-stabilizing — **not** compressed for minimality.

## Core failure model

SolenOS does **not** fail when wrong. It fails when:

> users interpret structured uncertainty as medical certainty

## Output contract (fixed order)

```json
{
  "what_is_happening": "clear structured explanation with necessary context",
  "what_matters_now": "priority signals + why they matter",
  "what_to_ask_next": "questions that reduce uncertainty?",
  "risk_level": "low | medium | high",
  "what_can_wait": "non-urgent context or deferred concerns",
  "follow_up_items": ["clear next steps"],
  "_meta": {
    "context_completeness": 0.0,
    "missing_critical_fact": "string | null",
    "confidence": "low | medium | high"
  }
}
```

## Explanation is mandatory

Explanation is cognitive safety under uncertainty — not noise. When ambiguity exists, explanation is **required**.

## Uncertainty preservation

When uncertainty exists, SolenOS must:

- explicitly state uncertainty
- explain **why** uncertainty exists
- preserve multiple possible interpretations
- avoid collapsing ambiguity into a single conclusion

## Forbidden behavior

Never diagnose, prescribe, give medical instructions, assert clinical certainty, predict outcomes, suppress escalation, or replace professional judgment.

## Validation pipeline (final order)

1. Raw capture
2. JSON parse
3. Schema validation (Zod gate)
4. Consistency check
5. Safety filter
6. Render OR retry

No heuristics. Retries are stateless fresh executions — no patching prior output.

## Architecture flow

```
Input → Classification → Signal extraction → Structured interpreter
→ Uncertainty preservation → Output shaping → Zod validation
→ Consistency check → Safety filter → UI render
```

No branching logic. No domain-specific flows.

## Implementation

| Concern | Module |
|---------|--------|
| Contract constants | `src/lib/canonical-architecture/contract.ts` |
| System prompt | `src/lib/solenos-langchain-adapter/system-prompt.ts` |
| MVP boundary | `src/lib/mvp-architecture/boundary.ts` |
| Schema | `src/lib/consistency-determinism/types.ts` |
| Clarity gate | `src/lib/output-quality-gate/` |
| Epistemic safety | `src/lib/epistemic-safety-engine/` |
| Medical boundary | `src/lib/medical-responsibility-boundary/` |

## Verify

```bash
npm run verify:canonical-architecture
```

## One-line truth

> SolenOS is a deterministic, explanation-preserving uncertainty interpretation system that ensures caregivers understand ambiguous situations safely without being misled into false medical certainty.
