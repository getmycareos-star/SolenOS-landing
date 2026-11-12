# SolenOS Living Care Record architecture

SolenOS is a **Living Care Record (LCR) for family caregivers**. Its purpose is to preserve a person's care journey over time so information is not lost between daily observations, family members, appointments, documents, and care decisions.

SolenOS is not a chatbot, task manager, reminder application, or AI doctor. Cognitive-load reduction, extraction, summarization, and conversational interfaces are supporting capabilities; none is the product's system of record.

## Authoritative data flow

```text
Care information inputs
  Daily observations | documents | family reports | appointments | decisions | corrections
        |
        v
Evidence and provenance
  Original report | author | timestamps | source reference | identity/ownership
        |
        v
Interpretation and reconciliation
  Extracted observations | claims | events | uncertainty | contradictions | missing information
  Review | correction | rejection | explicit acceptance | provenance validation
        |
        v
Living Care Record (authoritative care-domain state)
  Current understanding | longitudinal history | changes | open questions
  Decisions and outcomes | evidence-linked facts | audit history
        |
        v
Caregiver experiences
  What is known | what changed | what is uncertain
  What needs attention | what needs clarification | what happened next
```

## Authority and safety invariants

1. Original evidence is immutable or versioned; corrections never silently replace the source report.
2. Extracted observations and model-generated interpretations are candidates, not accepted care facts.
3. Every accepted assertion or care-state change has a source, actor, timestamp, and review/promotion path.
4. Unknown, uncertain, missing, negated, ambiguous, and contradictory information remain explicit. Absence of a record is not evidence that an event did not occur.
5. AI may extract, organize, compare, and explain evidence. It cannot independently establish clinical truth or silently promote its output into authoritative care state.
6. The backend care-domain PostgreSQL schema is the durable source of truth. Interaction telemetry is separate and cannot be treated as care memory.
7. Access to each person's record is scoped by server-verified identity and caregiver authorization; a client-supplied person or caregiver identifier is not authority.
8. Caregiver-facing experiences are projections of governed record state. A projection must not mutate the record as a side effect of reading it.

Daily Care, document intake, Companion, appointments, handoffs, open loops, and community are interfaces or workflows around the LCR. They must preserve source provenance and use explicit promotion rules. Community posts do not automatically become care facts.

Cognitive-load reduction and semantic-role isolation remain useful internal presentation/processing techniques. They are not SolenOS's product identity and do not constrain the care record to stateless interactions.

## End-to-end verification standard

A component, model, endpoint, static contract, or passing unit test does not prove the complete architecture. Verify the following against the production-equivalent PostgreSQL schema and real frontend/backend API path:

1. A caregiver submits a care observation.
2. The original report persists and can be retrieved with its provenance.
3. Extraction creates attributed candidate observations.
4. Ambiguity, uncertainty, negation, and missing information are preserved.
5. A caregiver can correct, reject, or explicitly accept a candidate.
6. Acceptance creates governed LCR state without altering original evidence.
7. Current-care projection and longitudinal history reflect the accepted change.
8. A later session retrieves the same record and explains what changed, what remains uncertain, and what happened next.
9. An unauthorized caregiver cannot read or alter the person's record.
10. Persistence is proven across process/session boundaries; mocked extraction or in-memory SQLite alone is insufficient.

Until this journey passes, the architecture is implemented in parts but not verified end to end.


## Existing backend verification assets

The backend already contains a PostgreSQL-backed HTTP journey in [postgres_anonymous_e2e.py](https://github.com/getmycareos-star/SolenOS_backend/blob/main/backend/scripts/postgres_anonymous_e2e.py). The [Backend tests workflow](https://github.com/getmycareos-star/SolenOS_backend/blob/main/.github/workflows/backend-tests.yml) runs it against a disposable PostgreSQL service. It covers Daily Care source/event persistence, review correction, explicit acceptance/rejection, LCR retrieval, session refresh, cross-person isolation, and other continuity workflows.

The same journey seeds persisted extraction candidates directly rather than depending on a live model call. That is appropriate for deterministic verification of persistence and review/promotion boundaries, but it does **not** prove extraction quality. Live model extraction must remain a separate test gate. The PostgreSQL test run must report success before the complete architecture is marked verified.
