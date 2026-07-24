# SolenOS Language Safety Rule — Emotional Support Responses

**Status:** Permanent caregiver-facing language ban  
**Authority:** Product Steward  
**Companions:** [`solenos-emotional-only-inputs.md`](./solenos-emotional-only-inputs.md) · [`solenos-emotional-response-language.md`](./solenos-emotional-response-language.md) · [ADR-023](../15-architecture-decisions/ADR-023-emotional-phrasing-record-voice.md)

---

## Rule

> Never expose internal system interpretation when responding to caregiver emotions.  
> Show **understanding**, not **classification**.

Internal concepts may exist in the backend. The caregiver should only experience: recognition · continuity · clarity · support.

Never: diagnosis · labeling · scoring · surveillance.

---

## Never appear in caregiver UI

- CareLoad / Caregiver Load Signal  
- Burnout Risk / Stress Level  
- Emotional Classification / Sentiment Analysis / Detected Emotion / Emotional State  
- Mental Health Signal  
- Distress Score / Overwhelm Score / Risk Score (for emotions)  
- User State / User Profile Signal  
- Behavioral Pattern Detected / Pattern Recognition / Classification  
- Analysis Complete / AI Assessment / Confidence Score / Prediction / Inference  
- “Model thinks” / “The system believes” / “The AI noticed” / “Algorithm detected”

### Never say

- "Your burnout risk appears high."  
- "Your emotional state has been detected."  
- "SolenOS identified caregiver distress."  
- "Your stress level has increased."  

These make the caregiver feel **observed by a machine**.

---

## Prefer (human, experience-based — **not composer copy**; see ADR-023)

Illustrations for support writing and tone guidance only. **Composer uses record-based recognition** — never these as keyword triggers.

- "It sounds like a lot is happening right now."  
- ~~"That sounds difficult to carry."~~ → use record voice: "You mentioned…"  
- "I can help you organize what has been happening." *(prefer record voice where possible — see response language directive)*  
- "Tell me what changed or what is making today difficult."  
- "Let's capture what is happening so the important details are not lost."  

---

## False emotional certainty

Do **not** say: "I know you are exhausted."  

Better: "You mentioned feeling exhausted."  

SolenOS does not “know” — the caregiver said it. That distinction protects trust.
