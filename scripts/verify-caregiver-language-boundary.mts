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
assert.equal(caregiverSafeAssistantText("[{\"status\":\"unknown\"}]"), null);
assert.equal(caregiverSafeAssistantText('"Caregiver note"'), "Caregiver note");
assert.equal(caregiverSafeAssistantText("123"), null);
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
const handoff = read("../src/components/workflows/CareHandoffSharing.tsx");
const claimReview = read("../src/components/ClaimAssessmentPanel.tsx");
const appointment = read("../src/components/workflows/AppointmentWorkspace.tsx");
const detailedAppointment = read("../src/components/workflows/DetailedAppointmentWorkspace.tsx");
const historyDrawer = read("../src/components/app-shell/HistoryDrawer.tsx");

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
assert.match(changeIntelligence, /caregiverSafeErrorMessage/);
assert.match(changeIntelligence, /caregiverInformationLabel/);
assert.doesNotMatch(dailyCareIntelligence, /source\.source_id<\/code>|review_status\.replaceAll|sent .*records to Qwen/i);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(result\.answer\)/);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(proposal\.title\)/);
assert.match(dailyCareIntelligence, /caregiverSafeAssistantText\(result\.notice\)/);
assert.match(dailyCareIntelligence, /caregiverSafeErrorMessage/);
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
assert.match(lcr, /caregiverSafeAssistantText\\(source\.description\\)/);
assert.match(lcr, /caregiverSafeAssistantText\(source\.source_passage\)/);

console.log("Caregiver language boundary checks passed.");
