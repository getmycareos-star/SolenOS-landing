# ADR-012 — Case-Centered Care Memory + Pattern Response Policy

## Decision

SolenOS treats the **Case** (care recipient) as the long-lived **product spine**: Profile, Conditions, Medications, Providers, Facilities, Documents, Timeline, Events, Interventions, Outcomes, Family Context, and Case Understanding.

**Situations remain the runtime STATE root (ADR-001).** Situations/events/demands attach to a Case. Chat and voice are input channels only — never primary memory.

Selective Case Recall returns at most **1–5** relevant prior events only when trigger conditions hold. When none hold, respond from current input only (no history).

**Pattern Response Policy (PRP)** maps recall strength to States A / B / C:

| State | Match | Response mode |
|-------|-------|----------------|
| A | none | Present-only; describe + immediate action; no history |
| B | weak | Light past reference + cautious suggestion; present-focused |
| C | strong | **Intervention mode** — compress history into “what worked”; prioritize action replication over narrating dates |

Fixed **Case Decision Snapshot** is exactly six fields (`what_is_happening`, `what_matters_now`, `what_to_ask_next`, `risk_level`, `what_can_wait`, `follow_up_items`). Temporal detail may appear only inside those text fields.

## Alternatives considered

- Conversation / session memory as product spine
- Exhaustive timeline dump into every response
- Replacing Situation as runtime root with Case
- Expanding public SolenOS Zod schema to six fields immediately (breaks many gates)

## Reason selected

Five-year phone/doctor/notebook changes must leave the Case intact. New family members open the Case and understand the journey. Strong patterns must **reduce cognitive load** by reusing successful interventions — not increase history literacy.

Situation-centric runtime (ADR-001) stays for operational episodes; Case adds durable product continuity without turning SolenOS into a chatbot.

## Tradeoffs

- Dual naming (Case vs Situation) requires clear mapping docs
- Public SolenOS display remains **5-field** schema; 6-field snapshot lives on `case_memory_layer` until schema unification
- In-memory stores + Postgres noop/stub — continuity lost on process restart until persistence is wired (**IN-MEMORY / SCHEMA-ONLY**)

## Future implications

- Persist Cases/timeline to Postgres with RLS
- Unify SolenOS public contract with Decision Snapshot when verify matrix is ready
- Observation Intelligence and Voice Observation attach Observations to Case, not chat threads
- Family Intelligence compounds Case Understanding over years

## Status markers

- Logic: **IMPLEMENTED**
- Persistence: **IN-MEMORY** (Postgres adapters **noop / stub**)
- Public SolenOS 6-field unification: **FUTURE**
