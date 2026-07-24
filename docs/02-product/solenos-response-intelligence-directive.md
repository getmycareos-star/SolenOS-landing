# SolenOS MVP Response Intelligence Directive

**Status:** Permanent Product Steward / MVP blocker constraint  
**Authority:** Same force as Caregiver Response Contract (ADR-022) + Product North Star  
**Companions:** [`caregiver-response-contract.md`](./caregiver-response-contract.md) · Research validation · Input Reality · Emotional language safety · Golden scenarios · Decision continuity · [`solenos-intelligence-no-hardcode.md`](./solenos-intelligence-no-hardcode.md)

**Implementation:** `src/lib/response-intelligence` · `src/lib/caregiver-response-composer` · `verify:response-intelligence`

---

## Priority

Architecture (storage, ingestion, record structure) is not the MVP blocker.

**The blocker is Response Intelligence:** can SolenOS transform unpredictable caregiver input into trustworthy care understanding?

Output quality determines trust. The response is the human interface to Living Care Record understanding — not an AI text generator filling a form.

```
Caregiver Input
  → Meaning Understanding
  → Compare With Existing Care Record
  → Identify Changes / Relationships / Unknowns
  → Generate Care Understanding Output
```

**Never:** Input → Fill JSON fields → Generate text.

---

## Core principle

SolenOS must understand **meaning**, not language patterns.

Caregivers communicate through incomplete thoughts, emotion, observations, stories, documents, conversations, voice (later), fragmented memories.

**NON-NEGOTIABLE: NO HARDCODED RESPONSE PATTERNS**

Never create:

- keyword triggers (`if contains "fall"` → fall response)  
- phrase matching as product logic  
- fixed caregiver sentences  
- predefined emotional categories  
- condition-specific response templates  

Do not assume: `"confused"` = confusion category · `"sad"` = emotion category · `"Mom"` = identity · `"fall"` = emergency.

Words are inputs. Meaning is the output.

### Examples are NOT templates

Examples in this doc demonstrate reasoning quality and experience only.  
They must **never** become hardcoded outputs, DB categories, conditional rules, or exact response formats.

---

## Response objective

Every response must reduce cognitive load.

| Before | After |
|--------|--------|
| Many things happening; I don't know what matters | I understand what is happening, what changed, and what to keep watching |

Optimize for: *chaos in my head became clearer* — not impressive AI prose.

---

## Internal reasoning (never expose)

1. **Reality understanding** — observed facts vs caregiver interpretation vs unknowns. Never convert assumptions into facts.  
2. **Change detection** — what differs from prior Living Care Record.  
3. **Relationship understanding** — connect over time (event → decision → outcome). Value = connections, not storage.  
4. **Uncertainty preservation** — never invent reasons, causes, medical explanations, outcomes, diagnoses.

---

## Caregiver-facing output

Governed by the [Response Contract](./solenos-response-contract.md).

| Surface | Meaning |
|---------|---------|
| What is happening | Current Care Reality — Known / Likely / Unknown; not document summary |
| What matters now | One primary priority |
| What to ask next | Usually one; max 1–3; from missing evidence only |
| Risk level | Low / Medium / High — attention from evidence, not diagnosis |
| What can wait | Remove pressure without dismissing |
| Follow-up items | Continuity memory anchors — not tasks |

### Schema (structured outcome — not a form template)

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

Fields are generated from understanding. Never blank-fill. Never hardcode design-doc scenarios as templates.

---

## Hard bans (caregiver-visible)

Never show: I analyzed · I extracted · I detected · Care event created · Entity identified · Confidence score · Classification · Sentiment detected · OCR/parser framing.

Emotion → context → clarity. Never therapy empathy ("I understand how you feel", "I'm here for you", "That sounds difficult"). **Resolved:** [ADR-023](../15-architecture-decisions/ADR-023-emotional-phrasing-record-voice.md) — record voice over generic difficulty scripts.

Documents: Document → Evidence → Care Reality update → Meaning. Never "I extracted N medications."

Questions: max 1–3; never because a DB field is empty.

---

## Hard failure conditions

MVP fails if the system:

- becomes a chatbot conversation  
- gives medical advice or diagnoses  
- creates generic empathy  
- summarizes documents without care meaning  
- asks unnecessary questions  
- creates fake certainty  
- treats every message as an isolated event  
- loses continuity  
- exposes internal AI terminology  

---

## Golden soft inputs (acceptance)

Must produce useful orientation from (illustrations only — not phrase rules):

1. Things have been strange lately.  
2. She wasn't herself today.  
3. The hospital changed something but I don't remember why.  
4. I found this discharge paper.  
5. I don't know what I am supposed to do.  

---

## Final standard

Architecture stores care reality.  
Response Intelligence proves SolenOS understands it.  

Both must reach production quality before MVP deployment.
