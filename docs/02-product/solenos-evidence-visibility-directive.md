# SolenOS Evidence Visibility Directive

**Status:** Permanent Product Steward / UX trust constraint  
**Authority:** Same force as Input Reality + Situation Relationship + Response Behavior  
**Why it matters:** Evidence is one of SolenOS’s biggest trust builders — but too much too early recreates the AI dashboard problem.

**Companions:** [`solenos-input-reality-directive.md`](./solenos-input-reality-directive.md) · Living Care Record UX (ADR-019) · caregiver-response-contract

---

## Key rule

> Evidence visibility should increase with the **consequence of the understanding**, not simply because more data exists.

A caregiver does not need to see everything SolenOS knows.  
They need to see **enough to trust what matters**.

Examples below use eating / mobility / medication for clarity only.  
**Caregivers can input any text or documents** — the maturity model is universal.

---

## Architecture instruction

**Do not** build evidence as a UI component that appears everywhere.

Evidence is a **layer of trust attached to understanding**.

Every Care Reality State update should be able to store (engine shape — not caregiver dump):

```json
{
  "understanding": "Mobility appears reduced",
  "supporting_evidence": [
    {
      "source": "caregiver_note",
      "date": "2026-07-17",
      "observation": "Mom avoiding walking"
    }
  ],
  "uncertainty": [
    "Cause of mobility change unknown"
  ]
}
```

Then the **UI decides how much to reveal**.

Feel: *"SolenOS remembers why it thinks this."*  
Never: *"SolenOS is showing me everything it processed."*

---

## Maturity levels (visibility)

Levels are **named consequence tiers**, not a requirement to ship every intermediate number.

### Level 1 — First input (Capture)

**Goal:** Make caregiver feel heard.

**Visibility:** Minimal — “Where did this come from?”

Show: Added to care record · what was recorded · source (e.g. Your note) · time  

Optional (not loud): Why am I asking these questions?  

**Do not show:** confidence score · evidence graph · reasoning · classifications · internal data

---

### Level 2 — Related information appears

**Goal:** Show that SolenOS remembers.

**Visibility:** Light — “What information contributed?” / “Why are you saying this?”

Show: What changed · short dated supporting observations

---

### Level 3 — Emerging pattern

**Goal:** Help caregiver recognize change.

**Visibility:** Moderate — “Why does this appear meaningful?”

Show: Why this is showing · dated supporting observations · what is still unknown  

**Important:** Evidence supports the observation. It does **not** claim a diagnosis.

---

### Level 5 — Important care decisions

**Goal:** Preserve decision memory.

**Visibility:** High — “Why was this action taken?”

Show: Decision recorded · source · date · information found · related context · reason when held · outcome when linked  

Future caregivers will ask: *“Why did this happen?”*  
Unknown reason is first-class: *“Reason for this decision is not held yet.”*

Never: medical advice · “you should choose X” · confidence %.

---

### Level 10 — Major care reality changes

**Goal:** Support major decisions over time.

**Visibility:** Full care context — “How did we get here over time?”

Show: How understanding developed (timeline of evidence) · current understanding · what remains uncertain  

**Care Reality Timeline (product spine — not a document vault):**

```
Person
  ├── Observations
  ├── Events
  ├── Decisions
  ├── Outcomes
  ├── Evidence
  ├── Unknowns
  └── Relationships
```

Never: `Documents → Summaries` as the product.

This is where SolenOS becomes different from notes apps.

---

## Visibility ladder (summary)

| Level | Caregiver question answered | Engine source (MVP) |
|-------|-----------------------------|---------------------|
| 1 | Where did this come from? | CRS `observation_count` ≤ 1 / `revision` ≤ 1 |
| 2 | What information contributed? | CRS count/revision ≈ 2 |
| 3 | Why does this appear meaningful? | Pattern label or count/revision ≥ 3 |
| 5 | Why was this action taken? | Record question / document with higher revision |
| 10 | How did we get here over time? | Established disclosure + enough CRS history |

`evidenceMaturityFor` in `src/lib/response-behavior` reads CRS fields on the Active Situation turn (`crs_observation_count`, `crs_revision`) — not raw message length.

**IMPLEMENTED (engine):** CRS stores `supporting_evidence` + `open_uncertainties` with understanding. `composeEvidenceLine` / LCR panel reveal by maturity (L1 source-only → L10 evolution). Why-asking is optional/collapsed. Expandable evidence lists are capped by maturity — never a full processing dump.

---

## Hard bans (all levels)

Never expose: chain of thought · model reasoning · confidence % · extraction labels · technical classifications · system states · evidence graph as a dashboard.
