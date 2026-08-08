# Living Care Record Quality — Implementation TODO

> Raising the Living Care Record to 9/10 across Understanding, Trust/Safety, and
> Caregiver usefulness. Extends the document-intelligence care-journey layer and
> the Living Care Record UX projection.

## Steps

- [x] 1. Extend `types.ts` — MedicationInfo concern flags (duplicate dose, missed dose, refill problem, unclear instructions, uncertainty), AppointmentInfo structured What/When/Who/Preparation + family_discussion & planned_care_decision kinds, CareJourneyUnderstanding.prioritization block.
- [ ] 2. Extend `care-journey-extraction.ts` — detect high-priority medication signals and structure appointments into What/When/Who/Preparation.
- [x] 3. Create `prioritization.ts` — classify findings into immediateAttention / importantToTrack / canWait (mirroring LCR pillars).
- [ ] 4. Extend `caregiver-translation.ts` — reduce abstraction; emit concrete caregiver language and first-screen answers (Changed / Needs attention / Prepare for / Missing).
- [ ] 5. Extend `change-detection.ts` — surface uncertain-medications and duplicate-potential change types.
- [ ] 6. Extend `timeline-events.ts` — concrete dates where available; richer whatMattersNext.
- [ ] 7. Integrate into `process-document-intelligence.ts` + export from `index.ts`.
- [ ] 8. Extend `verify-document-intelligence-care.mts` with quality assertions.
- [ ] 9. Surface quality in Living Care Record UX (`build-response.ts` / composer) so the first screen answers the four questions.
- [ ] 10. Run all related verifications + build.
