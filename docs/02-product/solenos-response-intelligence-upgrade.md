# SolenOS Response Intelligence Upgrade (Strict Engineering)

**Status:** Permanent · Non-negotiable transformation-layer gate  
**Authority:** Care Reality Model → caregiver response (NOT UI copy)  
**Companions:** Response Contract · Output Quality · Final Intelligence · First vs Returning · Decision Memory  
**Implementation:** `src/lib/response-acceptance-gate` · `caregiver-response-composer` · `verify:response-intelligence-upgrade`

---

## This is NOT a UI copy task

Extraction works. The failure is the **transformation layer** between internal Care Reality and caregiver-facing response.

Do **not** add features. Do **not** redesign the app. Improve how existing intelligence is **represented**.

---

## Non-negotiable principle

SolenOS is **not:** chatbot · summarizer · notes app · task manager · medical answer engine  

SolenOS **is:** a Living Care Record building evolving care reality understanding.

Every response moves: **Events → Relationships → Understanding → Confidence**

---

## Response generation rules

1. **Never raw AI analysis** — feel: *how this fits the bigger care story* — never *the AI analyzed my message*  
2. **Never internal architecture language** — care signal · memory anchor · state model · entity recognition · confidence score · processing language  
3. **Recognition before organization** — situation-grounded; never generic empathy scripts  

---

## Required structure (transformation output)

| # | Section | Purpose |
|---|---------|---------|
| 1 | **Recognition** | Situation understood (1–2 sentences; do not repeat whole message) |
| 2 | **Current understanding** | Known facts vs unknowns from input/docs/history |
| 3 | **Connections** | How this relates to prior care memory — not an isolated note |
| 4 | **What matters now** | Most important next **understanding** — not a task list |
| 5 | **What remains unclear** | Preserve uncertainty; no false certainty |
| 6 | **Care story update** | What is preserved for future continuity |

Disclosure may withhold sections early — but the transformation layer must **produce** them when evidence allows.

---

## New user (no care memory)

Must **not** fake continuity. Create first layer: care record · observation · timeline · uncertainty.  
No onboarding forms. Questions only when they improve the care model (timeline · change from usual · context · pattern · impact).

---

## Returning user (care memory exists)

Must **not** restart. Compare: *What changed from what we already know?*  
Retrieve history · detect change · patterns · unresolved areas · update memory.

---

## Decision memory (mandatory when decisions appear)

Surface: Decision · Reason · Participants · Evidence · Outcome · Status  
Value = **why**, not storage alone.

---

## Trust

Separate: **Known** · **Unknown** · **Next understanding step**

---

## MVP acceptance

Caregiver can answer from output:

1. What is happening?  
2. What changed?  
3. How does this connect with previous events?  
4. Why were decisions made?  
5. What remains uncertain?  

---

## Failure conditions (reject output)

- ChatGPT summarization / echo without understanding  
- Medical conclusions or generic advice  
- Task-list what-matters-now  
- Ignores history when memory exists  
- Fake continuity when no memory  
- Stores facts without relationships  
- Internal jargon in caregiver copy  

---

## Final engineering test

Not: *Did SolenOS answer?*  

Yes: *After months of use, can SolenOS reconstruct care evolution and explain how the family got here?*

Build the **Care Reality Engine**, not an AI assistant.

Examples in docs = illustrations only — never hardcoded product logic.

---

## Contract risk → caregiver attention (enforced)

`contract_output.risk_level` (Low/Medium/High) must reach disclosure as **human attention language** — never scores, %, or `risk_level` chrome.

- Helper: `src/lib/response-intelligence/attention-label.ts`
- LCR fields: `risk_level` (engine) + `attention_label` (caregiver) + `disclosure_plan.show_attention_level`
- Gate: Low quiet on early capture; Medium/High may show
- Verify: `verify:response-contract` · `verify:response-intelligence-upgrade`
