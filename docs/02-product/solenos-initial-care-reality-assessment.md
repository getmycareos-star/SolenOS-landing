# Initial Care Reality Assessment Mode (SolenOS Architecture 2B)

**Status:** Locked architecture directive  
**Authority:** First vs Returning User · Baseline Comparison Engine · Care Recipient Anchor  
**Companions:** [`solenos-baseline-comparison-engine.md`](./solenos-baseline-comparison-engine.md) · [`solenos-first-vs-returning-user.md`](./solenos-first-vs-returning-user.md) · [`solenos-first-time-caregiver.md`](./solenos-first-time-caregiver.md) · [`solenos-care-recipient-anchor.md`](./solenos-care-recipient-anchor.md)  
**Module:** `src/lib/care-reality-intelligence/initial-care-reality-assessment.ts`  
**Verify:** `verify:initial-care-reality-assessment`

---

## Critical failure

A new caregiver enters with **no** prior care record, baseline, history, decisions, or timeline.

The system must **not** pretend it knows what changed.

| Forbidden without comparable prior | Why |
|------------------------------------|-----|
| “This is different from before.” | No before |
| “This appears to be a decline.” | Invented trajectory |
| “This is a new behavior.” | Invented novelty |
| “Getting worse.” | Hallucinated history |

---

## Two paths (must not confuse)

| Path | When | Goal |
|------|------|------|
| **Initial Care Reality Assessment** | No durable baseline **and** no same-turn stated usual/used-to **and** no held ACS/CRS observations from earlier turns | Build first understanding of **current** care reality |
| **Change detection / continuing story** | Durable familiarity **or** caregiver stated previous pattern in this capture **or** Care Reality already holds prior observations | Compare current vs what is already held |

```
Existing / comparable prior:  Current reality → Compare → Detect change / related update
New / no comparable prior:    Current reality → First understanding → Establish baseline
```

Both converge later:

```
Care Reality Model → Future observations → Change detection → Decision memory → Continuity
```

**Key distinction:** A new user gives SolenOS a **situation**. A returning user (held care memory) gives SolenOS a **continuation or change**. The system must know the difference — otherwise it hallucinates history **or** restarts Initial Assessment when memory already exists.

**Held ACS memory without usual/used-to:** Graduate out of Initial Assessment. Speak related update / continuity with what is already held. Still **never** invent “decline,” “new behavior,” or “different from usual” unless a comparable usual pattern is actually held or stated.

---

## Pipeline (no history)

```
New Input
  → Identify Care Recipient
  → Extract Current Situation
  → Identify Known Facts
  → Identify Unknowns
  → Create Initial Baseline (seed living baseline from what is stated)
  → Begin Future Change Detection
```

Goal is **not** change detection. Goal is the first understanding of the person's current care reality.

---

## Same-turn stated prior (not hallucination)

If the caregiver says *“used to / usually / every morning…”* and also states what is happening now, that **is** a comparable prior **inside the note**. Change-from-stated-previous is allowed.

If they only describe current concerns (sleeping more, medication change) with **no** usual pattern held, use Initial Assessment Mode.

---

## Person baseline (eventually establish)

Every new care record should grow toward:

| Area | Examples (illustrations only) |
|------|-------------------------------|
| Identity | Who they are · relationship |
| Daily life | Routines · activities · independence |
| Abilities | Mobility · communication · memory · self-care |
| Preferences | Likes · dislikes · comforting activities |
| Health context | Conditions · medications · providers |
| Behavior patterns | Typical personality · typical responses |
| Care environment | Who helps · support system |

MVP: soft high-value asks — **never** a profile form wall before value.

---

## Acceptance tests (illustration fixtures)

### Test A — Existing / comparable prior

Prior: normal sleep/activity held.  
Input: sleeping more after medication change.  
Expect: change language grounded in **previous pattern**.

### Test B — New / no comparable prior

Same input, empty history.  
Expect: current understanding of the situation + invitation to establish what was usual **before** — never “differs from previous pattern.”

---

## Product principle

Do not invent a past.  
Build a present that can become a past worth comparing.
