# ADR-019 — Living Care Record UX (AI invisible)

## Status

**Accepted** — 2026-07-16

## Context

Caregivers must feel they are updating and understanding a Living Care Record — not conversing with an AI assistant or reading how a model thinks. Engine dumps, percentages, crisis keyword false-positives, and internal terms (`partial_signal`, `ambiguous_extraction`, etc.) increase cognitive load.

## Decision

### Product identity in every response

- **Product:** Living Care Record  
- **AI:** Internal capability only — almost invisible in the UI  

After each interaction caregivers should think: *SolenOS understood what happened and knows what it still needs.*

### Default response (four sections only)

1. **Care Event Added** — preserved in the record (date, event, related care, status)  
2. **What I Understood** — short human facts (not long AI summaries)  
3. **What Still Needs Context** — event-specific questions only  
4. **What Will Be Remembered** — how the record strengthens over time  

## Active Care Situation (required)

Related caregiver observations must **update** an evolving Active Care Situation — not restart a new template each message.

Internally evaluate: new situation? update? answers uncertainty? adds context? changes understanding?

`What Seems To Be Happening` / `What Matters Now` appear only after enough related evidence (synthesizing stage). Caregiver UI labels this **What matters** (plain pillars) — never a **Clarity** analysis-mode heading that makes the AI feel visible.

Module: `src/lib/active-care-situation`

### ACS persistence (server-side)

Active Care Situation is ingested inside `processSituationInput` under the durable care key, returned on POST as `active_care_situation` / `active_care_situation_turn`, and hydrated on GET `/api/situation`. “Done for now” pauses via `POST /api/situation` with `action: "pause_active_care_situation"`. Living Care Record UI projects the server turn — it does not own ACS persistence.

**Durability:** CareContext and ACS are written through to `.data/care-context/` and `.data/active-care-situation/` (same pattern as consent). Process Maps are cache only. A server bounce must reload the Living Care Record from disk — memory is not the source of truth. TrackedSituation (sidebar) hydrates from CareContext after reload.

### CareContext spine linking

Related observations still **append** as separate CareEvents (raw text is never merged away). Before append, the server classifies relation (`opens_new` | soft updates) and stamps each event with:

- `situation_id` — evolving Active Care Situation id  
- `root_event_id` — first CareEvent of that situation (soft updates share this root)

Hard new incidents open a new `situation_id`. Soft updates attach to the open situation. Groups are available as `care_situation_groups` on POST/GET. Module: `src/lib/active-care-situation/spine-link.ts`.

**Relation ownership:** Classification is **server-owned** from Active Care Situation state + content (`classifySituationRelation`). Soft same-day notes default to update even when outside the 12h ACS window. Client `entryIntent` / composer mode must not decide relation — UI may still use update framing for copy when CareContext exists.

## Progressive disclosure

Caregiver UI shows Living Care Record sections only (+ optional original notes).

Engine panels, confidence percentages, system layers, and internal terms are **not rendered** in the caregiver workspace. They belong in logs / ops tooling only.

### Uncertainty pipeline (DARE → situation boundary)

Internal DARE reasons (`ambiguous_extraction`, bare schema fields like `entity` / `time`, `Provisional: … (reason)`) are **never** written into caregiver response DTOs (`what_is_uncertain`, clarifiers, `open_uncertainties`).

Humanize at the DARE → situation boundary via `src/lib/situation-entry/caregiver-facing-uncertainty.ts`. `finalizeSituationResponse` sanitizes again as the choke point. Verify bans signal tokens on response DTOs (`CAREGIVER_RESPONSE_BANNED_TOKENS`).

### Entry loop copy

Composer CTA is **Add to record** (not Send). Loading is **Preserving…**; documents show **Reading document…**. Errors pass through `sanitizeCaregiverErrorMessage` so engine tokens (`CareEvent`, `PolicyEngine`) never appear.

### Done for now (pause, not restart)

“Done for now” is a **UI pause** only — it does **not** clear or resolve the Active Care Situation. ACS, CRS, LCR, evidence, uncertainties, and relationships persist. Composer framing stays update-oriented whenever CareContext exists. First-visit “Dump the mess” copy is only for true new records (no CareContext) or an explicit empty reset. See `solenos-done-for-now-continuity.md` and ADR-022.

### Session identity (one durable care key)

MVP uses one durable care key on all writes: `caregiver_id` (= `care_session_id`). `/api/situation` upserts **TrackedSituation** under that key. Sidebar Open situations hydrate from GET `/api/situation` (CareContext → groups / ACS / TrackedSituation), not from a disconnected local-only Situation store.

### Caregiver chrome (not ops console)

Default sidebar is Living Care Record continuity only: **Open situations**, **Care timeline**, **About SolenOS**. System Health, Responsibility Graph, and other instrumentation stay behind an ops gate (`?ops_key=` → `/api/ops/access` with `OPS_SECRET`). Open situations use plain-language titles from real CareContext / `care_situation_groups` / ACS — never an empty ops list while notes exist.

