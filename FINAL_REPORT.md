# SolenOS — Canonical Runtime Repair Report

## A. Scope

This report covers the repair and verification of the canonical Python/FastAPI backend runtime path:

`POST /api/situation` → evidence → change detection → situation formation → significance → safety → persistence → API response

The frontend, voice/audio, and unrelated product surfaces were not part of this repair.

---

## B. Repairs Implemented

### 1. Database model registration (`app/core/database.py`)
- Added imports for `app.models.safety`, `app.models.memory`, and `app.models.time_location` so their tables are created by `Base.metadata.create_all()`.
- Result: `safety_decisions`, `learning_events`, `observations`, `reasoning_memory`, `care_windows`, and `appointments` tables now exist in the database.

### 2. Temporal fabrication removed (`app/services/situation.py`, `app/models/care.py`)
- `CareEvent.occurred_at` is now nullable.
- When the supplied timestamp is invalid, missing, or unparsable, `occurred_at` is persisted as `None` instead of `_utc_now()`.
- `SituationEvent.occurred_at` is now optional to reflect unknown time.
- Temporal facts now allow `confidence=None` when no basis exists to calculate it.

### 3. Fabricated confidence removed (`app/services/situation.py`, `app/services/learning.py`, `app/services/safety.py`, `app/services/temporal_intelligence.py`)
- Removed hardcoded fallbacks: `0.7`, `0.5`, `0.9`.
- Evidence confidence remains `None` when unknown.
- Safety `EvidenceReference.confidence` is now optional and the SafetyEngine handles `None` gracefully.
- CareEvent confidence is derived from actual change confidence or `None`.
- Temporal fact confidence is derived from actual evidence or `None`.

### 4. Evidence status derived from source type (`app/services/situation.py`)
- Evidence status is derived from the actual source type rather than blindly assigned.
- Caregiver observations and document text remain `reported`, never `confirmed` or `observed-as-fact`.

### 5. Contradiction detection wired into the main path (`app/services/situation.py`)
- `_record_contradictions()` now runs on every new input and compares against recent prior events.
- Conflicting reports are preserved as `ContradictionModel` records with `resolution_status="unresolved"`.
- Contradiction detection handles offset-naive vs offset-aware datetimes correctly.

### 6. Safety gate integrated and persisted (`app/services/situation.py`, `app/models/safety.py`, `app/core/database.py`)
- `SafetyEngine.evaluate()` executes on every input.
- Safety decisions are persisted to `safety_decisions` (the table now exists because the safety model is imported).
- Safety evaluation runs before derived conclusions are finalized.
- Runtime verification: safety decisions for ALLOW, REQUIRE_MORE_EVIDENCE, and REQUIRE_HUMAN_REVIEW were all observed in the database.

### 7. Persistence error handling fixed (`app/services/situation.py`)
- Removed the `db.rollback(); db.add(care_event); db.flush(); db.commit()` pattern from downstream error handlers.
- Downstream failures now add explicit warnings without losing already-committed evidence or care event data.

### 8. Correction propagation verified (`app/services/learning.py`)
- `apply_correction()` invalidates dependent derived state and recomputes Change/Situation state.
- Runtime verification: correcting a CareEvent updated its title/description and recomputed its derived `situation_id` and flags.

### 9. Document processing module restored (`app/services/document_processing.py`)
- The missing module required by `app.api.files` / `app.main` was implemented.
- Supports TXT, PDF, DOCX, and image OCR processing with confidence tracking and error reporting.
- Runtime verification: document upload tests pass through the full pipeline.

### 10. Integration test discovery fixed (`tests/test_integration_runtime_path.py`)
- Renamed `integration_test_runtime_path.py` to `test_integration_runtime_path.py` so pytest collects it.
- Tests use isolated in-memory databases and clean teardown.

---

## C. Verification Results

### Backend tests
- `python -m pytest tests/ -q`
- **239 passed, 0 failed** (includes 4 integration tests and document upload tests)
- Collected: 239 tests

### Runtime verification (actual HTTP endpoint via TestClient)
- XCOM-001 baseline: **PASS** — evidence created, care event created with correct timestamp, change detected, situation created, safety decision persisted, response `ok=true`.
- Generalization cases (simple observation, medication report, temporal uncertainty, structured observation): **PASS** — all processed without warnings, raw text preserved verbatim.
- Temporal uncertainty cases (invalid timestamp, relative/uncertain statement, missing timestamp): **PASS** — `occurred_at=None` persisted, no current-time fabrication.
- Contradiction case (different reporters, conflicting sleep reports): **PASS** — `ContradictionModel` records created with `resolution_status="unresolved"`.
- Safety cases (causal overreach, diagnostic overreach): **PASS** — safety decisions persisted as `REQUIRE_MORE_EVIDENCE` / `REQUIRE_HUMAN_REVIEW` with violations recorded.
- Correction propagation: **PASS** — correction updated the CareEvent and recomputed derived `situation_id` and flags.

### Database verification
- Evidence: source text preserved verbatim, `source_type` set from actual source, `confidence=None` when unknown, `evidence_status="reported"` for caregiver reports.
- CareEvent: correct `occurred_at` for valid timestamps, `None` for unknown timestamps, caregiver attribution preserved.
- Safety: decisions persisted with risk class, state, violations, and rationale.
- Temporal: facts persisted with `confidence=None` when unknown, no fabricated current time.
- Contradictions: persisted with unresolved status and evidence linkage.
- Learning: correction events and reasoning memory persisted.

---

## D. Remaining Limitations

- The canonical runtime does not currently implement structured medication extraction beyond preserving the raw medication text in evidence. Medication identity/dose/frequency details are not decomposed into structured fields.
- Structured observations (e.g., blood pressure 168/92) are preserved verbatim in evidence but not decomposed into typed observation/value/unit fields.
- Multi-caregiver attribution within a single input is limited to the single `caregiver_id` in the request payload; the schema does not yet support multiple reporters per input.
- Frontend, voice/audio, and unrelated product surfaces remain out of scope for this repair.

---

## E. Documentation Accuracy

This report reflects the actual verified state of the canonical backend runtime after repair. Claims about frontend implementation or full temporal intelligence integration are not made.
