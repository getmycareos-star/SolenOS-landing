# SolenOS Documentation Governance

**Documentation is a first-class system asset.** Code without documentation is incomplete.

SolenOS is **continuous intelligence for family responsibility, caregiving, and crisis prevention** — not a feature product. Continuity over features; understanding over speed; safety over output; clarity over abstraction; compounding intelligence over static functionality.

## Non-negotiable Completion Rule

A feature or change is **complete only when all apply**:

1. **Code implemented** and behaves as designed
2. **Tests / verify scripts pass** for affected modules
3. **Docs updated** under the numbered folders below
4. **Canonical architecture updated** if architecture is affected (`17-canonical-architecture/` **and** `src/lib/solenos-layers/architecture-map.ts`)
5. **PRDs updated** if product behavior or constraints are affected (`02-product/prds/`)

### Conflict rule

**If code and docs conflict → documentation is the source of truth.**  
Update code to match docs, or explicitly revise docs via an ADR + PRD change before shipping divergent behavior.

Legacy flat contracts under `docs/*.md` remain historical/spec references. The numbered tree in this README is the **governed** surface. Prefer updating numbered docs; when amending a legacy contract, cross-link it from the relevant numbered section.

## Structure

| Folder | Purpose | Update when… |
|--------|---------|----------------|
| [architecture](./architecture/) | CTO / engineering constitution + clinical profile (permanent) | Charter-level operating standards; dementia entry / multi-profile readiness |
| [01-company](./01-company/) | Mission, org continuity, why SolenOS exists | Strategy / company framing changes |
| [02-product](./02-product/) | Product philosophy, PRDs, UX logic, learning loop | Features, anti-patterns · [product integrity](./02-product/solenos-product-integrity.md) |
| [03-database](./03-database/) | Schema, migrations, data contracts, lifecycles | Migrations, allowed data types, table contracts |
| [04-authentication](./04-authentication/) | Identity continuity, sessions, roles | Auth / continuity / care-session binding |
| [05-care-graph](./05-care-graph/) | Responsibility graph, care profile, family care graph | Ownership, edges, persons, graph state machines |
| [06-careload-engine](./06-careload-engine/) | Load formulas, attention, containment | Load scoring, thresholds, burden messages |
| [07-confidence-engine](./07-confidence-engine/) | Confidence score methodology | Scoring, explanations, caps |
| [08-crisis-engine](./08-crisis-engine/) | Predictive crisis risks | Probabilities, categories, ETAs |
| [09-delegation-engine](./09-delegation-engine/) | Suggest-only delegation | Gates, ranking, assignment reasoning |
| [10-ai-systems](./10-ai-systems/) | LLM + deterministic AI behavior | Prompts, pipelines, AI behavior spec |
| [11-api-reference](./11-api-reference/) | HTTP APIs + integration contracts | Routes, payloads, external integrations |
| [12-security](./12-security/) | Safety, RLS, failure modes, data rules | Safety gates, override, degradation |
| [13-infrastructure](./13-infrastructure/) | Next.js, env, deploy assumptions | Runtime, env vars, hosting · [preview qualification](./13-infrastructure/preview-qualification.md) |
| [14-developer-onboarding](./14-developer-onboarding/) | Run, verify, architecture path | Onboarding, scripts, verify matrix |
| [15-architecture-decisions](./15-architecture-decisions/) | ADRs | Any irreversible or consequential design choice |
| [16-investor-technical-diligence](./16-investor-technical-diligence/) | Moat, flywheel, diligence package | Moat assets, scaling narrative (factual) |
| [17-canonical-architecture](./17-canonical-architecture/) | **Living single source of truth** | Any architectural change (always) |

## Living sources of truth (ordered)

0. **Root governing standards (highest product/engineering authority):**
   - [`ENGINEERING_CHARTER.md`](../ENGINEERING_CHARTER.md) — Engineering Leadership Charter
   - [`PRODUCT_PRINCIPLES.md`](../PRODUCT_PRINCIPLES.md) — Product Steward principles
   - [`architecture/SOLENOS_CTO_OPERATING_DIRECTIVE.md`](./architecture/SOLENOS_CTO_OPERATING_DIRECTIVE.md) — CTO operating constitution
   - [`architecture/CLINICAL_PROFILE.md`](./architecture/CLINICAL_PROFILE.md) — Dementia MVP profile · scalable to other conditions
   Cursor rule: `.cursor/rules/solenos-engineering-leadership-charter.mdc` (`alwaysApply`)
1. **`docs/17-canonical-architecture/`** — narrative system truth for humans
2. **`src/lib/solenos-layers/architecture-map.ts`** — machine-readable contract (verify scripts enforce)
3. **Module `contract-constants.ts` files** — per-engine invariants
4. **PRDs** under `02-product/prds/` — product intent and edge cases
5. **ADRs** under `15-architecture-decisions/` — why alternatives were rejected

## Philosophy (enforce in every doc and PR)

- Continuity over features
- Understanding over speed
- Safety over output
- Clarity over abstraction
- Compounding intelligence over static functionality

## Honest status markers

Docs must mark implementation status:

| Marker | Meaning |
|--------|---------|
| **IMPLEMENTED** | Logic runs in analyze or dedicated API; verify script exists |
| **IN-MEMORY** | Correct logic; process-local Maps; lost on restart |
| **STUB** | Intent recorded; does not mutate STATE/BELIEF or persist |
| **SCHEMA-ONLY** | DB column/table exists; app path does not fully use it |
| **FUTURE** | Integration or product surface not built |

## Related legacy docs

Flat contracts (`PRODUCT_BOUNDARY.md`, `ANALYZE_PIPELINE_SPEC.md`, etc.) remain in `docs/` root for historical verify references. Treat numbered governance docs as the onboarding and continuity surface for a new engineering organization.

**Product North Star / Constitution (CONSTRAINT):**  
`PRODUCT_INTELLIGENCE.md`, `PRODUCT_ARCHITECTURE.md`, `PRODUCT_FAILURE_MODEL.md`, `PRODUCT_CONSTITUTION.md`, `CONTINUITY_PROPERTIES.md` — caregiver questions as continuity-failure signals; vertical properties (SRL/EUM/OML/FDLL), not separate apps.  
Enforced via `src/lib/product-north-star`, `src/lib/product-constitution`, `src/lib/continuity-properties`.  
Ultimate metric: leave more certain than when entered. State model (CareRecord spine) before UI.
