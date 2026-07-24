# Product Philosophy

**Doc status:** Canonical architecture  
**Module markers:** [module-status.md](./module-status.md)

## Continuity philosophy

SolenOS is continuous intelligence for family responsibility — not a feature catalog. Evaluate work with:

> Does this increase SolenOS' understanding of the family responsibility system over time?

## Case is the product

SolenOS is **case-centered care memory infrastructure**. Chat and voice are input channels only. The **Case** (care recipient) holds Profile, Conditions, Timeline, Interventions, Outcomes, and Case Understanding across years — phones, doctors, and notebooks may change; the Case remains.

**Situation** remains the ADR-001 runtime STATE root for active episodes; Situations attach to a Case. See ADR-012 and `CASE_VS_SITUATION_MAPPING`.

## Pattern Response Policy

Strong historical matches do not dump history. They compress into **intervention mode**: reuse what worked; reduce cognitive load.

## Observation Intelligence

Capture → Structure → Summarize → Reveal Patterns (not Diagnose → Prescribe). Observations belong on the Case.

**MVP inputs (ADR-018):** text + documents only. Accept messy incomplete caregiver information — do not wait for perfect structure.

**Voice (FUTURE — ADR-017):** Libraries keep modular `ISpeechInput` / `ISpeechOutput` so voice can enter the same User Input → Understanding → Care Record path later. Do not mount Voice Conversation, mic dictation, or Hear SolenOS in MVP. Cloud TTS upgrade remains ADR-013.

Primary observation KPI (when voice returns): `observations_per_caregiver_per_week`. Chat/voice are input channels — not companions.

## Load-first

Burden recognition precedes tips. Dementia is entry path, not product identity.

## Clarity over abstraction

Prefer Situation-centric concrete STATE for runtime; prefer Case for durable care identity.

## Safety over output

Better to clarify or shrink than to emit harmful certainty.

## Philosophy stack

Continuity over features · Understanding over speed · Safety over output · Clarity over abstraction · Compounding intelligence over static functionality.

## Public trust (first visit, then continuity)

First-time caregivers land on `/welcome` so they understand what SolenOS solves — what matters, what can wait, what to ask, and what may become serious — before entering the Living Care Record. CTA `/?enter=1` opens the care workspace. Returning caregivers with an entered record go straight to continuity. Founder story and mission remain on distinct public routes and About SolenOS; they never interrupt an active care record.

## Care Reality Intelligence (category)

SolenOS builds **Care Reality Intelligence** — an evolving understanding of one person's care reality. Not notes, tasks, chat, or document storage. Engine spine: Events → Changes → Decisions → Outcomes → Context → Confidence. Facade: `src/lib/care-reality-intelligence`. UI exposes understanding; intelligence lives underneath.
