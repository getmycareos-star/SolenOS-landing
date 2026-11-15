import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  caregiverFieldLabel,
  caregiverInformationLabel,
  caregiverSafeAssistantText,
  caregiverSafeChangeText,
  caregiverSafeErrorMessage,
  caregiverStatusLabel,
  caregiverSituationStateLabel,
  isTechnicalDiagnosticText,
} from "../src/lib/caregiver-language";

assert.equal(caregiverStatusLabel("needs_clarification"), "Needs clarification");
assert.equal(caregiverStatusLabel("completed"), "Completed");
assert.equal(caregiverStatusLabel("awaiting_confirmation"), "Needs review");
assert.equal(caregiverStatusLabel("within_review_window"), "Recently reviewed");
assert.equal(caregiverStatusLabel("unknown_internal_state"), null);
assert.equal(caregiverSituationStateLabel("worsening"), "Caregiver reports worsening");
assert.equal(caregiverSituationStateLabel("improving"), "Caregiver reports improvement");
assert.equal(caregiverSituationStateLabel("resolved"), "Resolved");
assert.equal(caregiverSituationStateLabel("unknown"), "Needs more information");
assert.equal(caregiverInformationLabel("reported"), "Caregiver report");
assert.equal(caregiverInformationLabel("epistemic_unknown"), null);
assert.equal(caregiverFieldLabel("medication_name"), "Medication name as reported");
assert.equal(caregiverFieldLabel("dose"), "Dose as reported");
assert.equal(caregiverFieldLabel("medication_name"), "Medication name as reported");
assert.equal(caregiverFieldLabel("medication_status"), "Medication status as reported");
assert.equal(caregiverFieldLabel("unknown_internal_field"), null);
assert.equal(
  caregiverSafeChangeText("daily_care_entry was first observed in the available records; this is not a claim about onset. 2 event(s) recorded in the current observation window."),
  null,
);
assert.equal(
  caregiverSafeChangeText("situation_understanding_assessment"),
  null,
);
assert.equal(
  caregiverSafeChangeText("Poor sleep was reported twice today."),
  "Poor sleep was reported twice today.",
);

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
assert.equal(caregiverSafeAssistantText("[{\"status\":\"unknown\"}]"), null);
assert.equal(caregiverSafeAssistantText('"Caregiver note"'), "Caregiver note");
assert.equal(caregiverSafeAssistantText("123"), "123");
assert.equal(caregiverSafeAssistantText("true"), null);
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
const naturalDailyUpdate = read("../src/components/workflows/NaturalLanguageDailyUpdate.tsx");
const handoff = read("../src/components/workflows/CareHandoffSharing.tsx");
const claimReview = read("../src/components/ClaimAssessmentPanel.tsx");
const appointment = read("../src/components/workflows/AppointmentWorkspace.tsx");
const detailedAppointment = read("../src/components/workflows/DetailedAppointmentWorkspace.tsx");
const historyDrawer = read("../src/components/app-shell/HistoryDrawer.tsx");
const careDelta = read("../src/components/CareDeltaPanel.tsx");
const careChangeHistory = read("../src/components/mvp-workspace/CareChangeHistoryPanel.tsx");
const humanValidation = read("../src/components/HumanValidationLoop.tsx");

