# SolenOS Product Directive — Long Family Chats, Emails, and Message Threads

**Status:** Permanent product behavior  
**Authority:** Product Steward  
**Decision:** **B** — Multiple related observations/events linked by Relationship Engine  
**Companions:** Input Reality · Situation Relationship · Document-only (same pipeline) · Evidence visibility

---

## Why B (not A, not C)

| Choice | Problem |
|--------|---------|
| **A** One Care Event / summary | Destroys relationships — notes-app failure |
| **C** Ask them to highlight first | Forces caregiver to organize chaos — defeats product |
| **B** Multiple linked events | Continuity of care reality across the thread |

A long chat/email is usually **not** one event. It often contains: observations · decisions · concerns · updates · changing responsibilities · unanswered questions · outcomes.

---

## Decision B (locked)

Treat the thread as a **collection of related information**.

Illustrative pattern (not phrase logic):

| Thread fragment | Derived | Relationship |
|-----------------|---------|--------------|
| Fall mentioned | Observation | — |
| Urgent care | Care Event | Follow-up to fall |
| Med stopped | Decision Event | Related to visit |
| Afraid to walk | Observation | Possible outcome after fall |

Caregiver does **not** see the graph.  
They should feel: *"SolenOS understood the whole situation."*

---

## Pipeline

```
Raw conversation
  → Extract care-relevant information
  → Identify observations, decisions, actions, outcomes
  → Link to existing Active Care Situations (Relationship Engine)
  → Update Care Reality State
  → Reflect in Living Care Record
```

Do **not** require caregivers to summarize or organize before submitting.

Caregiver provides information. SolenOS preserves continuity.

---

## Permanent evidence rule

**Preserve the original source.**

A family message thread can later become important evidence:

- Who said what?  
- When?  
- Was a decision agreed?  
- Did someone misunderstand an instruction?  

**Store the source thread**, then derive structured understanding from it.

**Source = evidence. Care Reality = interpretation.** Never store interpretation alone.

---

## Never expose

Extraction steps · event classifications · relationship types · internal processing · “chat summary” as the product

---

## Feel

> "I gave SolenOS a messy conversation, and it helped me understand what matters."

Not:

> "I uploaded a chat and received a summary."

---

## Implementation

**Status: IMPLEMENTED** (engine)

- `src/lib/thread-ingestion` — split + multi-obs ACS ingest; durable full source (`thread-evidence/`)
- Live path: `processSituationInput` detects on **raw newlines** (never sanitize-flattened display text); documents that look like threads use the same path
- Per-fragment event kinds — never one kind for the whole paste
- Caregiver UI: fragment facts only; never `[thread-source]` / classifications / chat summary

```bash
npm run verify:continuity-core-tier1
npm run verify:live-thread-wire
```
