# SolenOS Output Quality Improvement

**Status:** Permanent Product Steward / MVP output gate  
**Authority:** How Care Reality intelligence is *communicated* — not new feature sprawl  
**Companions:** Final Intelligence Refinement · First vs Returning · Response Contract · Decision Memory · Emotional Language Safety · [`solenos-care-reality-language.md`](./solenos-care-reality-language.md)  
**Implementation:** `src/lib/output-quality` · caregiver-response-composer · Living Care Record panel · `verify:output-quality`

---

## Objective

Architecture direction is correct. The gap is caregiver-facing translation.

| Wrong feel | Right feel |
|------------|------------|
| AI analyzing a message | Care situation evolving |
| Information → Summary | Events → Relationships → Understanding → Confidence |

Do **not** add dashboards or chat. Improve how existing intelligence speaks.

---

## Target scores (communication)

Raise decision memory, relationship understanding, and human language without sacrificing Care Reality understanding or anti-chatbot posture.

---

## 1. Dementia caregiver sensitivity — recognition first

Begin with a short **grounding** statement from the **situation**, not therapy.

Feel: *“The system understands what I am carrying.”*  
Never: generic empathy · reassurance · companionship · “I understand how you feel.”

Recognition = accurate naming of load/uncertainty/competing concerns **from held evidence**.

---

## 2. Human language

**Never** surface as primary caregiver copy: care signal · situation model · memory anchor · understanding layer · care state · engine / pipeline jargon.

Translate internally → plain care language.

Feel: knowledgeable organizer of reality — not software explaining processing.

---

## 3. Relationship understanding

Every new input vs existing Care Reality: prior observations · new observations · decisions · changes · outcomes · uncertainty.

Caregiver should feel: *“This is part of an ongoing pattern.”*  
Never: *“Another isolated note.”*

---

## 4. Decision memory (communication)

When a decision is held, surface:

Decision · Reason · People · Evidence · Outcome · Status  

Value = **why**, not only the action. Never choose for the caregiver.

---

## 5. Trust

Separate clearly:

- **Known** — supported by input / documents / history  
- **Unclear** — needs context  
- **Would improve understanding** — highest-value next information  

Trust = show what is understood **and** what is not yet known. No false certainty / diagnosis.

---

## 6. What matters now

Answer: *“What is the most important thing to understand next?”*  

Prioritize reducing uncertainty over checklists. Prefer relevant change + missing context — never echo the caregiver’s last sentence as the only pillar.

---

## Preferred orientation order

1. Recognition  
2. Current understanding  
3. Connections (how this fits prior care story)  
4. What matters now  
5. What remains unclear  
6. Care story update (what will be remembered)  

---

## Final principle

Never: *“SolenOS summarized what I wrote.”*  
Always: *“SolenOS understands how this moment fits the bigger care story.”*

Evolution: collection → organization → relationships → care reality → decision confidence.

## Never hardcode

Design examples are illustrations only. Derive copy from held evidence.