Module: `src/lib/care-identity` · sync: `src/lib/resolution-engine/care-context-sync.ts` · open list: `src/lib/ui-runtime/open-situations.ts`

### Medical boundary (capture always)

Worry language (“is this serious?”, med-change questions) and mixed overwhelm **never refuse intake**. Capture always; constrain outputs/answers via PolicyEngine. Principle: `POLICY_CAPTURE_ALWAYS_PRINCIPLE`.

### Consent (soft-prompt after capture)

Missing consent **must not** block CareEvent creation. Always persist raw input into the Living Care Record, then soft-prompt privacy terms. Consent gates interpretation and sharing (`interpretation_gated` / `sharing_gated`), not capture. UI shows ConsentGate after the note lands — never an error that discards the first chaotic note.

### Crisis false positives

Bare “fall”, soft “help me”, and “urgent” do **not** enter crisis mode. Fall-as-crisis requires immediacy or severity (`isAcuteCrisisFall`). Retrospective reports (past fall + urgent care already sought) stay calm continuity capture.

### One caregiver entry pipeline

Caregiver MVP entry is **POST `/api/situation` only**. `CognitiveWorkspace` must not call `/api/analyze`, Clear My Head, or Continuity-to-Clarity. `/api/analyze` remains an ops/engine path hard-gated behind `SOLENOS_ENABLE_ANALYZE=1`, `SOLENOS_VERIFY=1`, or a valid `x-solenos-ops-key`. Gate: `src/lib/analyze-pipeline/caregiver-entry-gate.ts`.

### First-time welcome (required)

First-time caregivers land on **`/welcome`** before the Living Care Record workspace. The welcome home states what SolenOS solves (what matters, what can wait, what to ask, what may become serious). CTA `/?enter=1` marks entry and opens the care workspace. Returning caregivers with an entered record or existing situations skip welcome. Module: `src/lib/care-entry`.

### Progressive Understanding Engine (P0)

Related observations must not restart the caregiver response. After Active Care Situation relation is known, `processProgressiveUnderstanding` (`src/lib/progressive-understanding`) evolves synthesis, what matters, questions, and **`what_changed_in_understanding`**. ADR-020. Verify: `npm run verify:progressive-understanding`.

### Care Reality State + Response Evolution + Disclosure (P0)

After Progressive Understanding, `updateCareRealityState` (`src/lib/care-reality-state`) is the single source of truth for what solenos currently believes. Response Evolution (P0-9) runs before copy; Progressive Disclosure (P0-10) reveals early / growing / established sections only. Caregiver responses project from Care Reality State — never the latest message alone. Product identity P1 contracts live in `src/lib/product-identity-architecture`. ADR-021. Verify: `npm run verify:care-reality-state`.

### Dead Clarity path (quarantined)

Caregiver workspace states are **only** `REAL_MOMENT` → `CARRYING` (Living Care Record). `CLARITY` / `CONTINUITY` are removed from `WORKSPACE_STATES` and must never be entered by `CognitiveWorkspace`. Clarity dump UI (`ClarityPanel`, `ReasoningSection`, legacy `CarryingPanel`, `ContinuityPanel`, `FinalOutputPanel`, `CareContinuityPanel`) lives under `src/components/ops-clarity` and is indexed at `/ops/clarity?key=…` — not caregiver-reachable.

### Secondary engine panels (quarantined)

Engine / secondary panels (TrustProvenance, ClarificationEngine, ContinuityDecay, RealMoment dump, ObservationPanel “signals”, etc.) live under `src/components/ops-devtools` and `/ops/devtools?key=…`. `mvp-workspace` may only contain the Living Care Record caregiver allowlist (`CAREGIVER_MVP_WORKSPACE_FILES`). Caregiver `CognitiveWorkspace` must never import `ops-devtools` or `ops-clarity`.

### Regression verify coverage (required)

Happy-path ACS/LCR verifies are insufficient. `npm run verify:living-care-record-regression` must cover:

1. **Refresh persistence** — CareContext + ACS survive Map-clear bounce via `.data/` and soft updates continue  
2. **CareContext ↔ ACS link** — `situation_id` / `root_event_id` / `care_situation_groups` stay aligned (soft same-day update; hard opens new)  
3. **DTO sanitizer** — `continuity_home`, aha/post_entry, situation uncertainty fields, and Living Care Record views ban schema/engine tokens  
4. **Crisis false positives** — retrospective fall, bare fall, soft help, urgent paperwork, worry language, soft emotion must not enter crisis mode  

Guards: `src/lib/living-care-record-ux/dto-sanitizer-guards.ts`.

### Text and documents

Same four-section contract for typed notes, pasted text, PDFs, images, and camera captures.

### Context before urgency

Do not enter crisis UI from keywords alone when the report is retrospective / care already sought.

## Consequences

- Module: `src/lib/living-care-record-ux`  
- UI: `LivingCareRecordPanel` is the primary surface in `SituationResponsePanel`  
- Architecture map: `LIVING_CARE_RECORD_UX`  

## References

- Product constitution / Living Care Record foundation  
- ADR-018 (MVP input: text + documents)
