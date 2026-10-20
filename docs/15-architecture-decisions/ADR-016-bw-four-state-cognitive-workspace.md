# ADR-016 — B&W four-state cognitive workspace UI

**Status:** Accepted  
**Date:** 2026-07-14

## Context

SolenOS product feel is cognitive relief for caregivers — not chat, journaling, or dashboard productivity. Prior UI Runtime mixed observation capture, DecisionCard, timeline, and analyze input in one continuous scroll on a soft gradient shell. Product direction requires a **strict black-and-white, two-panel cognitive workspace** with an explicit four-state progression.

## Decision

1. Primary landing (`src/app/page.tsx`) is a **four-state workspace**:
   - `REAL_MOMENT` → `CARRYING` → `CLARITY` → `CONTINUITY`
2. Desktop layout is **50/50**: left = caregiver input (default black), right = SolenOS clarity (default white). Theme inversion and typography/scale prefs apply instantly via floating accessibility controls.
3. Visual system is **strict B&W** (no gradients, glass, colorful cards, chat bubbles). Premium fonts: Libre Baskerville (serif) + DM Sans (sans).
4. Clarity content is wired to live understanding (`POST /api/situation` / `POST /api/analyze`) plus `/api/extract` for document text. MVP inputs are **text + documents only** (ADR-018) — no voice/Whisper. Envelope fields render throughout; `watch_for` / MAY BECOME SERIOUS derives from backend when present, otherwise from risk-adjacent layers — never fake clinical advice.
5. Sidebar remains **secondary navigation** (calm B&W), not a dashboard.

## Consequences

- UI Runtime DecisionCard / ObservationInput are no longer the primary surface; situation continuity still updates via `applyInferenceCycle` after analyze.
- Document text uses Tika/Tesseract extract helper, not PaddleOCR (gap documented).
- CSS lives in `globals.css` (no Tailwind). Lucide icons for mic/attach/check only.
