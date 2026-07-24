# PRD — Case Memory + Pattern Response Policy

**Module path:** `src/lib/case-memory`  
**Implementation status:** **INTERNAL · IMPLEMENTED · IN-MEMORY** (Path B analyze — PRP + 6-field Decision Snapshot) · Postgres adapters **STUB** · public SolenOS schema remains **5-field**  
**Index:** [module-status.md](../../17-canonical-architecture/module-status.md)

## User problem

Caregivers change phones, doctors, and notebooks over years. Conversation apps lose continuity. Families need a **case that survives** — facts, events, interventions, and outcomes — not chat transcripts.

## Product identity

SolenOS **IS** case-centered care memory that produces structured decision snapshots.

SolenOS is **NOT**: chatbot, AI assistant, reminder app, task manager, document storage, health prediction engine, or conversation memory.

**Product test:** After five years and multiple device/provider changes, a new family member can open the Case and understand the care journey.

## User behavior

- Speaks/types about the care recipient (“Dad”, “Mom”, LO name)
- Describes events (“wandering again”), conditions (“has Parkinson's”), what worked (“blue towel calmed him”)
- Expects calm structure: what is happening, what matters, what to ask, risk, what can wait, follow-ups
- Under strong pattern match, expects **reuse of what worked**, not a history lecture

## Success definition

- Case identified from input; facts update Case layers and Timeline
- Selective recall only on triggers (similar event, symptom/condition, time recurrence, medium/high risk with similarity, intervention context)
- Top 1–5 ranked events — never full timeline dump
- PRP States A/B/C control field weighting
- State C: `follow_up_items` emphasize intervention replication; do not list multiple past dates
- State A: no history phrases
- “Dad has Parkinson's” persists as Condition on Case
- Analyze pipeline exposes `case_memory_layer` with `decision_snapshot`

## Edge cases

| Case | Expected |
|------|----------|
| No prior timeline | State A — current input only |
| Weak tag overlap | State B — light past + cautious |
| Strong wandering + successful blue towel | State C — apply blue towel; minimal history in `what_is_happening` |
| Ambiguous care recipient | Fallback Case “Care recipient”; `identified=false` |
| Process restart | **Case lost** (IN-MEMORY) — honest gap |

## Failure states

- Recall without trigger → violation of selective recall
- State C narrating multi-date history → cognitive overload failure
- Attaching continuity to chat session → product identity failure

## UX expectations

- Decision surface continues SolenOS 5-field display (shaped by PRP text)
- Debug/observability may show `case_memory_layer.decision_snapshot` (6 fields)
- Timeline UI (Situation/UI-runtime) remains WHAT-history; Case Timeline is product memory

## Constraints

- Do not store conversations as primary memory
- Situations remain ADR-001 runtime root; Case is product spine
- Observation / Voice Observation workers must attach to Case, not own parallel conversation memory
- No auto clinical escalation invented here

## Design reasoning

Memory without intervention compression becomes a recall toy. PRP encodes the moat: **history collapses into the next safe action**.
