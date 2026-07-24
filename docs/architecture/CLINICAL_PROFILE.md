# Clinical Profile Contract

**Status:** IMPLEMENTED (dementia MVP) · FUTURE profiles not shipped  
**Authority:** `src/lib/clinical-profile`  
**Profiles data:** `src/lib/unknowns-engine/profiles/*`  
**Care-context extension:** `src/lib/care-contexts` (`general` | `dementia` | `future_condition`)  
**ADR:** [ADR-005 — Dementia is entry market, not product](../15-architecture-decisions/ADR-005-dementia-entry-market.md)

---

## Stance (non-negotiable)

| True | False |
|------|--------|
| SolenOS **serves** dementia / progressive-dependency families first | SolenOS **is** a dementia diagnosis or FAQ product |
| Dementia is the **first clinical profile** | Architecture is locked to one disease forever |
| Living Care Record is person-specific | Generic “in dementia…” education is caregiver MVP |
| Engines are disease-agnostic | Fork the spine per condition |

**Product:** Care Reality Intelligence / Living Care Record.  
**Entry market:** Dementia caregiving (ADR-005).  
**Near future:** Additional clinical profiles (Parkinson’s, stroke, etc.) via registry + ADR — not a second product.

---

## Dementia-aware MVP (what “ready” means)

1. **Default profile** — Pipelines use `DEFAULT_CLINICAL_PROFILE_ID = "dementia"` from `src/lib/clinical-profile`.
2. **care_context → profile** — `resolveClinicalProfileFromCareContext()` maps recipient `care_context` into Unknowns / continuity (general & future_condition safely default to dementia until registered).
3. **Unknowns** — Dementia unknown categories (nutrition, wandering, sundowning-adjacent signals, etc.) load from `profiles/dementia.ts` without hardcoding FAQ answers into caregiver copy.
4. **Composer influence** — `caregiverAsksFromClinicalProfile` / `caregiverMattersHintFromClinicalProfile` map fired profile categories into Response Contract gather asks and soft What-matters (person/journey language only). Never surface `reason_it_matters`, disease tips, or diagnosis.
5. **Care context extension** — Optional dementia fields (stage, driving, med risk, wandering events) live under `care-contexts/dementia` — ops/devtools and profile APIs, not the primary capture chrome.
6. **Forbidden caregiver paths** — No dementia FAQ chatbot, no “this is common in dementia,” no Alzheimer’s classifier from free text (`forbidden-build-zone`, observation-intelligence bans).
7. **Composer voice** — Speaks Living Care Record language only; never disease encyclopedia tips.

---

## Scalability (nearest future)

To add a condition (e.g. Parkinson’s):

1. New ADR (entry scope + forbidden clinical claims).  
2. Add profile id to `KNOWN_CLINICAL_PROFILE_IDS` in `clinical-profile`.  
3. Add `src/lib/unknowns-engine/profiles/<id>.ts` and register in `CLINICAL_UNKNOWNS_PROFILES`.  
4. Optional `care-contexts/<id>/` extension (same pattern as dementia).  
5. Bind `clinical_profile_id` on care recipient profile when known — until then default remains dementia.  

**Do not:** rewrite ACS, Care Reality State, Composer, or Welcome path per disease.

---

## Caregiver vs ops

| Surface | Dementia language |
|---------|-------------------|
| Caregiver MVP (`mvp-workspace`) | Person / journey / Living Care Record — **no** disease tips |
| Ops / DementiaCareRecordPanel | May show dementia context fields for operators |
| API `/api/care-contexts/dementia` | Profile extension — not the capture UX |

---

## Verify

- `npm run verify:clinical-profile`  
- `npm run verify:dementia-layer` (existing care-context extension)  
- `npm run verify:forbidden-build-zone`  

---

## Related

- [PRODUCT_PRINCIPLES.md](../../PRODUCT_PRINCIPLES.md) — person-specific over generic dementia knowledge  
- [CARE_REALITY_INTELLIGENCE.md](../CARE_REALITY_INTELLIGENCE.md) — reject “is this common in dementia?”  
- [UNKNOWNS_ENGINE.md](../UNKNOWNS_ENGINE.md) — disease-agnostic engine + profiles  

