# SolenOS Visual Language Directive: Care Reality, Not Chat

**Status:** Permanent Product Steward / UX constraint  
**Authority:** Same force as Living Care Record UX (ADR-019) + Response Contract  
**Companions:** Living Care Record UX · Emotional language safety · Response Contract  
**Implementation:** `src/app/globals.css` (care-reality tokens) · `LivingCareRecordPanel` · `CognitiveWorkspace` · `verify:visual-language`

---

## Core principle

SolenOS is **not** a chatbot.

Do not design like ChatGPT, WhatsApp, Messenger, or a messaging app.

The caregiver is not “talking to AI.”  
The caregiver is contributing pieces of a person's care reality.  
SolenOS organizes those fragments into understanding.

**Hierarchy:**

Caregiver → provides observations, experiences, events  
SolenOS → creates structure, connections, and clarity

---

## Color system

Distinguish:

1. Caregiver contributions  
2. SolenOS understanding  
3. Care reality events / changes  
4. Unknowns  

### Forbidden (chatbot chrome)

- Blue user bubbles  
- Gray AI bubbles  
- Message thread styling  
- Assistant persona / avatar  
- Typing indicators  
- “Ask me anything”

### Tokens

| Role | Background | Text | Border / accent |
|------|------------|------|------------------|
| Caregiver contribution | `#F3EFE7` | `#1F2937` | `#E5DDD0` |
| SolenOS understanding | `#FFFFFF` | `#1F2937` | Accent `#52796F` |
| Timeline / events / changes | — | `#1F2937` | Primary `#52796F` |
| Unknowns | `#F3EFE7` | `#1F2937` | Soft — never red alarm |

---

## Surfaces

### Caregiver input

Personal care note — rounded **card**, not a chat bubble.

Feel: *“This is a piece of the care story.”*

### SolenOS understanding

Organized living record — white card, sage accent.

Feel: *maintaining a living record* — not conversation.

### Timeline / events

Sage accent for changes, decisions, outcomes, linked events.

### Unknowns

Warm paper background. Honest uncertainty.

Feel: *“We are keeping track.”* — never *“Something is wrong.”*

No warning reds / alarm language.

---

## Layout

**Avoid:** chat bubbles · AI typing · assistant avatar · ask-anything · conversation history as chat  

**Build:** care cards · timeline · current understanding · changes · decisions · outcomes · unknowns  

Closer to a **shared care record** than an AI conversation.

---

## Home / orientation

Keep:

1. Current understanding  
2. What changed  
3. Still unclear  

---

## Floating action

Keep: **+ Tell us what happened**

Mental model: adding reality — not asking an assistant.

---

## Responsive

**Mobile-first**, then desktop. Care cards and FAB must work on small screens without becoming a chat thread.

---

## Product test

> If we removed all AI labels, would this still feel like a living care record?

Yes → correct.  
Feels like a chatbot without branding → redesign.

**Final:** The caregiver brings the chaos. SolenOS preserves the story.
