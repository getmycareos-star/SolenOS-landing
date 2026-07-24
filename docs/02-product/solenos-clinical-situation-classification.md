# Internal Clinical Situation Classification Layer (SolenOS)

**Status:** Locked architecture directive  
**Authority:** Situation Generator · Care Recipient Anchor · Care Reality Memory · Intelligence Validation · Clinical Profile (disease-agnostic engine)  
**Companions:** [`solenos-situation-generator.md`](./solenos-situation-generator.md) · [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md) · [`solenos-mvp-situation-relationship-architecture.md`](./solenos-mvp-situation-relationship-architecture.md) · [`docs/architecture/CLINICAL_PROFILE.md`](../../architecture/CLINICAL_PROFILE.md)  
**Module:** `src/lib/care-reality-intelligence/clinical-situation-classification.ts`  
**Verify:** `verify:clinical-situation-classification`

---

## Purpose

These categories are **not** features, **not** labels shown to caregivers, and **not** a medical diagnosis system.

They are an **internal reasoning layer** that helps SolenOS understand **what kind of care reality is changing**.

| Wrong question | Right question |
|----------------|----------------|
| What information did the caregiver mention? | What is changing in this person’s care reality? |

---

## Pipeline shift

```
Text → Extraction → Summary     ❌
Text → Situation Classification → Care Reality Model → Human Understanding   ✅
```

---

## Categories (engine-only)

| Internal id | Helps understand |
|-------------|------------------|
| `cognitive_change` | Confusion, memory, orientation, decision-making changes |
| `behavioral_change` | Agitation, withdrawal, personality, resistance to care |
| `safety_concern` | Falls, leaving home, unsafe decisions — understand first, never alarm theater |
| `medication_transition` | New/stopped/changed meds; uncertainty about purpose/effects |
| `functional_decline` | Walking, dressing, cooking, routines, independence |
| `nutrition_hydration_change` | Eating, drinking, appetite |
| `sleep_change` | Sleeping more/less, disrupted patterns |
| `caregiver_strain` | Overwhelm, exhaustion — **context**, never replaces recipient story |
| `family_coordination` | Disagreement, different observation perspectives — **context** unless entire message is coordination |
| `administrative_burden` | Forms, insurance, appointments, navigation |

Examples in this doc are **illustrations only** — never product if-branches on scenario nouns.

---

## Category relationships

Categories must not stay isolated. Connect chains such as:

```
Hospital / medical event → Medication transition → Sleep change → Confusion → Safety concern
```

Intelligence = **relationships**, not category piles.

---

## Priority (when multiple apply)

1. Immediate safety changes  
2. Major functional changes  
3. Cognitive / behavioral changes  
4. Medication transitions  
5. Nutrition / sleep changes  
6. Administrative issues  
7. Family coordination  
8. Caregiver context  

Prevents focusing on low-impact information.

---

## Output rule (non-negotiable)

**Never** show caregivers:

- “Clinical category detected: Cognitive Change”  
- “Risk score: 78%”  
- “Patient declining”  
- Category enums, dashboards, or diagnosis claims  

**Translate** internal categories into human language:

> Several changes appear around the same period. The biggest changes are increased confusion, a recent safety concern, and a medication change. It is still unclear whether these events are connected.

---

## Final principle

The classification layer exists so SolenOS moves from a document analyzer / chatbot toward **care reality intelligence**.