assert.doesNotMatch(dailyCare, /epistemic_status\.replace|item\.status\.replace/);
assert.doesNotMatch(dailyCare, /item\.event_type \|\| item\.source_type/);
assert.match(dailyCare, /caregiverSafeAssistantText\(item\.original_text\)/);
assert.match(dailyCare, /caregiverSafeAssistantText\(item\.corrected_text\)/);
assert.match(companion, /caregiverSafeAssistantText\(response\.reply\)/);
assert.doesNotMatch(companion, /text: response\.reply/);
assert.doesNotMatch(documentReview, /candidate\.review_status\.replaceAll/);
assert.doesNotMatch(documentReview, /model: \{analysis\.model_provenance\.model_tag/);
assert.doesNotMatch(documentsPage, /Original file SHA-256/);
assert.doesNotMatch(settings, /setError\(detail \|\|/);
assert.match(settings, /caregiverSafeErrorMessage/);
assert.match(lcr, /caregiverSafeAssistantText\(item\.interpretation_limit\)/);
assert.doesNotMatch(lcr, /Extraction method:|Hedge \/ uncertainty marker|Near-duplicate review|algorithm version|policy version/i);
assert.doesNotMatch(changeIntelligence, /replaceAll\("_"|not calibrated|Observation coverage: baseline|evidence references:/i);
assert.match(changeIntelligence, /caregiverSituationStateLabel/);
assert.match(changeIntelligence, /caregiverSafeErrorMessage/);
assert.match(changeIntelligence, /caregiverInformationLabel/);
assert.doesNotMatch(dailyCareIntelligence, /source\.source_id<\/code>|review_status\.replaceAll|sent .*records to Qwen/i);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(result\.answer\)/);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(proposal\.title\)/);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(result\.notice\)/);
assert.match(dailyCareIntelligence, /caregiverSafeErrorMessage/);
assert.match(naturalDailyUpdate, /caregiverSafeErrorMessage/);
assert.doesNotMatch(naturalDailyUpdate, /cause\.message/);
assert.match(claimReview, /caregiverStatusLabel/);
assert.equal(claimReview.includes("review version ${assessmentImpact.assessment_version}"), false);
assert.match(handoff, /function readableStatus\(value: string\): string \{\s+return caregiverStatusLabel\(value\) \?\? "Not available";/);
assert.match(appointment, /caregiverSafeAssistantText\(item\.title\)/);
assert.match(detailedAppointment, /caregiverSafeAssistantText\(source\.original_author\)/);
assert.doesNotMatch(detailedAppointment, /Evidence IDs:|Assessment \{item\.assessment_id/);


assert.match(historyDrawer, /caregiverSafeAssistantText/);
assert.doesNotMatch(historyDrawer, /JSON\.stringify\(snapshot/);
assert.doesNotMatch(historyDrawer, /JSON\.stringify\(item\.context/);
assert.match(historyDrawer, /Malformed serialized data is not shown as caregiver text/);
assert.match(historyDrawer, /Earlier care details are saved/);
assert.match(documentsPage, /caregiverSafeAssistantText\(selected\.extractedText\)/);
assert.match(documentReview, /caregiverSafeAssistantText\(analysis\.extractedText\)/);
assert.match(lcr, /displayDescription\(source\.description\)/);
assert.match(lcr, /displayCurrentCareDescription\(item\)/);
assert.match(lcr, /<details className="lcr-entry-status">/);
assert.match(lcr, /<summary>Care details<\/summary>/);
assert.match(lcr, /Your saved care notes are still available below/);
assert.doesNotMatch(lcr, /We couldn’t check which items may need attention\. Try refreshing\./);
assert.match(lcr, /CURRENT_CARE_TITLE_LABELS/);
assert.match(lcr, /Original report text is not available in this view/);
assert.match(lcr, /Read original report/);
assert.match(lcr, /caregiverFieldLabel\(observation\.attribute\)/);
assert.match(lcr, /caregiverFieldLabel\(assertion\.field\)/);
assert.match(lcr, /caregiverSafeChangeText\(change\.explanation\)/);
assert.match(lcr, /caregiverSafeChangeText\(change\.previous_state\)/);
assert.match(careChangeHistory, /readableSource\(run\.source\)/);
assert.match(careChangeHistory, /readableChangeType\(item\.change_type\)/);
assert.match(careChangeHistory, /displayChangeText\(item\.comparison_basis/);
assert.doesNotMatch(careChangeHistory, /display\(run\.source/);
assert.doesNotMatch(lcr, /<p>\{change\.explanation\}<\/p>/);
assert.match(lcr, /caregiverSafeAssistantText\(source\.source_passage\)/);

const workspaceNav = read("../src/app/workspace/layout.tsx");
const workspaceHome = read("../src/app/workspace/page.tsx");
const followUps = read("../src/app/workspace/open-loops/page.tsx");
const timeline = read("../src/app/workspace/timeline/page.tsx");
const informationStatus = read("../src/components/trust/InformationStatus.tsx");
const statusCareDelta = read("../src/components/CareDeltaPanel.tsx");
const careOverviewPage = read("../src/app/workspace/care-continuity/page.tsx");
const sourceReview = read("../src/components/EvidenceReviewPanel.tsx");
const careRecordOverview = read("../src/components/app-shell/CareRecordOverview.tsx");
const persistedOrientation = read("../src/components/mvp-workspace/PersistedCareOrientation.tsx");
const howItWorksPage = read("../src/app/how-it-works/page.tsx");
const trustContent = read("../src/lib/trust-content/index.ts");
const howItWorksCopy = trustContent.slice(trustContent.indexOf("export const HOW_IT_WORKS = {"), trustContent.indexOf("export const FIRST_USE ="));
assert.match(howItWorksPage, /Care Record/);
assert.match(howItWorksPage, /Care Assistant/);
assert.doesNotMatch(howItWorksPage, /Living Care Record|AI Companion|source of truth|normal save and review flow/);
assert.match(howItWorksCopy, /healthcare professional/);
assert.match(howItWorksCopy, /what is not clear yet/);
assert.doesNotMatch(howItWorksCopy, /Living Care Record|AI Companion|natural inputs|clinician/);
assert.match(careOverviewPage, /Your Care Record/);
assert.match(careOverviewPage, /Open Care Assistant/);
assert.doesNotMatch(careOverviewPage, /Your Living Care Record|AI Companion/);
assert.match(changeIntelligence, /CARE CHANGES OVER TIME/);
assert.match(changeIntelligence, /Review notes and documents/);
assert.doesNotMatch(changeIntelligence, /LONGITUDINAL UNDERSTANDING|Past assessment|Review source evidence/);
assert.match(sourceReview, /Notes and documents behind care information/);
assert.match(sourceReview, /Details found in this note or document/);
assert.doesNotMatch(sourceReview, /Saved source reviews|Sources and supporting information/);
assert.match(claimReview, /Choose a note or document/);
assert.match(claimReview, /This information needs another review/);
assert.match(statusCareDelta, /Compare with saved care information/);
assert.match(careRecordOverview, /See what has been saved, who shared it/);
assert.match(persistedOrientation, /Your Care Record does not have any care information yet/);
assert.match(workspaceNav, /label: "Care Record"/);
assert.match(workspaceNav, /label: "Care Assistant"/);
assert.doesNotMatch(workspaceNav, /label: "Living Care Record"|label: "AI Companion"/);
assert.match(informationStatus, /Known/);
assert.match(informationStatus, /Not sure yet/);
assert.match(informationStatus, /Not recorded/);
assert.match(informationStatus, /Needs checking/);
assert.match(followUps, /Related notes and documents/);
assert.match(followUps, /Why this needs attention/);
assert.match(followUps, /Information that is missing, unclear or does not match/);
assert.match(timeline, /return to your Care Record/);
assert.match(statusCareDelta, /Compare with saved care information/);
assert.match(workspaceHome, /Ask about saved care information/);
console.log("Caregiver language boundary checks passed.");

assert.match(careDelta, /caregiverStatusLabel/);
assert.match(careDelta, /caregiverSafeAssistantText/);
assert.doesNotMatch(careDelta, /Provider:|Model:|source-attributed assertions|replace\(\/_\/g/);
assert.match(humanValidation, /caregiverSafeErrorMessage/);
assert.doesNotMatch(humanValidation, /data\.detail \?\? data\.error/);
