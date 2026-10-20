# Generalized Care Understanding Rules (SolenOS)

**Status:** Locked intelligence-layer behavior  
**Authority:** Care Reality Engine · Intelligence no-hardcode · Care Signal Understanding · Response Contract  
**Module:** `src/lib/generalized-care-understanding`  
**Verify:** `verify:generalized-care-understanding`

---

## Implementation rule

Examples in docs are **illustrations only**.

Do **not** hard-code:

- specific words · tasks · medical situations · categories · canned response outputs  

Do **not** build: `If input contains pharmacy → medication task.`

Build generalized reasoning:

```
Caregiver language → Meaning → Care signals → Current care understanding → Appropriate next steps
```

---

## Core principle

SolenOS is a **care understanding engine**, not a task extractor.

Messy thoughts, observations, worries, incomplete memories, responsibilities, questions, and fragments are all valid input.

---

## Ten core rules (behaviors)

1. Semantic understanding over keyword matching  
2. Extract care-reality signal **concepts** (event, change, decision, observation, responsibility, concern, unknown) — not fixed UI categories  
3. Build and update living care state against prior record  
4. Identify importance dynamically (impact, urgency, change, uncertainty — not “sounds like a task”)  
5. Detect what can wait  
6. Follow-up questions only when they change next understanding  
7. Maintain open loops — never guess  
8. Connect information across time  
9. Separate Observed · Derived · Unknown — never present inference as fact  
10. Preserve human context (load/capacity) without therapy-chatbot behavior  

---

## Additional intelligence behaviors (1–15)

General reasoning — never keyword products:

1. Context reconstruction (who / situation / time / lifecycle / prior links)  
2. Contradiction detection — preserve previous + new + interpretation; never overwrite  
3. Recency awareness  
4. Escalation awareness (combined signals → attention, not diagnosis)  
5. Caregiver workload modeling (unresolved concerns ≠ task count)  
6. Information reliability (observation vs reported vs document vs inferred)  
7. Source attribution (who / when / observed vs reported)  
8. Decision readiness — clarify missing info before recommending  
9. Outcome tracking (event → response → outcome → learning)  
10. Memory importance filtering (temporary / important / long-term)  
11. Personalization through history — no generic assumptions  
12. “Why does this matter?” before surfacing  
13. Avoid cognitive overload — clarity over completeness  
14. Confidence calibration (high / medium / low) — never hide uncertainty  
15. Continuous learning loop — every input improves the care record  

Module field: `generalized_care_understanding_layer.additional`  
Verify covers these behaviors in `verify:generalized-care-understanding`.

---

## Internal processing (every input)

1. What information was provided?  
2. What does it reveal about the care situation?  
3. What changed?  
4. What is important?  
5. What is uncertain?  
6. What should remain in memory?  
7. What needs follow-up?  
8. How does this update the person’s care state?  

---

## Caregiver UI

Never expose: Observed/Derived labels as chrome · open-loop engine ids · “care signal” · task-list framing.

---

## Composition

Uses Care Reality extraction + Care Signal Understanding. Wired on `situation-entry` as `generalized_care_understanding_layer`.
