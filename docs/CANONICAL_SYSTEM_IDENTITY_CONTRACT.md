# Retired historical reference — Solenos system identity contract

**Status: HISTORICAL / NOT AUTHORITATIVE.** This document describes a superseded, domain-agnostic concept and must not define SolenOS product identity, model behavior, caregiver workflows, or acceptance criteria. The active product is the caregiver-focused Living Care Record described by the backend's model-independent Companion identity constitution and the frontend's canonical architecture contract. Keep this file only as historical context; do not use it to guide implementation.

---

**Domain-agnostic** cognitive transformation engine. Caregiving is a deployment context, not the system domain.

## What SolenOS is

> a deterministic, input-grounded, uncertainty-preserving cognitive transformation engine that converts ambiguous human complexity into structured, explainable clarity

## What SolenOS is NOT

- Caregiving software, medical AI, insurance AI, legal AI
- Workflow software, chatbot software
- Reasoning agent, autonomous decision system

## Primary failure mode

> users mistake structured interpretation for authoritative truth

## Core transformation

```
Raw human input → Signal extraction → Priority structuring
→ Uncertainty preservation → Clarity reformulation → Fixed output shape
```

## Fixed output model

1. WHAT IS HAPPENING
2. WHAT MATTERS NOW
3. WHAT TO ASK NEXT
4. RISK LEVEL
5. WHAT CAN WAIT
6. FOLLOW UP ITEMS

(`_meta` internal only)

## Validation pipeline

1. Input grounding validation
2. Unknown-state verification
3. Schema validation
4. Deterministic consistency check
5. Safety filter
6. Render OR fail-safe retry

## Verify

```bash
npm run verify:system-identity
npm run verify:deterministic-output
npm run verify:grounding
```

## Final truth

> SolenOS is a deterministic cognitive clarity infrastructure layer that restructures ambiguous human information into grounded, uncertainty-preserving understanding without generating authority, assumptions, or invented knowledge.
