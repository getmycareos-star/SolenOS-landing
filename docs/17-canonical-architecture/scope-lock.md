# Phase 4 — Scope lock (hold ~90)

**Status:** Canonical architecture — **ACTIVE** until Phase 5 complete  
**Module:** `src/lib/phase-scope-lock` · **Verify:** `npm run verify:scope-lock` · `npm run verify:golden-scenario-map`  
**Goal:** Prevent regression while Phase 5 builds. Explicit defer list enforced in PR review.

---

## Block until Phase 5 complete

| Deferred surface | Reason | Gate |
|------------------|--------|------|
| **Situation Graph UI** | No graph infra in MVP | `assertPhaseScopeLockNotMvp` |
| **Full `pipeline.ts` reorder** | Product truth path already chose composer (Path A) | `assertPhaseScopeLockNotMvp` |
| **Care Moment / I Need Clarity UI** | Future capabilities ADR | `assertFutureCapabilityNotMvp` |
| **PostgreSQL graph tables as runtime truth** | SCHEMA-ONLY — MVP = ACS + event attributes | `assertPhaseScopeLockNotMvp` |
| **Runtime North Star block on every feature** | Telemetry-first; ADR if enforced at compose | `assertPhaseScopeLockNotMvp` |
| **v1.4 analyze as primary caregiver path** | MVP = `POST /api/situation` composer path | `assertPhaseScopeLockNotMvp` + static verify |

---

## PR review rule (Slice 4.1)

If a PR touches any **deferred surface path**, run:

```bash
npm run verify:scope-lock
```

Deferred paths (prefix match):

- `src/components/mvp-workspace/`
- `src/lib/situation-entry/pipeline.ts`
- `src/lib/caregiver-response-composer/`
- `src/lib/living-care-record-ux/`
- …see `DEFERRED_SURFACE_PATH_PREFIXES` in `src/lib/phase-scope-lock/deferred-surfaces.ts`

Each file is scanned with **`assertFutureCapabilityNotMvp()`** (Care Moment, I Need Clarity, voice, confidence UI) and **`assertPhaseScopeLockNotMvp()`** (graph UI, analyze primary, postgres graph, pipeline reorder).

Also run:

```bash
npm run verify:golden-scenario-map    # Slice 4.2 — all golden IDs mapped + scripts on disk
npm run verify:future-capabilities
npm run verify:phase4-scope-lock      # CI bundle: all three Phase 4 gates
```

If a PR intentionally ships deferred scope → **new ADR** + update this doc and `PHASE_SCOPE_DEFER_LIST` in the same PR.

---

## Allowed now (not deferred)

- Path A spine work (SRE, ACS, CRS, composer, Decision Memory)
- Phase 5 slices (CRS→composer SoT, uncertainty lifecycle, feedback→behavior)
- Internal analyze / v1.4 path for ops — **not** mounted as MVP caregiver primary
- IN-MEMORY ACS/CRS persistence
- Telemetry North Star logging without runtime compose block

---

## Unblock condition

Phase 5 exit criteria met (~93–95 maturity) + explicit ADR per deferred item removed from this list.

**Machine twin:** `PHASE_SCOPE_LOCK` in `src/lib/solenos-layers/architecture-map.ts`
