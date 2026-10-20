# 02 — Product

## What SolenOS is

**IMPLEMENTED** product identity (from `architecture-map.ts`):

> SolenOS IS a caregiver load detection and attention prioritization system — NOT medical advice, dementia diagnosis, or care-plan generation.

Strategic framing (`family-intelligence`):

> SolenOS IS a continuity intelligence system — NOT a task manager, reminder app, or caregiving dashboard.

Behavioral Spec v1:

> Dementia is entry path, not the product. SolenOS models caregiver overload from progressive dependency conditions.

## North Star

1. Detect caregiver load early (cognitive, emotional, sleep, uncertainty, dependency).
2. Prioritize attention (Now / Watch / Later) before tips.
3. Preserve Situation-centric STATE + BELIEF + EXPLANATION continuity.
4. Explain decisions; reduce guilt; prevent compounding mistakes.
5. Compound family intelligence assets over time (see `16-investor-technical-diligence`).

## Anti-patterns (must never ship as primary output)

From `V14_ANTI_PATTERNS` / observation / load contracts:

- Medical diagnosis or symptom checker as primary output
- Disease encyclopedia / neuroscience education as the product
- Care-plan generator or clinical decision support as MVP deliverable
- Leading with dementia tips when caregiver load is detected
- ChatGPT-style ten tips when load signals are present
- Diagnosing dementia/Alzheimer’s from observations
- Predicting disease timeline from observation frequency

## Product surfaces (honest)

| Surface | Status | Path |
|---------|--------|------|
| MVP input (text + documents) | IMPLEMENTED | `AddSituationPanel` → `/api/extract` + `/api/situation` (ADR-018) |
| Analyze / clarity loop | IMPLEMENTED | `POST /api/analyze` → `analyze-pipeline` |
| Observation Intelligence (text) | IMPLEMENTED (parallel) | `POST/GET /api/observations*` |
| Voice Observation Capture | FUTURE | `POST /api/observations/voice` — unmounted (ADR-018) |
| TTS / Hear SolenOS | FUTURE | `POST /api/tts/synthesize` + browser synthesis — unmounted |
| Identity continuity | IN-MEMORY stub auth | `/api/identity/*` |
| Human override | STUB | `/api/human-override` |
| Support signal evaluate | IMPLEMENTED (rules) | `/api/support-signal/evaluate` |
| Feedback telemetry | IMPLEMENTED (store-dependent) | `/api/feedback` |

### MVP Input Architecture (ADR-018)

**Proof:** Can SolenOS turn scattered caregiver information into understandable next steps?  
**Channels:** Documents (PDF, image, camera + OCR) and text (type / paste) only.  
**Not MVP:** voice input, STT, TTS, Whisper, voice APIs, conversation mode.  
**Pipeline stays generic:** User Input → Understanding → Care Record (voice later).

### Voice (FUTURE)

Libraries under `src/lib/voice*` / `src/lib/tts*` remain as plug-in contracts. Do not mount mic or Hear SolenOS in live MVP UI.

## Documents in this section

