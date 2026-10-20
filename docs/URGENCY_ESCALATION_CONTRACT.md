# Urgency Detection + Emergency Escalation Contract

SolenOS is a **deterministic, input-grounded, uncertainty-preserving cognitive triage and clarity system for stressed caregivers**.

## Core safety principle

Urgency handling exists to prevent escalation delay and reduce caregiver confusion during crisis — **while still preserving uncertainty**.

Even in emergencies: no diagnosis, no certainty claims, no clinical conclusions.

## Primary failure modes (dual)

SolenOS fails if:

- severe risk signals are **not** escalated clearly
- urgency is diluted by excessive explanation
- emergency indicators are normalized
- action is delayed behind interpretation

**And also** if:

- emergencies are presented as confirmed medical conclusions
- clinical certainty is implied
- output sounds diagnostically authoritative

## High-urgency signal detection (input-grounded)

Signal-based, NOT diagnosis-based. Triggers include:

- chest pain, difficulty breathing, cannot breathe
- blue lips / cyanosis, unconsciousness, collapse / fainting
- inability to wake, severe sudden confusion, oxygen distress
- rapidly worsening condition, seizure-like behavior
- uncontrolled bleeding, stroke-like symptoms

## Urgency classification

Every input classifies into: **LOW | MEDIUM | HIGH / POSSIBLE EMERGENCY | UNKNOWN**

(`risk_level` in schema: `low | medium | high | unknown`)

## High-urgency response format

When HIGH urgency signals are present in input:

1. **Header** (first in `what_matters_now`): `🟥 HIGH URGENCY / POSSIBLE EMERGENCY`
2. **Minimal interpretive statement** in `what_is_happening` — uncertainty-preserving
3. **Immediate action** — seek emergency care, contact emergency services, do not delay
4. **Optional questions** in `what_to_ask_next` — only if they do not delay escalation

### Allowed interpretive language

- "These symptoms can sometimes occur in medical emergencies."
- "This combination may require urgent medical evaluation."

### Forbidden

- "This is a heart attack."
- "Chest pain can sometimes be indigestion." (urgency suppression)
- "This is definitely an emergency condition."

## Validation

After grounding, before unknown-state verification:

`validateUrgencyEscalation()` — failure type: `URGENCY_ESCALATION_FAILURE`

Checks:

- severe signals escalated when present in input
- urgency header + immediate action when required
- no urgency suppression or diagnostic certainty
- no hallucinated severity without input signals

## Final product truth

SolenOS is a deterministic cognitive triage system that **escalates severe risk signals immediately without asserting medical authority**.
