# Caregiver Response Contract

**Status:** Trust-critical caregiver surface (disclosure + moments)  
**Structural SoT:** [`solenos-response-contract.md`](./solenos-response-contract.md) — every input → same orientation philosophy  
**Intelligence SoT:** [`solenos-response-intelligence-directive.md`](./solenos-response-intelligence-directive.md)  
**Authority:** `src/lib/caregiver-response-composer` (sole caregiver-facing copy) · `src/lib/response-contract`  
**Surfaces:** `LivingCareRecordPanel` only after submit  

**Verify:** `npm run verify:response-contract` · `npm run verify:caregiver-response-composer` · `npm run verify:response-intelligence`  

**ADR:** [ADR-022](../15-architecture-decisions/ADR-022-caregiver-response-contract.md) · [ADR-023](../15-architecture-decisions/ADR-023-emotional-phrasing-record-voice.md) · [ADR-024](../15-architecture-decisions/ADR-024-epistemic-labels-internal-vs-lcr.md) · [ADR-025](../15-architecture-decisions/ADR-025-g61-verify-only-not-compose-gate.md)  
**Decision continuity SoT:** [`solenos-decision-continuity.md`](./solenos-decision-continuity.md)

**Input SoT:** [ADR-018](../15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md) + [Input Entry Contract](./solenos-input-entry-contract.md) — text + Scan/Snap/Upload/Share (**voice out of MVP**)  
**Clinical SoT:** [CLINICAL_PROFILE.md](../architecture/CLINICAL_PROFILE.md) — dementia is MVP entry profile; product is Living Care Record (not a dementia FAQ)

---

## Relationship to Response Contract

The [Response Contract](./solenos-response-contract.md) defines **what understanding every response must produce** (what is happening → matters now → ask → risk → can wait → follow-up).

This document defines **how and when** those fields appear on the caregiver surface (progressive disclosure, moment rules, banned phrasing).

Engine always forms orientation from evidence. UI discloses by maturity — never dumps a chatbot essay.

---

## Demo gate

Do **not** show SolenOS to caregivers until a clean `/welcome` → Begin → 2–3 notes (and optional document) path feels like **relief**, not machinery. Verifies alone are not acceptance.

**Session hygiene (trust):** See [Done for now](./solenos-done-for-now-continuity.md) and [Welcome → Begin](./solenos-welcome-begin-continuity.md). **Begin** starts a new **interaction session** — it must **not** wipe durable care reality for the same identity. Soft / messy notes are routed by the Situation Relationship Engine. Soft `opens_new` retires sticky sidebar titles. **"Done for now" pauses the interaction session only** — it does **not** resolve Active Care Situations. Primary caregiver APIs require an explicit care key / identity — never invent shared `default_caregiver`. Demo care-key minting is not product truth.

---

## Why this is not “MVP quality”

Caregivers are **high-trust sensitive**. One interview-like or wrongly framed response burns credibility. This contract is the bar for every caregiver-visible string — first entry, continuous update, improvement, Done for now, and return visit.

---

## MVP inputs (any messy reality)

| Channel | Rule |
|---------|------|
| **Text** | Fragments are fine — soft mood, unclear notes, mixed concerns. |
| **Scan / Snap / Upload / Share** | Same Living Care Record + Response Contract path; preserve evidence ([Input Entry Contract](./solenos-input-entry-contract.md)). |
| **Voice** | **Out of MVP** (ADR-018). Future — same Response Contract when it lands. |

Messy input is first-class. Design-doc scenarios (falls, hospitals, names) are **illustrations only** — never templates in code.

---

## What the caregiver may see

| Element | Rule |
|---------|------|
| **Held** | One quiet confirmation that this is in the Living Care Record |
| **What we know** | At most 1–2 short facts; **latest note = current state** |
| **Clarity** | Only when disclosure allows: What matters now · What can wait · What may become serious |
| **What changed** | Only on related updates; short; never a restart |
| **Ask** | Only when an understanding gap warrants it (≤3 early / gather; ≤1 later). Never a kind-template quiz. Never an interview list. |

