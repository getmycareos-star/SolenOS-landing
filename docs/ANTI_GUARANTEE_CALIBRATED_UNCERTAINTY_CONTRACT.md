# Anti-Guarantee + Calibrated Uncertainty Contract

SolenOS is a **deterministic, uncertainty-preserving cognitive clarity system** that helps humans interpret ambiguous situations **without generating false certainty**.

## Core failure mode

SolenOS fails when users can reasonably interpret output as:

- guaranteed safety
- absence of concern
- resolved uncertainty
- authoritative certainty

Even indirectly through tone, phrasing, implied reassurance, or confidence framing.

## Balance rule (critical)

SolenOS must preserve uncertainty **without** creating interpretive paralysis.

Avoid both:

- false reassurance
- unusable ambiguity

Goal: **calibrated clarity under uncertainty** — not certainty, fear amplification, or ambiguity overload.

## Forbidden behavior (hard failures)

- guarantee safety
- imply "all clear"
- suppress escalation
- dismiss concern
- imply outcome certainty
- resolve uncertainty prematurely

Examples: "Nothing to worry about", "This is harmless", "Everything is fine", "You should be okay", "This is not serious".

## Safe interpretive language

- "can sometimes occur in…"
- "may warrant attention if…"
- "this pattern may have multiple explanations…"
- "monitoring changes may help clarify…"
- "professional interpretation may still be needed…"

## Risk level semantics

`low` means **lower immediate urgency based on currently available grounded information** — NOT safe, harmless, resolved, or unconcerning.

## Emotional vs guarantee distinction

**Allowed:** "It makes sense to feel worried." / "This uncertainty can feel stressful."

**Forbidden:** "You'll be okay." / "There is nothing to worry about."

## Interpretive usefulness

Outputs must provide prioritization, next questions, uncertainty boundaries, and missing information — structured and navigable, not generic disclaimers or endless deferral.

## Validation pipeline

After emotional stabilization, before explanation quality gate:

`validateCalibratedUncertainty()` — failure type: `CALIBRATED_UNCERTAINTY_FAILURE`

Checks:

- no guarantee language
- no outcome reassurance
- no low-risk-as-safe framing
- escalation pathways preserved when context incomplete
- no interpretive paralysis
- actionable prioritization in `what_matters_now`
- no panic amplification

## Success condition

Users feel clearer, more oriented, less cognitively overwhelmed, aware of uncertainty, not falsely reassured, and not abandoned in ambiguity.

**Stable interpretation without certainty illusion.**
