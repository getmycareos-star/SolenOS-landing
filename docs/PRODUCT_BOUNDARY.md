# SolenOS — Product Boundary Document (v1)

**Source of truth.** Do not rename or re-frame this document.

---

## 1. Product definition

SolenOS is the **Living Care Record** — an evolving intelligence layer that understands one person's changing care reality over time.

It is the reasoning layer between fragmented healthcare outputs and the caregiver's next decision. It preserves continuity so care never depends on someone's ability to remember everything.

SolenOS is **NOT** a medical authority, EHR, portal, document app, reminder app, chatbot, or care management platform.

**Sole purpose:** reduce the need to reconstruct the care journey from memory — so caregivers leave more certain than when they entered.

---

## 2. Core user

**Primary user:** Adult child caregiver managing aging parent complexity.

Usually: emotionally overloaded, handling healthcare coordination alone, non-medically trained, cognitively exhausted, operating under uncertainty.

Common conditions: hospital discharge confusion, medication confusion, family disagreement, unclear doctor communication, fear of missing something important, panic after medical updates.

---

## 3. Core problem

The user is not suffering primarily from lack of information.

The user is suffering from:

- fragmented understanding
- cognitive overload
- urgency confusion
- emotional interference
- inability to prioritize

SolenOS exists to reduce: **interpretation burden**, **prioritization burden**, **decision friction**.

---

## 4. Core loop (STRICT)

```
User uploads or describes caregiving situation
→ SolenOS interprets and structures information
→ SolenOS prioritizes urgency
→ SolenOS removes emotional noise
→ User experiences cognitive relief
→ User returns during next stressful situation
```

This is the **ONLY** product loop.

**NOT:** engagement loops, social loops, collaboration loops, productivity loops.

---

## 5. Input types

SolenOS accepts: medical documents, discharge notes, prescriptions, lab results, caregiving situations in natural language, emotionally charged descriptions, doctor instructions, medication confusion, family caregiving conflicts.

---

## 6. Output contract (IMMUTABLE)

Every response **MUST** follow this structure:

```json
{
  "what_is_happening": "",
  "what_matters_now": "",
  "what_to_ask_next": "",
  "risk_level": "low | medium | high",
  "what_can_wait": "",
  "follow_up_items": []
}
```

No extra prose. No conversational filler. No motivational language. No personality simulation.

**The structure itself is part of the product.**

Implementation: `src/lib/output-contract/`

---

## 7. Reasoning rules

**SolenOS MUST:** simplify, compress complexity, prioritize urgency, reduce interpretation burden, separate signal from emotional noise.

**SolenOS MUST NOT:** diagnose, prescribe treatment, predict outcomes, replace professionals, impersonate medical certainty.

When uncertainty exists: uncertainty **MUST** be surfaced explicitly. Ambiguity **MUST NOT** be hidden.

---

## 8. Emotional promise

SolenOS does **NOT** promise: safety, cures, certainty, medical correctness.

SolenOS promises: **"You can think clearly again."**

Emotional outcome: reduced panic, reduced overwhelm, reduced cognitive pressure, restored situational clarity.

**NOT:** emotional attachment, dependency, companionship.

---

## 9. Success metric

SolenOS succeeds **ONLY** if:

- user understands output immediately
- user stops spiraling
- user does not need to reread multiple times
- user feels reduced mental pressure
- user returns during future stress events

**Primary KPI: Cognitive Relief Rate**

Measured through: reduced rapid re-querying, reduced clarification loops, successful session exits, reduced frustration signals.

---

## 10. Failure states

SolenOS is **FAILING** if users: become more confused, repeatedly ask same question, cannot identify priority, misunderstand urgency, treat SolenOS as diagnosis engine, depend on it emotionally, use it as long-form chat companion.

**Critical failure:** Output increases cognitive load instead of reducing it.

---

## 11. Non-goals (STRICT)

SolenOS is **NOT:** a chatbot, therapist, medical AI, workflow manager, task tracker, generic care coordination tool, CRM, scheduling tool, reminder app, family collaboration system, productivity system, healthcare provider dashboard, EHR, AI agent platform, document app, or task manager.

SolenOS does **NOT:** diagnose, replace clinical systems, automate provider workflows, run engagement campaigns, or ask caregivers to maintain another checklist app.

SolenOS **does** preserve the Living Care Record — durable care reality, evidence, change, decisions, and open unknowns — so families do not reconstruct the journey from memory.

> **Note:** `POST /api/analyze` remains an ops/engine compression path (hard-gated). Caregiver MVP entry is `POST /api/situation` → Living Care Record.

---

## 12. Architecture boundary (MVP)

```
INPUT
↓
Gemini 1.5 Pro (or rule-based fallback when no API key)
↓
Structured Reasoning Layer
↓
Strict JSON Formatter
↓
UI Renderer
```

**Infrastructure:**

- Next.js SPA
- single route: `/api/analyze`
- no auth
- no persistence
- no background jobs
- no databases
- no queues
- no multi-user architecture

---

## 13. System philosophy

SolenOS is not a productivity product. SolenOS is a **closed-loop cognitive relief system**.

The product is successful **ONLY** if: **confusion → clarity**

Everything else is secondary.
