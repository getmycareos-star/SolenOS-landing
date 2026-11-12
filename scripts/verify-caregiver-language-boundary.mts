import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  caregiverInformationLabel,
  caregiverSafeAssistantText,
  caregiverSafeErrorMessage,
  caregiverStatusLabel,
  isTechnicalDiagnosticText,
} from "../src/lib/caregiver-language";

assert.equal(caregiverStatusLabel("needs_clarification"), "Needs clarification");
assert.equal(caregiverStatusLabel("completed"), "Completed");
assert.equal(caregiverStatusLabel("awaiting_confirmation"), "Needs review");
assert.equal(caregiverStatusLabel("within_review_window"), "Recently reviewed");
assert.equal(caregiverStatusLabel("unknown_internal_state"), null);
assert.equal(caregiverInformationLabel("reported"), "Caregiver report");
assert.equal(caregiverInformationLabel("epistemic_unknown"), null);

for (const diagnostic of [
  "Database schema unavailable",
  "Freshness assessment storage is unavailable in this schema.",
  "The provenance reconciliation API returned an assertion payload.",
  "The OCR extraction pipeline is unavailable.",
  "Original file SHA-256: abc123",
  "source_id: 1f2a3b4c",
  "Record reference: 123e4567-e89b-42d3-a456-426614174000",
  "{\"schema\":\"internal\",\"status\":\"unknown\"}",
]) {
  assert.equal(caregiverSafeAssistantText(diagnostic), null, diagnostic);
}
assert.equal(isTechnicalDiagnosticText("Database schema unavailable"), true);
assert.equal(
  caregiverSafeAssistantText("Your message has been saved. We do not know what caused the change yet."),
  "Your message has been saved. We do not know what caused the change yet.",
);
assert.match(caregiverSafeErrorMessage(), /check your connection/i);

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const dailyCare = read("../src/app/workspace/daily-care/page.tsx");
const companion = read("../src/components/workflows/AICompanion.tsx");
const documentReview = read("../src/components/DocumentIntelligenceReview.tsx");
const documentsPage = read("../src/app/workspace/documents/page.tsx");
const settings = read("../src/app/workspace/settings/page.tsx");
const lcr = read("../src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
const changeIntelligence = read("../src/components/mvp-workspace/ChangeIntelligencePanel.tsx");
const dailyCareIntelligence = read("../src/components/workflows/DailyCareQwen.tsx");
const handoff = read("../src/components/workflows/CareHandoffSharing.tsx");
const appointment = read("../src/components/workflows/AppointmentWorkspace.tsx");
const detailedAppointment = read("../src/components/workflows/DetailedAppointmentWorkspace.tsx");
const claimReview = read("../src/components/ClaimAssessmentPanel.tsx");
const continuity = read("../src/components/CareContinuityIntegrityPanel.tsx");
const conflictReview = read("../src/components/ConflictResolutionPanel.tsx");
const careHistory = read("../src/components/CareContinuityIntegrityPanel.tsx");
const claimAssessment = read("../src/components/ClaimAssessmentPanel.tsx");
const conflictReview = read("../src/components/ConflictResolutionPanel.tsx");
const evidenceReview = read("../src/components/EvidenceReviewPanel.tsx");
const appointment = read("../src/components/workflows/AppointmentWorkspace.tsx");
const detailedAppointment = read("../src/components/workflows/DetailedAppointmentWorkspace.tsx");
const appointmentPage = read("../src/app/workspace/appointments/page.tsx");

assert.doesNotMatch(dailyCare, /epistemic_status\.replace|item\.status\.replace/);
assert.doesNotMatch(dailyCare, /item\.event_type \|\| item\.source_type/);
assert.match(companion, /caregiverSafeAssistantText\(response\.reply\)/);
assert.doesNotMatch(companion, /text: response\.reply/);
assert.doesNotMatch(documentReview, /candidate\.review_status\.replaceAll/);
assert.doesNotMatch(documentReview, /model: \{analysis\.model_provenance\.model_tag/);
assert.doesNotMatch(settings, /setError\(detail \|\|/);
assert.match(settings, /caregiverSafeErrorMessage/);
assert.match(lcr, /caregiverSafeAssistantText\(item\.interpretation_limit\)/);
assert.doesNotMatch(lcr, /Extraction method:|Hedge \/ uncertainty marker|Near-duplicate review|algorithm version|policy version/i);
assert.doesNotMatch(changeIntelligence, /replaceAll\("_"|not calibrated|Observation coverage: baseline|evidence references:/i);
assert.match(changeIntelligence, /caregiverSafeErrorMessage/);
assert.match(changeIntelligence, /caregiverInformationLabel/);
assert.doesNotMatch(dailyCareIntelligence, /source\.source_id<\/code>|review_status\.replaceAll|sent .*records to Qwen/i);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(result\.answer\)/);
assert.match(dailyCareIntelligence, /caregiverSafeErrorMessage/);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(proposal\.title\)/);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(result\.notice\)/);
assert.match(handoff, /function readableStatus\(value: string\): string \{\s+return caregiverStatusLabel\(value\) \?\? "Not available";/);
assert.match(claimReview, /caregiverStatusLabel/);
assert.match(continuity, /caregiverSafeAssistantText/);
assert.doesNotMatch(conflictReview, /replaceAll\("_"|evidence_ids\.join\("/);
assert.ok(!careHistory.includes("Care continuity integrity"));
assert.ok(!careHistory.includes("independent clinical verification"));
assert.ok(!claimAssessment.includes("review version"));
assert.ok(!claimAssessment.includes("Version {item.claim_version}"));
assert.ok(!conflictReview.includes("persisted conflicts"));
assert.ok(!conflictReview.includes("Conflict resolution persistence"));
assert.ok(!conflictReview.includes("Resolution transition"));
assert.ok(!evidenceReview.includes("Source-text integrity could not be checked"));
assert.ok(!evidenceReview.includes("{item.near_duplicate_interpretation_limit}"));
assert.ok(!evidenceReview.includes("{item.observation_method}"));
assert.ok(!appointment.includes("Appointment record revision"));
assert.ok(!appointment.includes("Each candidate is tied"));
assert.ok(!appointment.includes("caregiver-reviewed detail"));
assert.ok(!detailedAppointment.includes("database schema"));
assert.ok(!detailedAppointment.includes("source_time_kind"));
assert.ok(!detailedAppointment.includes("Evidence IDs:"));
assert.ok(!detailedAppointment.includes("Assessment {item.assessment_id"));
assert.doesNotMatch(appointmentPage, /Appointment workspace/);

console.log("Caregiver language boundary checks passed.");
