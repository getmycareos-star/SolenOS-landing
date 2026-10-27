# SolenOS Care Handoff Product Specification

Status: implementation contract and gap register; not a claim of clinical validation.

## Product location and entry

- Care Handoff is entered and prepared only inside AI Companion.
- Entry sequence: Create care handoff → Family caregiver or Professional → Taking over today, Doctor's appointment, or Full care overview.
- There is no standalone Care Handoffs page or workspace navigation item. Legacy URLs redirect to AI Companion.
- Notifications and notification preferences belong in Settings. Deep care continuity is backend/database infrastructure, not a caregiver-facing page.
- A handoff draft is not shared automatically and does not modify the Living Care Record (LCR).

## Shared trust contract

1. Read from server-authorized, person-scoped LCR sources only.
2. Never treat Community posts, Companion messages, prior AI output, or derived analysis as authoritative care evidence.
3. Preserve source table/type, source ID, timestamp, epistemic status, and stale warnings.
4. Keep observed facts, caregiver/patient reports, professional findings, interpretation, uncertainty, conflicts, and missing information distinct.
5. Empty bounded results mean “no records returned from these sources in this window,” not “this fact does not exist.”
6. Do not fabricate names, diagnoses, medication details, allergies, clinical thresholds, contacts, appointments, action owners, deadlines, or care-plan instructions.
7. Review is required before sharing. Editing a draft invalidates any prior review confirmation.
8. Sending is not receipt. Record recipient receipt, clarification, acceptance/decline, and any unaccepted responsibility separately.
9. Creating, reviewing, sharing, accepting, acknowledging, revoking, and completing an action are distinct audited events.
10. LCR corrections are append-preserving; a handoff snapshot must retain the source version and not overwrite the source.

## Family handoff template

Title: **SolenOS Family Care Handoff** — Living Care Record · Family Edition.

Required sections:
1. What matters most right now — concise current situation, immediate needs, and what the next caregiver must know.
2. How the person is doing — today, changes from documented baseline, uncertainty.
3. How to care for them — daily routine; communication and sensory preferences; comfort; known distress triggers and previously helpful responses.
4. Health and medication information — documented concerns; verified medication list and schedule; allergies/reactions or explicitly unknown; appointments and clinician-provided instructions.
5. What needs to happen next — action, named owner, due time/date or follow-up condition, status, outcome.
6. Safety and when to seek help — documented safety needs, care-plan watch-outs, authorized escalation instructions, verified contacts.
7. Family coordination — primary and backup caregiver, availability, next check-in, practical support.
8. Handoff acceptance — review confirmed, responsibilities understood, unresolved items and escalation contacts, sender/receiver names and timestamps.

Plain language is the default. Do not include information that the recipient is not authorized to see.

## Professional handoff template

Title: **SolenOS Professional Care Handoff** — Living Care Record · Professional Edition.

Required sections:
1. Executive summary/current situation and reason for transfer.
2. Relevant history and baseline, including source/date for diagnoses and documented change from baseline.
3. Evidence and provenance register with source ID, author/reporter, timestamp, evidence status, conflict and correction history.
4. Medication reconciliation: verified list, strength/dose/route/frequency when sourced, OTC products, allergies/reactions, authorised changes, discrepancies, resolution owner and status.
5. Clinical and functional information: measurements with units/context/time/source; symptoms/events; cognition/communication; mobility/ADLs; nutrition/hydration; sleep/mood/behaviour; equipment/environment.
6. Active problems, risks, uncertainty and missing information, with evidence, response, owner and deadline.
7. Authorised care plan, delivered care, recorded response, pending tests/consultations, unresolved decisions and existing escalation instructions.
8. Action register with owner, deadline, status and outcome.
9. Person-centred/family context and authorised contacts.
10. Transition-specific details: sending/receiving setting, reason, course/interventions, discharge instructions, follow-ups, pending results and equipment/supplies.
11. Contingency plan based only on documented, authorised instructions.
12. Record integrity: source record IDs/versions, generated timestamp/timezone, last verification, stale information and gaps.
13. Receipt/acceptance: sender/receiver, timestamp, effective responsibility-transfer time, critical items confirmed, questions, unaccepted actions and acceptance status.

Professional content must distinguish clinician-assessed status from caregiver report and from “not assessed.” It is a communication aid, not the official clinical record or a replacement for professional assessment/local policy.

## Three purposes

- **Taking over today:** short time-bounded handoff. Prefer recent information, current open items and the next shift/day; preserve older items only when relevant and label them.
- **Doctor's appointment:** relevant changes, observed events, questions, existing instructions, medication discrepancies, and pending follow-up. Do not imply the appointment or medication list is verified unless the source supports it.
- **Full care overview:** broader longitudinal context, baseline, preferences, decisions/outcomes, unresolved questions, information gaps, actions, and provenance. A bounded query is never represented as the entire history.

## Source coverage and launch gates

Backend PR #203 is merged and adds audience-specific template coverage. The deployed endpoint version must still be verified on Railway before relying on that response shape. Backend PR #204 proposes adding person-scoped care events, care transitions, appointments, and actions. Action records are included only when their linked evidence belongs to the requesting caregiver; another caregiver's private evidence is excluded.

Daily Care, document contents, medication/allergy adapters, routine/preferences, contacts, measurements, and verified professional identity are not to be shown as available until their person-scoped persistence/access paths are tested. An appointment is not a verified medication list. Community is not an authorised source.

The UI must show template sections even when they are unavailable, but label coverage explicitly. “Partial”, “no records returned”, “unavailable”, and “not assessed” are not interchangeable.

Before production use, prove:
- authenticated same-person source retrieval and cross-person denial;
- source snapshot/version and stable source IDs;
- stale/conflicting/missing data preserved;
- action owner/deadline/outcome persistence without auto-completion;
- sender review, recipient authorization, expiry/revocation and least-privilege access;
- durable receipt, clarification, accepted/declined status and accountability;
- document-byte access authorization if attachments are included;
- audit event persistence and failure-closed behavior;
- end-to-end tests against the deployed backend and database.

Current implementation status: inline AI Companion preparation and source-traceable review UI are being added. The draft endpoint is read-only; it does not itself create or send a handoff. Source adapters and live end-to-end verification remain explicit gaps.
