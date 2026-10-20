# SolenOS — Document Intelligence Implementation

> Strengthening the existing `src/lib/document-intelligence` layer to make documents
> **care events, not just files**. Builds on the existing framework (no rewrite).

## Steps

- [x] 1. Add care-journey types to `src/lib/document-intelligence/types.ts`
       (medical events, medications, appointments, care instructions, people/orgs).
- [x] 2. Create care-journey extraction module (regex-driven, consistent with extraction.ts).
- [x] 3. Create change-detection module (New / Changed / Missing / Unclear).
- [x] 4. Create caregiver-translation module (medical → caregiver understanding).
- [x] 5. Create timeline-events module (Document → care timeline).
- [x] 6. Export new modules from `src/lib/document-intelligence/index.ts`.
- [x] 7. Integrate care-journey understanding into `process-document-intelligence.ts`.
- [x] 8. Add `scripts/verify-document-intelligence-care.mts` + package.json script.
- [x] 9. Run verification + build.

## Living Care Record Quality Improvements

- [x] Add medication safety signals to `MedicationInfo` type (duplicateDose, missedDose, refillProblem, unclearInstructions, uncertainty)
- [x] Add structured appointment fields to `AppointmentInfo` (what, who, preparation)
- [x] Add new appointment kinds (family_discussion, planned_care_decision)
- [x] Add `prioritization` field to `CareJourneyUnderstanding` (immediateAttention, importantToTrack, canWait)
- [x] Create `prioritization.ts` — caregiver-impact prioritization module
- [x] Update `care-journey-extraction.ts` — extract medication safety signals, structured appointment details
- [x] Update `caregiver-translation.ts` — surface medication safety concerns, new appointment kinds, exhaustive switch defaults
- [x] Update `timeline-events.ts` — handle new appointment kinds
- [x] Update `change-detection.ts` — detect medication safety changes
- [x] Integrate prioritization into `process-document-intelligence.ts` pipeline
- [x] Export `buildCaregiverPrioritization` from `index.ts`
- [x] Verify all 15 checks pass