| Doc | Role |
|-----|------|
| [solenos-input-reality-directive.md](./solenos-input-reality-directive.md) | **Product Steward** — anything can enter the same Care Reality layer; Decision Memory fields; before→after continuity; evidence depth; source priority |
| [solenos-input-entry-contract.md](./solenos-input-entry-contract.md) | **Permanent** — Scan/Snap/Upload/Share single responsibility; same pipeline after evidence |
| [solenos-situation-relationship-directive.md](./solenos-situation-relationship-directive.md) | **Product Steward** — Situation Relationship Engine + Situation Graph (not keyword same/new) |
| [solenos-evidence-visibility-directive.md](./solenos-evidence-visibility-directive.md) | **Product Steward** — evidence as trust layer; Person timeline spine (not Documents→Summaries); visibility by consequence (L1→L10) |
| [solenos-mvp-situation-relationship-architecture.md](./solenos-mvp-situation-relationship-architecture.md) | **MVP architecture** — Understanding → SRE → Decision Memory → LCR; reject document-summary path; graph viz later |
| [solenos-mvp-research-validation.md](./solenos-mvp-research-validation.md) | **MVP validation** — cognitive load / external memory; retention hypothesis; boundary; engineering priority |
| [solenos-response-intelligence-directive.md](./solenos-response-intelligence-directive.md) | **MVP blocker** — Response Intelligence; meaning over patterns; no keyword responses; golden soft inputs |
| [solenos-trust-consent-flow.md](./solenos-trust-consent-flow.md) | **Permanent** — trust/legal/consent; Privacy & Terms visible; signup checkboxes; no legal wall |
| [solenos-done-for-now-continuity.md](./solenos-done-for-now-continuity.md) | **Permanent** — Done for now = pause session; engine owns situation lifecycle |
| [solenos-welcome-begin-continuity.md](./solenos-welcome-begin-continuity.md) | **Permanent** — Begin = new interaction session; durable care reality restored by identity |
| [solenos-open-uncertainties-return.md](./solenos-open-uncertainties-return.md) | **Permanent** — open gaps persist; soft one-time return invite; no interrogation |
| [solenos-first-time-caregiver.md](./solenos-first-time-caregiver.md) | **Permanent** — first Begin: light orientation then capture; no fake continuity |
| [solenos-first-vs-returning-user.md](./solenos-first-vs-returning-user.md) | **MVP intelligence** — new = begin care story; returning = compare to held memory |
| [solenos-output-quality.md](./solenos-output-quality.md) | **MVP output** — recognition, human language, connections, decision why; not AI summary |
| [solenos-response-intelligence-upgrade.md](./solenos-response-intelligence-upgrade.md) | **MVP transformation** — six-section response structure; acceptance gate rejects summarization / fake continuity |
| [solenos-mvp-response-behavior.md](./solenos-mvp-response-behavior.md) | **MVP behavior** — Care Reality Object pipeline; orientation not advice; examples are evaluation only |
| [solenos-mvp-reasoning-examples.md](./solenos-mvp-reasoning-examples.md) | **Evaluation only** — reasoning patterns 1–22; never product if-branches or keyword templates |
| [solenos-mvp-input-experience.md](./solenos-mvp-input-experience.md) | **MVP entry** — Snap/Scan/Upload/Share same pipeline; no auth before value; understand-better metric |
| [solenos-learning-first-release.md](./solenos-learning-first-release.md) | **Research preview** — learning over polish; post-response feedback; reliability non-negotiables |
| [solenos-care-reality-engine-principles.md](./solenos-care-reality-engine-principles.md) | **Frozen MVP** — Care Reality Engine reasoning contract; LCR source of truth; new vs existing care record |
| [solenos-communicate-understanding.md](./solenos-communicate-understanding.md) | **Output contract** — caregiver-facing understanding, not document/chat summarization |
| [solenos-document-only-inputs.md](./solenos-document-only-inputs.md) | **Permanent** — documents = same Care Reality loop; never analyzer UX |
| [solenos-long-thread-ingestion.md](./solenos-long-thread-ingestion.md) | **Permanent** — long chats/emails = multiple linked events; preserve source |
| [solenos-emotional-only-inputs.md](./solenos-emotional-only-inputs.md) | **Permanent** — emotional-only: acknowledge + invite care context (A) |
| [solenos-emotional-language-safety.md](./solenos-emotional-language-safety.md) | **Permanent** — never CareLoad/burnout/sentiment scores in UI |
| [solenos-emotional-response-language.md](./solenos-emotional-response-language.md) | **Permanent** — not ChatGPT empathy; record-based; low first-person |
| [solenos-improvement-updates.md](./solenos-improvement-updates.md) | **Permanent** — improvements = linked outcome events; never one-day resolve |
| [solenos-mvp-identity-model.md](./solenos-mvp-identity-model.md) | **MVP** — one care recipient per Care Reality; caregiver = contributor |
| [solenos-mvp-collaboration-model.md](./solenos-mvp-collaboration-model.md) | **MVP** — shared Care Reality + attribution; not family chat |
| [solenos-mvp-identity-naming.md](./solenos-mvp-identity-naming.md) | **MVP** — ask once for display name; never silent inference |
| [solenos-decision-continuity.md](./solenos-decision-continuity.md) | **Permanent** — Decision Memory + continuity spine; prep not advice; documents as evidence (Phase 3.4 SoT) |
| [solenos-golden-caregiver-scenarios.md](./solenos-golden-caregiver-scenarios.md) | **Gate** — Acceptance framework G1–G61; No Reconstruction; No Prompt Patch; G61 2AM test |
| [caregiver-response-contract.md](./caregiver-response-contract.md) | **Trust-critical** caregiver-facing copy SoT (ADR-022) |
| [solenos-response-contract.md](./solenos-response-contract.md) | **Permanent** — Response Contract fields; orientation not chatbot; no hardcoded examples |
| [solenos-care-reality-engine-foundation.md](./solenos-care-reality-engine-foundation.md) | **MVP foundation** — Phases 1–13 Care Reality Engine; moat = messy evidence → coherent reality |
| [solenos-final-intelligence-refinement.md](./solenos-final-intelligence-refinement.md) | **MVP intelligence** — structure not echo; baseline→change; Observed/Interpretation/Concern; no UI-first |
| [solenos-visual-language.md](./solenos-visual-language.md) | **Permanent UX** — Care Reality cards, not chatbot; mobile-first |
| [prds/](./prds/) | Module PRDs (Care Graph, Case Memory, CareLoad, Confidence, Crisis, Voice Observation) |
| [ux-decision-surface.md](./ux-decision-surface.md) | How “what should I do now?” is generated |
| [system-learning-metrics.md](./system-learning-metrics.md) | Intelligence flywheel / feedback loop |

## Legacy root docs

Historical product contracts remain in `docs/PRODUCT_*.md`, `docs/CANONICAL_*.md`. Prefer updating this folder + PRDs for new work.
