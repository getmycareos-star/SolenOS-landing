# Episodic Cognitive Relief Engine Contract

SolenOS is an **episodic cognitive decompression engine** that converts caregiver uncertainty into structured clarity during moments of overload.

## System identity

**IS:** single-shot cognitive relief activated by real-world uncertainty spikes

**NOT:** retention system, engagement system, workflow platform, productivity tool, chatbot, assistant, continuous-use system

## Core product loop (only valid flow)

1. **Uncertainty trigger** — confusion, overload, decision paralysis
2. **Input dump** — messy, unstructured input accepted (no user-side structure required)
3. **Cognitive decompression** — structured clarity blocks
4. **Relief moment** — *"I understand what matters now."*
5. **Exit** — immediate departure is **correct**, not failure

Return happens only when **new uncertainty** appears — never via notifications, reminders, or habit design.

## Core design principle

Designed to **resolve cognitive overload and release the user immediately** — NOT to keep users inside.

## KPIs (product truth)

- **Time-to-relief:** clarity in seconds, not sessions
- **Relief density:** confusion reduced per unit time

NOT: engagement, retention, feature richness, session length

## Forbidden systems (architecture failure)

Dashboards, tracking systems, task managers, workflow loops, gamification, habit formation, retention mechanics, multi-session design, onboarding funnels.

## Core relief blocks

The decompression output centers on:

- `what_is_happening`
- `what_matters_now`
- `what_to_ask_next`
- `risk_level`
- `what_can_wait`
- `follow_up_items`

Extended schema fields (`emotional_context`, `_meta`) support prior safety contracts without introducing retention or engagement mechanics.

## Validation

After non-conversational check, before explanation quality:

`validateEpisodicRelief()` — failure type: `EPISODIC_RELIEF_FAILURE`

Blocks retention language, engagement loops, dependency framing, platform/onboarding prompts in model output.

MVP surface verified: no dashboard/onboarding/notification UI in `page.tsx`; `/api/analyze` remains stateless.

## Final implementation line

SolenOS is an episodic cognitive decompression engine that transforms caregiver uncertainty into structured clarity and **immediately releases the user after relief**, with zero retention or engagement mechanics.
