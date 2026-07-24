# SolenOS MVP Architecture Directive — Situation Relationship Intelligence

**Status:** Permanent MVP architecture constraint (Product Steward)  
**Authority:** Same force as Situation Relationship + Input Reality  
**Supersedes for MVP scope:** “build full Situation Graph UI/infra first”

**Companions:** [`solenos-situation-relationship-directive.md`](./solenos-situation-relationship-directive.md) · ADR-018 · Care Reality State · ACS

---

## Important clarification

Caregiver examples in product docs are **ONLY examples**.

Do **not** build logic around specific phrases (“Mom fell yesterday”, “afraid to walk”, “doctor changed medication”).

Those examples represent a **pattern**, not fixed inputs.

Real caregivers can provide anything: text notes, incomplete thoughts, questions, voice transcripts, scanned documents, photos of medical papers, discharge summaries, medication lists, screenshots, family messages, observations in their own words.

All inputs enter the **same Care Reality system**.

The system's job is **not** to recognize specific phrases.  
Its job is to understand whether new information **changes the person's evolving care reality**.

MVP shipping channels remain text + documents (ADR-018). Voice plugs into this same layer later.

---

## MVP decision

**C — Relationship decisions now; graph visualization later.**

| Do | Do not |
|----|--------|
| Situation Relationship **intelligence behavior** | Full Situation Graph visualization |
| Continuity the caregiver can **feel** | Complex node UI / advanced graph queries |
| Durable relational storage that **enables** graph later | Graph database as MVP requirement |
| Quiet continuity copy | Shallow “classify → respond” notes-app loop |

### Why not classification-only?

`Input → Classification → Response` isolates every input. Caregiver reconstructs the story — **violates the SolenOS promise**.

### Why not full graph infrastructure?

Goal is not to **show** a graph.  
Goal: *“SolenOS remembers that this connects to what happened before.”*

---

## MVP architecture

**Product truth path:** Caregivers see only the composer / LCR chain — not `final_output` from situation-entry arbitration. Canonical: [`docs/17-canonical-architecture/product-truth-path.md`](../17-canonical-architecture/product-truth-path.md).

**Ideal narrative spine** (understanding-first — use for product behavior docs):

```
Input
  → Care Reality Understanding
  → Situation Relationship Engine (`src/lib/situation-relationship-engine`)
  → Decision Memory (`src/lib/decision-memory`)
  → Evidence-backed Care Context
  → Active Care Situation / Living Care Record
  → Response Contract (composer)
```

**Actual runtime order** in `processSituationInput`: SRE spine link on capture → internal `final_output` compile → ACS ingest (epistemics → progressive understanding → CRS → Decision Memory) → `composeCaregiverResponse`. See product-truth-path doc for why both exist.

**Reject (not SolenOS):** `Input → Document summary → Generic answer` — that is a document analyzer.

**Module:** `src/lib/situation-relationship-engine` — `evaluateSituationRelationship`  
**Decision Memory:** `src/lib/decision-memory` — what / when / who / context / evidence / alternatives / reason / outcome / status  
**Hook:** `planSituationSpineLink` / `classifySituationRelation` delegate to the engine before CareEvents append.

**Missing intelligence layer:** Situation Relationship Engine + Decision Memory (why a path existed).

Before creating a new Care Event, evaluate:

- Does this update an existing Active Care Situation?
- Does this answer an existing uncertainty?
- Does this strengthen an existing pattern?
- Does this represent a related event?
- Does this represent a completely new situation?
- Does this record or update a care decision (and its reason / outcome)?
- Is there not enough information to decide?

---

## MVP relationship types (start simple)

| Type | Meaning |
|------|---------|
| Update existing situation | New info expands current understanding |
| Add related event | New event belongs to existing situation (linked, not merged) |
| Answer previous uncertainty | Unknown receives information → resolve gap |
| New unrelated situation | Belongs elsewhere (e.g. different person / clear break) |

---

## Storage approach

Do **not** build a graph database. PostgreSQL / durable relational structures are enough.

Conceptual tables (shape — implement via existing schema evolution + ADR when coding):

- `care_situations` — id, care_recipient_id, title, status, created_at, updated_at  
- `care_events` — id, situation_id, event_type, content, source, created_at  
- `relationships` — id, from_event_id, to_event_id, relationship_type, reason, confidence (engine-only)

This creates **graph capability later** without forcing graph infrastructure now.

Honesty: if current ACS/CRS is still in-memory in places, MVP work must **persist** CareContext + ACS + relationship decisions — not only ephemeral session state.

---

## Caregiver UI rule

Never expose technical relationships.

Never show: `relationship_type` · graph edges · classifications · internal confidence · “system decisions” jargon.

Never: *“This event has follow_up_observation relationship.”*

Instead: *“This appears connected to what you shared earlier.”*  
or: *“You previously mentioned this situation. This update adds more context about what changed.”*

---

## Core product principle

SolenOS does **not** organize notes.  
SolenOS **maintains continuity**.

Caregiver provides reality in whatever form is easiest.  
SolenOS determines: what belongs together · what changed · what is new · what remains uncertain.

---

## MVP priority order

1. Durable CareContext  
2. Persistent Active Care Situation  
3. Situation Relationship Engine  
4. Evidence linking  
5. Care Reality State  
6. Full Care Reality Graph **later**

---

## MVP proof

When caregivers return and add more information, SolenOS feels like it **remembers the person's story** instead of starting over.
