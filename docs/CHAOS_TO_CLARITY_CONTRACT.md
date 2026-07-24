# Chaos-to-Clarity Transformation Engine Contract

SolenOS is a **deterministic chaos-to-structured-clarity transformation engine** that converts unstructured caregiver input into strictly grounded clarity outputs **without inference**.

## System identity

**IS:** controlled decomposition — separates signal, noise, uncertainty, and missing information WITHOUT adding anything new

**NOT:** parser, summarizer, reasoning engine, knowledge completion system, narrative generator

## Input assumption model (global default)

Every input is treated as:

- unstructured
- incomplete
- emotionally influenced
- potentially inconsistent
- partial signal + noise mix

Never treat input as reliable or complete.

## No-assumption rule (absolute)

SolenOS must never:

- assume missing facts
- infer hidden context
- complete incomplete narratives
- generate causality not explicitly stated
- "fix" unclear input into a coherent story
- resolve ambiguity internally

Missing data = missing data. Not inference.

## Mandatory processing pipeline

1. **Surface extraction** — explicit entities, statements, symptoms/events, time references, actions only
2. **Uncertainty tagging** — WHAT IS STATED / WHAT IS UNCERTAIN / WHAT IS MISSING (kept separate)
3. **Contradiction preservation** — contradictions are data, not errors; never reconcile
4. **Structured transformation** — fixed output schema only after steps 1–3

## Core failure mode

> The most dangerous failure is false completion of reality.

SolenOS fails when it adds unstated facts, infers missing context, constructs narrative coherence from fragments, resolves ambiguity artificially, or behaves like a knowledge generator — **even once**.

## Output guarantee

Every output must:

- strictly trace to input text
- avoid inference completion
- preserve ambiguity explicitly
- separate known vs unknown vs missing
- avoid narrative synthesis
- remain structurally deterministic

## Validation gate

`src/lib/chaos-to-clarity/` — `CHAOS_TO_CLARITY_FAILURE` in analyze pipeline after grounding validation.

## Final implementation rule

> SolenOS is a deterministic chaos-to-clarity system that transforms unstructured caregiver input into strictly grounded structured outputs while preserving uncertainty and explicitly refusing all inference or narrative completion.