Inspiration bar: [solenosai.netlify.app](https://solenosai.netlify.app) — those three Clarity lines when warranted; omit seriousness when not.

---

## Moment rules

| Moment | Must show | Must not show |
|--------|-----------|---------------|
| First soft / vague mood note (early) | Held + light facts if new; optional calm invite (≤1) | Full Clarity triad · analysis voice · interview list · ChatGPT empathy |
| First care-fact note (any topic, gather incomplete) | Held + short facts + **one context invite** (Step 1) | Premature Clarity · 3-ask dump · keyword quizzes · invented orientation |
| Emotional-only (no care fact yet) | Record-based acknowledge + invite care context ([directive](./solenos-emotional-only-inputs.md)) | Therapy chatbot · CareLoad scores · “I understand how you feel” · false certainty |
| After more context (still incomplete) | Held + updated facts + **2–3 prioritized gap asks** (Step 2) | Clarity before gaps closed · keyword quizzes |
| Related update (**understanding sufficient**) | Held/connected + Clarity from **held facts + answered gaps** | Restarted template · canned wellness theater |
| Guidance demand (“what should I do?”) with held notes **and** enough context | Relief confirmation + held focus + Clarity oriented from held care; **decision preparation** (what happened / changed / known / unknown / may help next conversation) — never recommendation | Question echoed as a Dad/Mom fact · medical advice list · “choose rehab vs home” · empty “Connected…” shell |
| Competing concerns in one note (care + admin + upcoming) | Situation status lanes + orientation — **not** a task/checklist dump ([research validation](./solenos-mvp-research-validation.md)) | Todo list · “three tasks” · productivity chrome |
| Ordinary capture (any care fact) | Held so they need not reconstruct later + what changed / connected when known | “Note created” · empty storage confirmation |
| Guidance demand while appetite gather incomplete | Held + understanding asks first | Clarity dump before context |
| Improvement (“well / happy”) | Related outcome event linked to ACS; current = better; matters = notice if it holds; omit may-become-serious distress; zero “is it resolved?” quiz ([directive](./solenos-improvement-updates.md)) | Premature resolve · old facts as sole “current” · “is the problem over?” form |
| Hard / high-consequence event when latest | Held + fact + ≤1–3 understanding-gap asks first; Clarity faster once linked context lands — never a kind template | Engine dump · false crisis · interview list · phrase if-branches |
| Document Scan/Snap/Upload/Share | Same loop as text: care-reality acknowledgment + understanding; ≤1–3 mapped asks if needed ([directive](./solenos-document-only-inputs.md)) | Document vault UX · “I extracted N…” · OCR/confidence · interview about the file first |
| Done for now | Pause interaction session only; persist ACS, CRS, LCR, evidence, uncertainties, relationships ([directive](./solenos-done-for-now-continuity.md)) | Resolve ACS because of the button · restart-from-zero · make caregiver close threads |
| Continuity Home | Soft return invite once if open Critical gaps; held record + recent; never quiz every visit | Quiz section · “what else matters” prompts · forced answer before continue |

---

## Banned caregiver phrasing

Enforced in `CAREGIVER_RESPONSE_BANNED_PHRASES` + Response Contract never-say. Includes analysis / interview voice, therapy empathy, AI product language (“I extracted…”, “based on my analysis”), advice/diagnosis claims.

---

## Disclosure (panel must obey)

| Stage | Reveal |
|-------|--------|
| **early (soft_gather)** | Confirmation · what we know · ≤1 ask — no Clarity triad |
| **orient_with_gaps** | + what is happening · Clarity triad · ≤1 ask · follow-up |
| **orient_complete / established** | Full orientation · remembered / evidence by maturity |

`LivingCareRecordPanel` **must not** always render Clarity. It renders only what `disclosure_plan` + composer allow.

**Permanent Clarity gate:** `decideReliefDisclosure` (`src/lib/response-contract/relief-decision.ts`) via `understandingSufficient`, **`careWorthyCount`**, and **`latestIsCareWorthy`**. No care-worthy evidence → **awaiting_care_evidence** (invite only). Product meta on a turn with prior care → **product_meta_turn** (no new care-story chrome). Confirmation path: `resolveCareTurnConfirmation` — never “Added to the care story” until `careWorthyCount ≥ 1` and the current turn is care-worthy. **Disclosure merge:** relief tree wins Clarity at `buildLivingCareRecordResponse`; CRS plan is secondary — see [`product-truth-path.md`](../17-canonical-architecture/product-truth-path.md). Soft-only mood notes stay gather-first (G1). Orientable care unlocks Response Contract relief while gaps remain — never product/session meta, never illustration hardcoding.

---

## One writer

Engines (Progressive Understanding, Care Reality State, ACS) **propose state**.  
Only the **Caregiver Response Composer** produces caregiver-facing sentences.  
Continuity Home applies the **same** ask rules (safety-only, max one).

---

## Freeze rule

No Response Behavior / Situation Relationship implementation until the acceptance framework in [`solenos-golden-caregiver-scenarios.md`](./solenos-golden-caregiver-scenarios.md) is the gate (G1–G19 + dementia-critical set + G61).

When implementing (**A**): start with **CareContext → Situation Relationship Engine → CRS → LCR → response**. Do **not** start with prompt patches or UI templates. Encode scenario **behavior**; use Failure Types 1–5 on fails. Obey **No Reconstruction Rule**.

Also: `npm run verify:caregiver-response-composer`, `npm run verify:jennifer-orientation`, and `npm run verify:negated-wellbeing-gather` must stay green. Soft-only incomplete understanding must never show Clarity.

---

## Success

A stressed adult can enter any messy note (or Scan/Snap/Upload/Share evidence) → related update → improvement and leave **more certain, less exhausted** — without reconstructing the care journey from memory.

Feel: *“I understand this situation better.”* — never *“The AI summarized my note.”*
