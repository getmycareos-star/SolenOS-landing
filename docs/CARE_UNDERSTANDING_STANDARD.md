SOLENOS — CARE UNDERSTANDING STANDARD

Purpose
-------
This document states the product and engineering standard for how SolenOS must treat messy caregiver input and convert it into persistent, traceable, longitudinal care state. It is a design and testing standard for the SolenOS intelligence stack, not a feature specification for a single scenario. Use it as a living, testable contract.

Fundamental Product Problem
---------------------------
Real caregivers will not provide clean, structured medical records. They may supply fragments, incomplete sentences, multiple events, conflicting reports, uncertain memories, measurements, medication confusion, timestamps, observations, guesses, emotional statements, questions, unrelated context, or historical information mixed with recent events.

SolenOS must accept the mess and do the structuring. The evidence should flow into atomic claims, entity resolution, temporal placement, care state, baseline and delta detection, relationships, contradiction detection, unresolved open loops, prioritization, and grounded caregiver responses. The LLM must not simply produce a summary that becomes memory.

Core Principles
---------------
- Preserve original evidence and extraction provenance.
- Never replace evidence with prose as the source of truth.
- Maintain uncertainty markers and provenance for every extracted claim.
- Treat attention/triage as a first-class product outcome (not just an aesthetic summary).
- Prefer small, high-value follow-up questions grounded in evidence gaps.
- Represent relationships without inventing causal claims.
- Respect safety boundaries: organize evidence and surface potential urgencies, but do not diagnose.

Desired Flow (conceptual)
-------------------------
MESSY HUMAN INPUT
  ↓
EVIDENCE (raw input preserved)
  ↓
ATOMIC CLAIMS (DARE / extraction)
  ↓
ENTITY RESOLUTION (identities, persons, meds)
  ↓
TEMPORAL NORMALIZATION (relative/absolute times)
  ↓
EVIDENCE CLASSIFICATION (observation/measurement/report/hypothesis)
  ↓
CARE STATE (structured, persistent)
  ↓
BASELINE / CURRENT STATE
  ↓
DELTA DETECTION
  ↓
TRAJECTORY / RELATIONSHIPS / CONTRADICTIONS
  ↓
UNCERTAINTY MODEL / OPEN LOOPS
  ↓
ATTENTION / TRIAGE / DECISION CONTEXT
  ↓
QUESTIONS / FOLLOW-UPS (stateful)
  ↓
GROUNDED CAREGIVER RESPONSE (presentation layer)

Testing Requirements
--------------------
Before declaring the care-understanding system complete, validate it with many different messy inputs. Tests must demonstrate:
- Evidence preservation and provenance tracing
- Uncertainty preserved ("I think", "maybe")
- Contradiction preservation across contributors
- Delta detection vs baseline
- Temporal normalization (today/yesterday/relative times)
- Relationship representation without causal inference
- Open-loop creation, update, and resolution
- Prioritization that reflects change, safety, and decision context
- System behavior after many successive entries (longitudinal checks)

Operational Checklist (for engineering decisions)
-------------------------------------------------
For each change ask:
1. Does this preserve evidence?
2. Does this improve longitudinal memory?
3. Does this improve change detection?
4. Does this improve understanding of uncertainty?
5. Does this preserve contradictions?
6. Does this improve prioritization?
7. Does this reduce caregiver cognitive load?
8. Can the result be traced back to evidence?
9. Does it generalize to different messy inputs?
10. Does it make SolenOS more useful over time (10th/50th/100th entry)?

Acceptable Outputs
------------------
- Structured care state objects with links to evidence and provenance.
- Concise, prioritized questions rooted in evidence gaps.
- UI presentation that helps caregivers act without overclaiming medical conclusions.

Non-Goals / Warnings
--------------------
- Do not hard-code around any single test example.
- Do not let generated prose become persistent state.
- Do not invent causality from weak temporal association.

Next Steps
----------
- Add acceptance tests exercising messy inputs and longitudinal sequences.
- Instrument extraction, ingestion, and situation pipelines to emit provenance traces usable in tests.
- Track failures and refine extraction/clarity gates iteratively.

Contact
-------
If the system fails any of the engineering checklist items above, treat that as a blocking issue and revert or quarantine the change until the failure mode is addressed.
