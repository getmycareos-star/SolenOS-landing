import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  caregiverFieldLabel,
  caregiverReadableCaptureText,
  caregiverProductTermLabel,
  caregiverInformationAreaLabel,
  caregiverInformationLabel,
  caregiverSafeAssistantText,
  caregiverSafeGeneratedText,
  caregiverSafeChangeText,
  caregiverSafeErrorMessage,
  caregiverStatusLabel,
  caregiverSituationStateLabel,
  isTechnicalDiagnosticText,
} from "../src/lib/caregiver-language";

assert.equal(caregiverStatusLabel("needs_clarification"), "Needs checking");
assert.equal(caregiverStatusLabel("completed"), "Completed");
assert.equal(caregiverStatusLabel("awaiting_confirmation"), "Needs review");
assert.equal(caregiverStatusLabel("within_review_window"), "Recently reviewed");
assert.equal(caregiverStatusLabel("verified"), "Checked against another note or report");
assert.equal(caregiverStatusLabel("uncertain"), "Not sure yet");
assert.equal(caregiverStatusLabel("unresolved"), "Still needs attention");

assert.equal(caregiverStatusLabel("in_progress"), "In progress");
assert.equal(caregiverStatusLabel("waiting_for_information"), "Waiting for information");
assert.equal(caregiverStatusLabel("waiting_for_action"), "Waiting for someone to act");
assert.equal(caregiverStatusLabel("awaiting_response"), "Waiting for a response");
assert.equal(caregiverStatusLabel("professional_input"), "Waiting for input from a healthcare professional");
assert.equal(caregiverStatusLabel("unconfirmed_outcome"), "Waiting to confirm the result");
assert.equal(caregiverStatusLabel("pending_closure_verification"), "Waiting to confirm completion");
assert.equal(caregiverStatusLabel("needs_attention_now"), "Needs attention now");
assert.equal(caregiverStatusLabel("being_monitored"), "Being monitored");
assert.equal(caregiverStatusLabel("no_longer_relevant"), "No longer relevant");


assert.equal(caregiverStatusLabel("worsened"), "May be getting worse");
assert.equal(caregiverStatusLabel("improved"), "May be improving");
assert.equal(caregiverStatusLabel("new"), "New");
assert.equal(caregiverFieldLabel("sleep"), "Sleep");
assert.equal(caregiverFieldLabel("mobility"), "Movement");
assert.equal(caregiverSafeGeneratedText("This has moderate confidence."), null);
assert.equal(caregiverSafeGeneratedText("The evidence supports this conclusion."), "The evidence supports this conclusion.");
assert.equal(caregiverSafeGeneratedText("The doctor ordered a diagnostic test."), "The doctor ordered a diagnostic test.");
assert.equal(caregiverSafeAssistantText("A tooth extraction is planned next week."), "A tooth extraction is planned next week.");
assert.equal(caregiverSafeGeneratedText("The diagnostic pipeline failed."), null);
assert.equal(caregiverSafeGeneratedText("A few details may need checking."), "A few details may need checking.");
assert.equal(caregiverSafeAssistantText("I am not confident about this detail."), "I am not confident about this detail.");

assert.equal(caregiverInformationLabel("observed"), "Seen by a caregiver");
assert.equal(caregiverInformationLabel("inferred"), "Possible explanation");
assert.equal(caregiverInformationLabel("uncertain"), "Not sure yet");
assert.equal(caregiverStatusLabel("unknown_internal_state"), null);
assert.equal(caregiverSituationStateLabel("worsening"), "Caregiver reports worsening");
assert.equal(caregiverSituationStateLabel("improving"), "Caregiver reports improvement");
assert.equal(caregiverSituationStateLabel("resolved"), "Resolved");
assert.equal(caregiverSituationStateLabel("unknown"), "Needs more information");
assert.equal(caregiverInformationLabel("reported"), "Caregiver report");
assert.equal(caregiverInformationAreaLabel("open_questions"), "Questions to answer");
assert.equal(caregiverInformationAreaLabel("evidence_freshness_assessments"), "How recent the information is");
assert.equal(caregiverInformationAreaLabel("unknown_internal_area"), null);
assert.equal(caregiverInformationLabel("epistemic_unknown"), null);
assert.equal(caregiverFieldLabel("medication_name"), "Medication name as reported");
assert.equal(caregiverFieldLabel("dose"), "Dose as reported");
assert.equal(caregiverFieldLabel("medication_name"), "Medication name as reported");
assert.equal(caregiverFieldLabel("medication_status"), "Medication status as reported");
assert.equal(caregiverFieldLabel("reported_weight_change"), "Weight change reported");
assert.equal(caregiverFieldLabel("unknown_internal_field"), null);
assert.equal(caregiverInformationAreaLabel("handoffs"), "Care information shared with another caregiver");
assert.equal(caregiverInformationAreaLabel("caregiver_observations"), "What a caregiver noticed");
assert.equal(caregiverInformationAreaLabel("reconciliations"), "Reports checked against each other");
const readableCapture = caregiverReadableCaptureText(JSON.stringify({
  quick_check_in: { kind: "same_as_usual", selected_areas: ["poor_sleep", "epistemic_status", "blood_pressure"] },
}));
assert.match(readableCapture ?? "", /Sleep/);
assert.match(readableCapture ?? "", /Blood pressure/);
assert.doesNotMatch(readableCapture ?? "", /epistemic|poor_sleep|blood_pressure/);
const prefixedReadableCapture = caregiverReadableCaptureText("Structured daily capture — " + JSON.stringify({
  capture_idempotency_key: "test-key-not-for-caregivers",
  observation: "Caregiver reports that Mum slept poorly last night.",
  source: "structured_daily_capture",
  capture_request_fingerprint: "test-fingerprint-not-for-caregivers",
}));
assert.match(prefixedReadableCapture ?? "", /Mum slept poorly last night/,
  "prefixed structured care notes must preserve the original caregiver observation");
assert.doesNotMatch(prefixedReadableCapture ?? "", /capture_idempotency_key|capture_request_fingerprint|structured_daily_capture|test-fingerprint/,
  "structured capture metadata must never appear in caregiver-facing wording");


assert.equal(caregiverFieldLabel("reconciliation"), "Updating your care information");
assert.equal(caregiverFieldLabel("delta_engine"), "Changes since your last visit");
assert.equal(caregiverProductTermLabel("provenance"), "Where this information came from");
assert.equal(caregiverProductTermLabel("evidence"), "Related notes and documents");
assert.equal(caregiverProductTermLabel("epistemic status"), "What is known, what is unclear, or not recorded");
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
assert.equal(caregiverSafeAssistantText('"Qwen inference is unavailable"'), null, "JSON-encoded technical diagnostics must not bypass the caregiver-language boundary");
assert.equal(caregiverSafeAssistantText("123"), "123");
assert.equal(caregiverSafeAssistantText("true"), null);
assert.equal(caregiverSafeAssistantText("LCR Delta Engine completed"), null);
assert.equal(caregiverSafeAssistantText("Qwen inference is unavailable"), null);
assert.equal(caregiverSafeGeneratedText("The confidence score is low and the evidence is incomplete."), null);
assert.equal(caregiverSafeGeneratedText("The provenance and retrieval results are incomplete."), null);
assert.equal(caregiverSafeGeneratedText("The backend could not confirm the claim."), null);
assert.equal(caregiverSafeGeneratedText("The evidence retrieval pipeline is incomplete."), null);
assert.equal(caregiverSafeGeneratedText("The claim assessment is still running."), null);
assert.equal(caregiverSafeGeneratedText("The technical details are not available."), null);
assert.equal(caregiverSafeGeneratedText("Your care assessment is scheduled for Tuesday, and the notes describe a change."), "Your care assessment is scheduled for Tuesday, and the notes describe a change.");
assert.equal(caregiverSafeGeneratedText("I cannot be confident about the cause yet."), "I cannot be confident about the cause yet.");
assert.equal(caregiverSafeGeneratedText("The notes provide some evidence, but we are not confident about the cause."), "The notes provide some evidence, but we are not confident about the cause.");
assert.equal(caregiverSafeGeneratedText("Your care update was saved. We do not know what changed yet."), "Your care update was saved. We do not know what changed yet.");
assert.equal(caregiverSafeGeneratedText("Your care update was saved. We do not know what caused the change yet."), "Your care update was saved. We do not know what caused the change yet.");
assert.equal(caregiverSafeAssistantText("Your note mentions evidence and confidence."), "Your note mentions evidence and confidence.");

assert.equal(isTechnicalDiagnosticText("Database schema unavailable"), true);
assert.equal(isTechnicalDiagnosticText("The LCR Delta Engine completed"), true);
assert.equal(isTechnicalDiagnosticText("Qwen inference is unavailable"), true);
assert.equal(isTechnicalDiagnosticText("The reconciliation assertion is incomplete"), true);
assert.equal(
  caregiverSafeAssistantText("Your message has been saved. We do not know what caused the change yet."),
  "Your message has been saved. We do not know what caused the change yet.",
);
assert.match(caregiverSafeErrorMessage(), /check your connection/i);

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const caregiverUiLanguageScanner = read("./verify-caregiver-ui-language-all.mts");
const dailyCare = read("../src/app/workspace/daily-care/page.tsx");
const situationResponse = read("../src/components/mvp-workspace/SituationResponsePanel.tsx");
const sourceIndicator = read("../src/components/trust/SourceIndicator.tsx");
const trustIndicators = read("../src/lib/trust-provenance/trust-indicators.ts");
const qwenAssist = read("../src/components/qwen/QwenAssistPanel.tsx");
const lcrQwenInterpretation = read("../src/components/mvp-workspace/LcrQwenInterpretation.tsx");
const shareSummary = read("../src/components/mvp-workspace/share/ShareCareSummaryPanel.tsx");
const legalDocuments = read("../src/lib/trust-content/legal-documents.ts");
const careCaptureLegacy = read("../src/components/CareCapture.tsx");
const careContinuityIntegrityPanel = read("../src/components/CareContinuityIntegrityPanel.tsx");
const companion = read("../src/components/workflows/AICompanion.tsx");
const documentReview = read("../src/components/DocumentIntelligenceReview.tsx");
const documentsPage = read("../src/app/workspace/documents/page.tsx");
const settings = read("../src/app/workspace/settings/page.tsx");
const caregiverAccessPanel = read("../src/components/mvp-workspace/CaregiverAccessPanel.tsx");
const followUpsPage = read("../src/app/workspace/open-loops/page.tsx");
const reminders = read("../src/app/workspace/reminders/page.tsx");
const openLoopsPage = read("../src/app/workspace/open-loops/page.tsx");
const lcr = read("../src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
const livingCareRecordPanel = read("../src/components/mvp-workspace/LivingCareRecordPanel.tsx");
const changeIntelligence = read("../src/components/mvp-workspace/ChangeIntelligencePanel.tsx");
const dailyCareIntelligence = read("../src/components/workflows/DailyCareQwen.tsx");
const naturalDailyUpdate = read("../src/components/workflows/NaturalLanguageDailyUpdate.tsx");
const handoff = read("../src/components/workflows/CareHandoffSharing.tsx");
const claimReview = read("../src/components/ClaimAssessmentPanel.tsx");
const appointment = read("../src/components/workflows/AppointmentWorkspace.tsx");
const detailedAppointment = read("../src/components/workflows/DetailedAppointmentWorkspace.tsx");
const dailyCapture = read("../src/components/workflows/StructuredDailyCapture.tsx");
const policySettings = read("../src/components/mvp-workspace/PolicySettingsPanel.tsx");
const identityRecovery = read("../src/components/mvp-workspace/IdentityDeviceRecoveryPanel.tsx");
const caregiverAccess = read("../src/components/mvp-workspace/CaregiverAccessPanel.tsx");
const dementiaProfile = read("../src/components/mvp-workspace/DementiaCareProfilePanel.tsx");
const dementiaObservation = read("../src/components/mvp-workspace/DementiaObservationPanel.tsx");
const aiAttribution = read("../src/components/trust/AIAttribution.tsx");
const companionRoute = read("../src/app/workspace/companion/page.tsx");
const historyDrawer = read("../src/components/app-shell/HistoryDrawer.tsx");
const careDelta = read("../src/components/CareDeltaPanel.tsx");
const careChangeHistory = read("../src/components/mvp-workspace/CareChangeHistoryPanel.tsx");
const humanValidation = read("../src/components/HumanValidationLoop.tsx");
const careCapture = read("../src/components/CareCapture.tsx");
const feedbackPrompt = read("../src/components/mvp-workspace/UnderstandingFeedbackPrompt.tsx");
const appShell = read("../src/components/app-shell/AppShell.tsx");
const workspaceLayout = read("../src/app/workspace/layout.tsx");
const photoCapture = read("../src/components/workflows/DailyCarePhotoCapture.tsx");
const quickCheckIn = read("../src/components/workflows/QuickDailyCheckIn.tsx");
const cognitiveWorkspace = read("../src/components/mvp-workspace/CognitiveWorkspace.tsx");
const structuredDailyCapture = read("../src/components/workflows/StructuredDailyCapture.tsx");
const captureAnalysisReview = read("../src/components/workflows/CaptureAnalysisReview.tsx");
const evidenceReview = read("../src/components/EvidenceReviewPanel.tsx");
const earlyAccessConsent = read("../src/components/public/EarlyAccessConsentForm.tsx");
const community = read("../src/components/workflows/Community.tsx");
const caregiverHandoverInbox = read("../src/components/mvp-workspace/CaregiverHandoverInbox.tsx");
const clarificationWorkflow = read("../src/components/ClarificationWorkflowPanel.tsx");
const careHandoffSharing = read("../src/components/workflows/CareHandoffSharing.tsx");
assert.match(companion, /message\.role === 'assistant'[\s\S]*?caregiverSafeGeneratedText\(message\.text\)/, "restored Companion answers must pass through the same caregiver-language boundary as new answers");
assert.match(structuredDailyCapture, /caregiverSafeAssistantText\(item\.name\)/,
  "saved medication names must use readable caregiver text");
assert.match(structuredDailyCapture, /caregiverSafeAssistantText\(item\.dose\)/,
  "saved medication doses must not expose raw structured metadata");
assert.match(structuredDailyCapture, /caregiverSafeAssistantText\(item\.source_text\)/,
  "saved medication source notes must use readable caregiver text");
assert.match(clarificationWorkflow, /caregiverSafeAssistantText\(item\.answer\)/,
  "saved clarification answers must not expose raw structured metadata");
assert.match(clarificationWorkflow, /caregiverSafeAssistantText\(item\.answer_provenance\)/,
  "saved clarification attribution must use readable caregiver text");
assert.match(cognitiveWorkspace, /caregiverSafeAssistantText\(savedEventReceipt\.title\)/,
  "saved care receipt titles must not expose raw structured metadata");
assert.match(cognitiveWorkspace, /caregiverSafeAssistantText\(savedEventReceipt\.description\)/,
  "saved care receipt descriptions must use readable caregiver text");
assert.match(dementiaObservation, /caregiverSafeAssistantText\(item\.description\)/,
  "saved dementia observations must not expose raw structured metadata");
assert.match(identityRecovery, /caregiverSafeAssistantText\(device\.label\)/,
  "device labels must not expose raw structured values");
assert.match(companion, /caregiverSafeAssistantText\(source\.reported_by\)/,
  "Companion source attribution must not expose raw structured values");
assert.match(companion, /caregiverSafeAssistantText\(source\.entered_by\)/,
  "Companion source entry attribution must use readable labels");
assert.match(companion, /caregiverSafeAssistantText\(source\.correction_note\)/,
  "Companion correction notes must not expose raw structured metadata");
assert.match(companion, /caregiverSafeAssistantText\(source\.correction_rationale\)/,
  "Companion correction explanations must use readable text");
assert.match(companion, /caregiverSafeAssistantText\(observation\.value\)/,
  "Companion saved observation values must not expose raw structured metadata");
assert.match(companion, /caregiverSafeAssistantText\(source\.previous_source_excerpt\)/,
  "Companion correction history excerpts must use the caregiver-language boundary");
assert.match(companion, /caregiverSafeAssistantText\(source\.source_excerpt\)/,
  "Companion original source excerpts must not expose raw structured metadata");
assert.match(companion, /caregiverSafeAssistantText\(item\.source_excerpt\)/,
  "related Companion source excerpts must not expose raw structured metadata");
assert.match(companion, /caregiverSafeAssistantText\(observation\.source_excerpt\)/,
  "Companion observation source excerpts must not expose raw structured metadata");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(source\.reported_by\)/,
  "LCR interpretation source attribution must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(source\.entered_by\)/,
  "LCR interpretation entry attribution must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(source\.source_excerpt\)/,
  "LCR interpretation source excerpts must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(evidence\.reported_by\)/,
  "Related LCR evidence attribution must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(evidence\.entered_by\)/,
  "Related LCR evidence entry attribution must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(evidence\.source_excerpt\)/,
  "Related LCR evidence excerpts must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(observation\.reported_by\)/,
  "LCR observation attribution must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(observation\.source_excerpt\)/,
  "LCR observation source excerpts must use caregiver-safe text");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(claim\.aggregate\?\.window_label\)/,
  "LCR aggregate time-window labels must use caregiver-safe text");

assert.match(documentReview, /We couldn't confirm whether your review was saved\. Refresh the review history before trying again/,
  "document review failures must not claim an uncertain review was not saved");
assert.match(careHandoffSharing, /caregiverSafeAssistantText\(recipient\.name\) \|\| "Caregiver"/,
  "handoff recipient names must use readable caregiver text");
assert.match(careHandoffSharing, /caregiverSafeAssistantText\(recipient\.relationship\) \|\| "Linked caregiver"/,
  "handoff recipient relationships must use readable caregiver text");
assert.match(caregiverHandoverInbox, /caregiverSafeAssistantText\(item\.from_caregiver_name\)/,
  "incoming handover names must not expose raw structured metadata");
assert.match(caregiverHandoverInbox, /caregiverSafeAssistantText\(item\.reason\)/,
  "incoming handover reasons must use readable caregiver text");
assert.match(caregiverHandoverInbox, /We couldn't confirm whether your response was saved\. Refresh the handover list before trying again/,
  "handover response failures must not claim an uncertain response was not saved");
assert.match(humanValidation, /We couldn't confirm whether feedback was saved\. Check again before submitting it a second time/,
  "feedback submission failures must avoid encouraging duplicate submissions");
assert.match(documentReview, /analysis\.open_questions\?\.map\(\(question, i\) => <li key=\{i\}>\{caregiverSafeGeneratedText\(question\)/,
  "document review questions must use the caregiver-language boundary in every display location");
assert.match(livingCareRecordPanel, /Boolean\(view\.what_seems_happening\) \|\| factCandidates\.length > 0/,
  "filtered care summaries must keep the What is happening section visible");
assert.match(livingCareRecordPanel, /view\.what_changed_in_understanding[\s\S]*?The explanation of this change could not be shown clearly/,
  "filtered change explanations must not silently disappear");
assert.match(livingCareRecordPanel, /view\.connection_note[\s\S]*?The possible connection could not be explained clearly/,
  "filtered possible connections must retain an uncertainty explanation");
assert.match(livingCareRecordPanel, /mattersCandidateCount > mattersVisibleCount/,
  "partly filtered What to watch details must be disclosed");
assert.match(livingCareRecordPanel, /view\.baseline_summary[\s\S]*?The earlier care summary could not be shown clearly/,
  "filtered baseline summaries must remain visible as unavailable");
assert.match(livingCareRecordPanel, /view\.why_asking &&[\s\S]*?The reason for these questions could not be explained clearly/,
  "filtered question context must retain an explanation");
assert.match(livingCareRecordPanel, /view\.care_story_update[\s\S]*?The care history update could not be shown clearly/,
  "filtered care story updates must not disappear silently");


assert.match(caregiverUiLanguageScanner, /ts\.isCallExpression\(node\) \|\| ts\.isNewExpression\(node\)[\s\S]*?collectDisplayExpression\(sourceFile, argument\)/,
  "the language scanner must inspect literal caregiver copy passed through helper calls");
assert.match(caregiverUiLanguageScanner, /const roots = \["src\/app", "src\/components"\]/,
  "the language scanner must cover all application routes and UI components");
assert.doesNotMatch(dailyCare, /epistemic_status\.replace|item\.status\.replace/);
assert.doesNotMatch(dailyCare, /item\.event_type \|\| item\.source_type/);
assert.match(dailyCare, /item\.original_text\.trim\(\)/, "original caregiver reports must remain verbatim");
assert.match(dailyCare, /caregiverSafeGeneratedText\(item\.source_label\)/, "server-provided Daily Care source labels must use caregiver language");
assert.match(dailyCare, /item\.corrected_text\.trim\(\)/, "corrected caregiver reports must remain verbatim");
assert.doesNotMatch(dailyCare, /caregiverSafeAssistantText\(item\.(original_text|corrected_text|reason)\)/, "assistant-output filtering must not be applied to caregiver source text");
assert.doesNotMatch(dailyCare, /The latest information currently available in the care record|Processing has not started yet|Document understanding could not be completed|Document processing was stopped|Care Timeline|change and pattern assessments/);
assert.match(dailyCare, /SolenOS has finished reading it/);

assert.match(dailyCare, /caregiverSafeGeneratedText\(item\.capture_processing\?\.message\)/, "Daily Care processing messages from the server must use caregiver language");
assert.match(dailyCare, /caregiverSafeGeneratedText\(item\.push_delivery\?\.message\)/, "notification messages from the server must use caregiver language");
assert.doesNotMatch(dailyCare, /Notification delivery needs attention|Notification delivery status could not be/i,
  "Daily Care must not expose technical notification-delivery terminology");

assert.match(photoCapture, /We could not confirm which Care Record to use/);
assert.match(photoCapture, /saved securely on this device/);
assert.match(photoCapture, /waiting to be added to your Care Record/);
assert.match(photoCapture, /Photograph saved with your care information/);
assert.doesNotMatch(photoCapture, /care session could not be verified|care-record evidence|sync with the care record|encrypted and saved on this device/i,
  "photo capture must explain save and connection states in caregiver language");
assert.match(dailyCare, /This update is being checked\. You can keep using SolenOS\./, "technical processing messages must have a caregiver-readable fallback");
assert.match(dailyCare, /Your saved note is still available\./, "processing failures must preserve the confirmed saved-note state");
assert.match(dailyCare, /Open care history/);
assert.doesNotMatch(documentsPage, /AI interpretation|Document library|Server processing after upload|extracted statements|document understanding|upload ID|10 MiB/);
assert.match(documentsPage, /Your original files are kept separate from suggested details/);

assert.match(documentReview, /caregiverSafeGeneratedText\(question\)/, "generated document-review questions must use caregiver language");
assert.match(documentReview, /items\.flatMap\(\(item\) => item\.open_questions \|\| \[\]\)\.map\(\(question, index\) =>[\s\S]*?caregiverSafeGeneratedText\(question\)/, "document-level review questions must use the same caregiver-language boundary as per-document questions");
assert.match(documentReview, /caregiverSafeGeneratedText\(warning\)/, "generated document-review warnings must use caregiver language");
assert.match(documentsPage, /caregiverSafeGeneratedText\(versionComparison\.reason\)/, "document comparison explanations must use caregiver language");

assert.match(documentsPage, /No differences were found in the text SolenOS could read/);
assert.doesNotMatch(appointment, /source completeness|Recorded observations and caregiver reports|item\(s\) shown|saved source\(s\)/);
assert.match(appointment, /Saved care details/);
assert.match(appointment, /Questions to ask the healthcare professional/);
assert.doesNotMatch(detailedAppointment, /clinician findings|Consultation opening summary|clinical follow-up remains open|Closure status|stated rationale/);
assert.doesNotMatch(policySettings, /Living Care Record|Companion conversations|eligible feedback|Direct identifiers|processing path|retention and handling rules|opt-in preference|opt-out preference/);
assert.match(policySettings, /Your choice is saved/);
assert.doesNotMatch(identityRecovery, /device registration|registered devices|one-time recovery code|revokes every existing session/);
assert.doesNotMatch(caregiverAccess, /responsibility_type\.replaceAll|transfer responsibility|primary caregiver transfer declined|No change should be assumed|invitation_token}</);
assert.match(caregiverAccess, /Copy invitation link/);
assert.doesNotMatch(caregiverAccess, /Living Care Record|care circle|Care coverage|care coverage gap|care context/i,
  "caregiver sharing and responsibility screens must use everyday language");
assert.match(caregiverAccess, /Who is helping with care/);
assert.match(caregiverAccess, /Share with other caregivers/);
assert.doesNotMatch(dementiaProfile, /Behaviour and emotional wellbeing|Mobility and coordination|Recorded dementia stage/);
assert.match(dementiaProfile, /Memory and knowing where you are/);
assert.doesNotMatch(dementiaObservation, /Dementia observations|Save observation|Recent observations/);
assert.match(dementiaObservation, /Notes about memory and daily life/);
assert.match(dementiaObservation, /row\.observation_category\.trim\(\)\.toLowerCase\(\)\.startsWith\("dementia\."\)/, "saved dementia observations must be recognized regardless of category casing or surrounding whitespace");
assert.match(dementiaObservation, /item\.observation_category\.trim\(\)\.toLowerCase\(\)/, "dementia observation labels must map consistently from saved category values");

assert.doesNotMatch(aiAttribution, /High confidence AI insight|Medium confidence AI insight|Low confidence AI insight|Confidence level:|AI Attribution/);
assert.match(aiAttribution, /Suggested detail — please check/);
assert.match(sourceIndicator, /Details found in document/);
assert.match(sourceIndicator, /Suggested by SolenOS/);
assert.doesNotMatch(sourceIndicator, /Extracted from document|AI-generated/);
assert.doesNotMatch(trustIndicators, /Extracted from document|Low confidence|Missing supporting evidence|Awaiting confirmation/);
assert.match(trustIndicators, /Needs checking/);
assert.match(trustIndicators, /Some details are still missing/);
assert.ok(qwenAssist.startsWith('"use client";'), "legacy Qwen panel must retain its Next.js client-component directive");
assert.doesNotMatch(qwenAssist, /Living Care Record|AI-assisted interpretation|Suggestions are not saved to the Living Care Record/);
assert.match(qwenAssist, /caregiverSafeGeneratedText\(claim\.text\)/,
  "legacy Qwen claims must use the caregiver language boundary");
assert.match(qwenAssist, /caregiverSafeAssistantText\(claim\.aggregate\?\.window_label\)/,
  "legacy Qwen aggregate time-window labels must use caregiver-safe text");
assert.match(qwenAssist, /caregiverSafeAssistantText\(source\.reported_by\)/,
  "legacy Qwen source attribution must not expose raw structured values");
assert.match(qwenAssist, /caregiverSafeGeneratedText\(source\.source_state_label\)/,
  "legacy Qwen source statuses must use caregiver-safe labels");
assert.match(qwenAssist, /caregiverSafeAssistantText\(source\.source_excerpt\)/,
  "legacy Qwen source excerpts must not expose raw diagnostics");
assert.match(qwenAssist, /caregiverSafeAssistantText\(observation\.value \|\| observation\.attribute\)/,
  "legacy Qwen observation values must use readable caregiver text");
assert.match(qwenAssist, /caregiverSafeGeneratedText\(reply\.reply\)/,
  "legacy Qwen answers must use the caregiver-language boundary");
assert.match(qwenAssist, /caregiverSafeGeneratedText\(item\.reply\)/,
  "saved legacy Qwen answers must remain caregiver-safe when reopened");

assert.match(qwenAssist, /Suggestions are not added to your Care Record unless you choose to save and approve them/);
assert.match(lcrQwenInterpretation, /What this update may mean/);
assert.match(lcrQwenInterpretation, /Looking at earlier care information/);
assert.match(lcrQwenInterpretation, /We couldn’t connect this update with earlier care information right now/);
assert.match(lcrQwenInterpretation, /notes or documents/);
assert.doesNotMatch(lcrQwenInterpretation, /Record context|Context interpretation is temporarily unavailable|Context supplied:|No saved source records were returned/,
  "care-update interpretation must use plain language for context and missing information");
assert.doesNotMatch(careDelta, /Do not present AI suggestions/);
assert.match(shareSummary, /draft prepared with help from SolenOS/);
assert.doesNotMatch(shareSummary, /AI-assisted draft|Living Care Record/);
assert.doesNotMatch(legalDocuments, /Living Care Record|AI-assisted|AI-generated|Qwen-powered|Ollama|model runtime|technical design/);
assert.match(legalDocuments, /SolenOS is designed to use a private AI service/);

assert.doesNotMatch(companion, /SolenOS Companion|AI Companion|Grounded, not guesswork|saved item\(s\)/);
assert.doesNotMatch(documentReview, /Background processing|processing problem|processing in the background|SolenOS is processing|SolenOS is retrying/);
assert.match(documentReview, /SolenOS is reading the document in the background/);
assert.doesNotMatch(dailyCare, /Document processing status could not be read|document library before assuming processing is complete/);
assert.match(dailyCare, /Open Documents to see the latest update/);
assert.doesNotMatch(appointment, /Information status not available|Review status not available|related note\(s\)|saved items/);
assert.match(appointment, /Notes and documents:/);
assert.doesNotMatch(settings, /anonymous session|one-time recovery code|Clear local data/);
assert.match(settings, /Clear saved information from this device/);
assert.doesNotMatch(companion, /distinct, dated|The same wording appears in .*saved item/);

assert.match(companion, /Based on saved information/);
assert.match(companion, /source\.evidence_reviews/);
assert.match(companion, /item\.evidence_reviews/);
assert.match(companion, /Reviewing a note or document does not by itself confirm that a care detail is true/);
assert.match(companion, /Only the latest reviews are shown here/);
assert.match(companion, /No review of this note or document has been recorded/);
assert.match(companion, /history shown here may be incomplete/);

assert.match(companion, /caregiverSafeGeneratedText\(response\.reply\)/);
assert.match(companion, /caregiverSafeGeneratedText\(msg\.safety_note\)/, "dynamic Companion safety notes must use caregiver language");
assert.match(companion, /caregiverSafeGeneratedText\(source\.label\)/, "dynamic Companion source labels must use caregiver language");
assert.match(companion, /caregiverSafeGeneratedText\(item\.label\)/, "related Companion source labels must use caregiver language");
assert.match(companion, /caregiverFieldLabel\(observation\.attribute\)/, "internal care-field keys must be translated or omitted");
assert.match(companion, /caregiverStatusLabel\(item\.status\)/, "saved Companion review statuses must use caregiver-facing labels");
assert.match(companion, /caregiverStatusLabel\(entry\.decision\)/, "Companion review history decisions must use caregiver-facing labels");
assert.match(companion, /caregiverSafeGeneratedText\(item\.proposed_change\?\.asserted_value\)/, "proposed care details must pass through the generated-text boundary");
assert.match(companion, /caregiverSafeAssistantText\(item\.proposed_change\?\.source_quote\)/, "original caregiver wording must be checked before display");
assert.match(companion, /caregiverSafeAssistantText\(entry\.correction_context\)/, "saved correction context must use readable caregiver text");
assert.match(companion, /caregiverSafeAssistantText\(item\.proposed_change\.event_time_text\)/, "reported event times must not expose structured metadata");

assert.match(companion, /caregiverSafeGeneratedText\(entry\.rationale\)/, "server-generated review explanations must use caregiver language in every review-history view");

assert.match(companion, /caregiverSafeGeneratedText\(source\.source_state_label\)/, "generated source-status explanations must use caregiver language");
assert.match(companion, /caregiverSafeGeneratedText\(review\.rationale\)/, "generated source-review explanations must use caregiver language");
assert.match(companion, /Care summary shared with another caregiver/, "Companion must not expose internal handoff terminology in source labels");
assert.match(companion, /Information checked against other reports/, "Companion must explain report comparisons in everyday language");

assert.doesNotMatch(companion, /entry\.decision\.replace\(/, "raw review decision codes must never be rendered");
assert.doesNotMatch(companion, /item\.status\.replace\(|entry\.decision\.replace\(/, "raw backend status codes must never be shown to caregivers");
assert.match(companion, /caregiverSafeGeneratedText\(claim\.text\)/);
assert.match(companion, /caregiverSafeGeneratedText\(claim\.aggregate_review\?\.interpretation_limit\)/);
assert.match(companion, /caregiverSafeAssistantText\(claim\.aggregate\?\.window_label\) \|\| "the selected time period"/, "Companion aggregate time windows must use caregiver-safe text and an honest fallback");

assert.match(appointment, /caregiverFieldLabel\(item\.field\)/, "appointment details must translate internal field names");
assert.match(appointment, /caregiverSafeGeneratedText\(item\.necessity_rationale\)/, "generated appointment explanations must use caregiver language");
assert.match(appointment, /caregiverSafeGeneratedText\(item\.question\)/, "suggested appointment questions must use caregiver language");
assert.match(appointment, /caregiverSafeGeneratedText\(item\.interpretation_limit\)/, "appointment limits must use caregiver language in every view");
assert.match(appointment, /caregiverSafeGeneratedText\(item\.rationale\)/, "server-generated appointment review explanations must use caregiver language");
assert.match(appointment, /caregiverSafeGeneratedText\(item\.interpretation_limit\)/, "generated appointment limits must use caregiver language");
assert.match(appointment, /caregiverSafeGeneratedText\(item\.source_label\)/, "generated appointment source labels must use caregiver language");
assert.match(appointment, /item\.missing_fields\.map\(field => caregiverFieldLabel\(field\)\)/, "missing field names must be translated before display");

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
assert.match(dailyCareIntelligence, /caregiverSafeGeneratedText\(result\.answer\)/);
assert.match(dailyCareIntelligence, /caregiverSafeGeneratedText\(proposal\.title\)/);
assert.match(dailyCareIntelligence, /caregiverSafeGeneratedText\(result\.notice\)/);
assert.match(dailyCareIntelligence, /caregiverSafeErrorMessage/);
assert.match(lcrQwenInterpretation, /caregiverSafeGeneratedText\(state\.result\.reply\)/);
assert.match(lcrQwenInterpretation, /caregiverSafeGeneratedText\(claim\.text\)/);
const whyAmISeeingThis = read("../src/components/trust/WhyAmISeeingThis.tsx");
assert.match(aiAttribution, /caregiverSafeGeneratedText\(explanation\)/);
assert.match(whyAmISeeingThis, /caregiverSafeGeneratedText\(aiInterpreted\)/);

assert.match(naturalDailyUpdate, /caregiverSafeErrorMessage/);
assert.match(naturalDailyUpdate, /We couldn’t confirm which Care Record to use/);
assert.match(naturalDailyUpdate, /Your update is saved on this device/);
assert.doesNotMatch(naturalDailyUpdate, /care session could not be verified|encrypted on this device|encrypted and saved|waiting to sync|pending-update controls/i,
  "offline capture messages must describe what happened in everyday language");
assert.doesNotMatch(naturalDailyUpdate, /setError\(\s*cause\.message/);
assert.match(naturalDailyUpdate, /reason\.includes\("could not securely keep an offline copy"\)/, "only the explicit local-save error may be surfaced; raw backend errors remain sanitized");
assert.match(claimReview, /caregiverStatusLabel/);
assert.equal(claimReview.includes("review version ${assessmentImpact.assessment_version}"), false);
assert.match(handoff, /function readableStatus\(value: string\): string \{\s+return caregiverStatusLabel\(value\) \?\? "Not available";/);
assert.match(appointment, /caregiverSafeAssistantText\(item\.title\)/);
assert.match(detailedAppointment, /caregiverSafeAssistantText\(source\.original_author\)/);
assert.doesNotMatch(detailedAppointment, /Evidence IDs:|Assessment \{item\.assessment_id/);
assert.doesNotMatch(dailyCapture, /Care-record reconciliation:|change and pattern assessments|Accept and add to LCR|LCR fact|No LCR assertion|Living Care Record/);
assert.match(dailyCapture, /Your original update:/);
assert.match(dailyCapture, /Add to Care Record/);
assert.doesNotMatch(documentReview, /Document intelligence review|OCR reading confidence|CORRECTION AWAITING APPROVAL|PENDING CAREGIVER REVIEW|SAVED AS UNCONFIRMED REPORT|statement\(s\)/);
assert.match(documentReview, /Text read from your document/);
assert.match(documentReview, /Page in document:/, "page references must be understandable without backend terminology");
assert.match(documentReview, /This only tells us how clearly SolenOS could read the words/, "document reading limitations must use plain language");
assert.match(documentReview, /Short label for this detail/,
  "document review must let caregivers correct the subject without rewriting the preserved source quotation");
assert.match(documentReview, /Text SolenOS read from the document/,
  "the original extracted wording must remain visible and unchanged during correction");
assert.match(documentReview, /corrected_observation: sourceQuote/,
  "document corrections must preserve the exact quoted source rather than replacing original evidence");
assert.match(documentReview, /Suggest a correction/);
assert.doesNotMatch(documentReview, /OCR reading confidence|extraction pipeline|candidate review status|longitudinal retrieval|reconciliation status/i, "document review must not expose internal processing language");
assert.doesNotMatch(documentReview, /event\.decision\}/);
assert.doesNotMatch(settings, /Living Care Record|anonymous session|Clear local data/);
assert.doesNotMatch(policySettings, /Living Care Record|Companion conversations|eligible feedback|Direct identifiers|processing path|retention and handling rules/);
assert.match(policySettings, /Your full Care Record or your full care history/);
assert.doesNotMatch(identityRecovery, /device registration|registered devices|one-time recovery code|revokes every existing session/);
assert.match(identityRecovery, /Get back into your account/);
assert.doesNotMatch(caregiverAccess, /responsibility_type\.replaceAll|transfer responsibility|primary caregiver transfer declined|No change should be assumed/);
assert.doesNotMatch(careContinuityIntegrityPanel, /Review status:|Checked against a source/);
assert.match(careContinuityIntegrityPanel, /Has this been checked\?/);
assert.match(careContinuityIntegrityPanel, /Changes to your Care Record/);
assert.match(caregiverAccess, /Hand over a care task/);
assert.doesNotMatch(appointment, /source completeness|Recorded observations and caregiver reports|Information status unavailable|item\(s\) shown|saved source\(s\)/);
assert.doesNotMatch(detailedAppointment, /clinician findings|Consultation opening summary|clinical follow-up remains open|Closure status/);
assert.match(detailedAppointment, /Summary to start the visit/);
assert.doesNotMatch(companionRoute, /SolenOS Companion/);



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
assert.match(lcr, /<summary>More about this item<\/summary>/, "record-level details must remain available through progressive disclosure");
assert.match(lcr, /No care updates recorded yet/, "a genuinely empty record must use the current honest empty-state copy");
assert.doesNotMatch(lcr, /We couldn’t check which items may need attention\. Try refreshing\./);
assert.match(lcr, /CURRENT_CARE_TITLE_LABELS/);
assert.match(lcr, /Original report text is not available in this view/);
assert.match(lcr, /Read original report/);
assert.match(lcr, /caregiverFieldLabel\(observation\.attribute\)/);
assert.match(lcr, /caregiverFieldLabel\(assertion\.field\)/);
assert.match(lcr, /caregiverSafeChangeText\(change\.explanation\)/);
assert.match(lcr, /caregiverSafeChangeText\(change\.previous_state\)/);
assert.match(careChangeHistory, /readableSource\(run\.source\)/);
assert.match(careChangeHistory, /readableChangeType\(item\.change_type,\s*item\.classification\)/);
assert.match(careChangeHistory, /displayChangeText\(item\.comparison_basis/);
assert.doesNotMatch(careChangeHistory, /display\(run\.source/);
assert.doesNotMatch(lcr, /<p>\{change\.explanation\}<\/p>/);
assert.match(lcr, /caregiverReadableCaptureText\(source\.source_passage\)/, "original caregiver notes must remain readable without exposing serialized data");

const workspaceNav = read("../src/lib/workspace-navigation.ts");
const workspaceHome = read("../src/app/workspace/page.tsx");
const followUps = read("../src/app/workspace/open-loops/page.tsx");
const timeline = read("../src/app/workspace/timeline/page.tsx");
const informationStatus = read("../src/components/trust/InformationStatus.tsx");
const statusCareDelta = read("../src/components/CareDeltaPanel.tsx");
const careOverviewPage = read("../src/app/workspace/care-continuity/page.tsx");
const sourceReview = read("../src/components/EvidenceReviewPanel.tsx");
const conflictReview = read("../src/components/ConflictResolutionPanel.tsx");
const clarificationReview = read("../src/components/ClarificationWorkflowPanel.tsx");
const appointmentWorkspace = read("../src/components/workflows/AppointmentWorkspace.tsx");
const careContinuity = read("../src/components/CareContinuityIntegrityPanel.tsx");
assert.doesNotMatch(appointment, /technical retrieval failure|technical failure|Retry care-record retrieval|Retry document retrieval/i,
  "appointment messages must explain missing information without technical failure language");
assert.doesNotMatch(detailedAppointment, /Extraction status not available/i,
  "appointment details must not expose document-processing labels");
assert.doesNotMatch(handoff, /Linked evidence:|Validation:|retrieval limitations|Source freshness reviews|Record completeness reviews|Saved evidence/i,
  "care handoffs must describe notes, documents and review limits in everyday language");
assert.match(handoff, /Related notes and documents:/);
assert.doesNotMatch(lcr, /Your Living Care Record|Progress:|Shared through:|Review status:|Information status:|View supporting evidence|View supporting records|Loading saved evidence|Saved records show .*events every 30 days|Contains negative wording|Tentative wording|Conditional wording|baseline from prior observations/i,
  "the Care Record must not expose internal evidence, baseline or review terminology");
assert.match(lcr, /Your Care Record/);
assert.doesNotMatch(companion, /Source review:|No source review has been recorded|latest source reviews/i,
  "Care Assistant explanations must refer to notes and documents, not source-review terminology");
assert.doesNotMatch(documentReview, /Extraction status|Contains negative wording|Tentative wording|Conditional wording|ORIGINAL WORDS IN THE DOCUMENT/i,
  "document review must use ordinary language");
assert.doesNotMatch(sourceReview, /Evidence records could not be loaded|Saved evidence reviews could not be loaded/i,
  "saved note and document review errors must be caregiver-readable");
assert.doesNotMatch(careContinuity, /Care continuity|Reported care information/);
assert.match(careContinuity, /More about the care information saved here/);
assert.match(careContinuity, /Care information shared/);
assert.doesNotMatch(documentsPage, /upload session|encrypted on this device|sync when your connection returns|safely queued/i);
assert.doesNotMatch(situationResponse, /Saved record reference|situation-reasoning state|This view is reconstructed/i);
assert.doesNotMatch(sourceIndicator, /Source ID:|Source type:|Source Information|Viewing source evidence|sourceId &&/);
assert.doesNotMatch(careCaptureLegacy, /Qwen capture analysis|No verified Qwen candidates|pending_review/);
assert.match(historyDrawer, /aria-label="Care history sections that could not be fully loaded"/, "care history accessibility labels must use caregiver language");
assert.doesNotMatch(historyDrawer, /incomplete retrieval|description=\{error\}/i);
assert.doesNotMatch(statusCareDelta, /Clinician-oriented summary/);
assert.match(statusCareDelta, /Check the summary against saved information/);
assert.match(statusCareDelta, /Model-generated clinician summaries are withheld until they have their own evidence evaluation/);
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
assert.match(careOverviewPage, /Open Daily Care/);
assert.doesNotMatch(careOverviewPage, /Your Living Care Record|AI Companion/);
assert.match(changeIntelligence, /CHANGES IN CARE OVER TIME/);
assert.match(changeIntelligence, /Review notes and documents/);
assert.doesNotMatch(changeIntelligence, /LONGITUDINAL UNDERSTANDING|Past assessment|Review source evidence/);
assert.match(sourceReview, /Notes and documents behind care information/);
assert.match(sourceReview, /Each detail keeps the exact words from the original note or document/);
assert.doesNotMatch(sourceReview, /Saved source reviews|Sources and supporting information/);
assert.match(claimReview, /Choose a note or document/);
assert.match(claimReview, /This information needs another review/);
assert.match(statusCareDelta, /Compare with saved care information/);
assert.match(careRecordOverview, /See what has been saved, who shared it/);
assert.match(persistedOrientation, /hasRequiredSourceGaps \|\| hasOptionalSourceGaps \|\| projection\.schema_status !== "complete" \|\| projection\.item_count > 0[\s\S]*?This does not mean your Care Record is empty[\s\S]*?Your Care Record does not have any care information yet/, "an incomplete or unavailable source view must not be presented as an empty Care Record");
assert.match(workspaceNav, /href: "\/workspace"[\s\S]*?label: "Today"/, "the primary Today destination opens the Care Record");
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
assert.match(workspaceHome, /ask a question about information already saved/);
assert.doesNotMatch(workspaceHome, /AI Companion/);
assert.doesNotMatch(companion, /SolenOS Companion|AI Companion|Send a message to Companion|Companion is responding/);
assert.doesNotMatch(persistedOrientation, /Your Living Care Record|source information|care record item/);
assert.doesNotMatch(changeIntelligence, /saved care assessments|Caregiver-reported status|Saved information used|Care updates included/);
assert.doesNotMatch(historyDrawer, /Living Care Record|LCR revision|Evidence references|caregiver ID|Immutable/);
assert.doesNotMatch(historyDrawer, /evidence_ids\.join|Extracted text|Recorded LCR change|Persisted care decision|Persisted action outcome|Appointment workspace/);
assert.match(historyDrawer, /Text read from the document/);
assert.match(careCapture, /caregiverSafeErrorMessage/);
assert.doesNotMatch(careCapture, /submitError\.message|error\.message|Qwen analysis:/);
assert.match(careCapture, /Suggested care details/);
assert.match(feedbackPrompt, /caregiverSafeErrorMessage/);
assert.doesNotMatch(feedbackPrompt, /error\.message/);
assert.match(dailyCapture, /caregiverSafeErrorMessage/);
assert.match(appShell, /caregiverSafeErrorMessage/);
assert.doesNotMatch(appShell, /window\.alert\(error\.message/);
assert.match(photoCapture, /caregiverSafeErrorMessage/);
assert.doesNotMatch(photoCapture, /message && message\.length < 180/);
assert.match(quickCheckIn, /caregiverSafeErrorMessage/);
assert.doesNotMatch(quickCheckIn, /reason && reason\.length < 180/);
assert.match(cognitiveWorkspace, /sanitizeCaregiverErrorMessage/);
assert.match(cognitiveWorkspace, /setCaregiverError\(sanitizeCaregiverErrorMessage\(/, "caregiver-facing assistant errors pass through the safe message boundary");
assert.match(cognitiveWorkspace, /caregiverSafeGeneratedText\(candidate\.subject\)/, "Daily Care Qwen subjects must use caregiver language");
assert.match(cognitiveWorkspace, /caregiverSafeGeneratedText\(candidate\.observation\)/, "Daily Care Qwen observations must use caregiver language");
assert.match(cognitiveWorkspace, /caregiverSafeGeneratedText\(question\)/, "Daily Care Qwen follow-up questions must use caregiver language");
assert.match(cognitiveWorkspace, /caregiverSafeGeneratedText\(situationResponse\.analysis_warning\)/, "server-generated Daily Care warnings must use caregiver language");
assert.match(structuredDailyCapture, /caregiverSafeGeneratedText\(candidate\.subject\)/, "Daily Care review subjects must use caregiver language");
assert.match(structuredDailyCapture, /caregiverSafeGeneratedText\(candidate\.observation\)/, "Daily Care review observations must use caregiver language");
assert.match(structuredDailyCapture, /caregiverSafeGeneratedText\(question\)/, "Daily Care review questions must use caregiver language");
assert.match(structuredDailyCapture, /open_questions\.length > 0[\s\S]*?Questions were saved, but their wording could not be shown clearly/,
  "filtered Daily Care questions must remain visible as unavailable rather than disappearing silently");
assert.match(structuredDailyCapture, /Some other questions could not be shown clearly/,
  "partially filtered Daily Care question lists must disclose omitted wording");

assert.match(structuredDailyCapture, /decision === 'accept' && candidateNeedsRewrite/, "unsafe Daily Care suggestions must not be accepted into the Care Record");
assert.match(structuredDailyCapture, /candidateNeedsRewrite\} onClick=\{\(\) => void reviewCaptureCandidate\(index, 'accept'\)/, "unsafe Daily Care suggestions must have acceptance disabled");
assert.match(structuredDailyCapture, /Check the original note and correct this suggestion before adding it to your Care Record/, "unsafe Daily Care suggestions must direct caregivers to the original note");
assert.match(careCapture, /caregiverSafeGeneratedText\(candidate\.subject\)/, "CareCapture generated subjects must use caregiver language");
assert.match(careCapture, /caregiverSafeGeneratedText\(candidate\.observation\)/, "CareCapture generated observations must use caregiver language");
assert.match(captureAnalysisReview, /caregiverSafeGeneratedText\(candidate\.subject\)/, "saved Daily Care review subjects must use caregiver language");
assert.match(captureAnalysisReview, /caregiverSafeGeneratedText\(candidate\.observation\)/, "saved Daily Care review observations must use caregiver language");
assert.match(captureAnalysisReview, /decision === "accept" && values\.needsRewrite/, "saved Daily Care reviews must block unsafe suggestions");
assert.match(captureAnalysisReview, /disabled=\{busyIndex !== null \|\| values\.needsRewrite\}/, "saved Daily Care review acceptance must be disabled for unsafe suggestions");
assert.match(evidenceReview, /caregiverSafeGeneratedText\(item\.rationale\)/, "evidence review explanations must use caregiver language");
assert.match(evidenceReview, /caregiverSafeGeneratedText\(group\.interpretation\)/, "similar-record explanations must use caregiver language");
assert.match(evidenceReview, /caregiverSafeGeneratedText\(review\.rationale\)/, "saved evidence-review summaries must use caregiver language");
assert.match(evidenceReview, /caregiverSafeGeneratedText\(criterion\.rationale\)/, "evidence-review criteria must use caregiver language");
assert.match(cognitiveWorkspace, /caregiverSafeGeneratedText\(data\.reply\.trim\(\)\)/, "read-only Care Record orientation replies must pass the generated-language boundary before display");
assert.doesNotMatch(cognitiveWorkspace, /setLcrOrientationReply\(data\.reply\.trim\(\)\)/, "raw generated orientation replies must never reach the caregiver UI");
assert.match(clarificationReview, /caregiverSafeGeneratedText\(selectedQuestion\.question\)/, "generated clarification questions must use caregiver language");
assert.match(clarificationReview, /caregiverOpenQuestions[\s\S]*?caregiverSafeGeneratedText\(item\.question\)/, "open clarification question lists must filter generated wording");
assert.match(clarificationReview, /questions\.filter\(\(item\) => item\.status !== "open" && item\.status !== "unresolved"\)[\s\S]*?caregiverSafeGeneratedText\(item\.question\)/, "restored clarification questions must use the same generated-language boundary");
assert.match(clarificationReview, /caregiverSafeGeneratedText\(guidance\.why\)/, "generated clarification explanations must use caregiver language");
assert.match(careDelta, /caregiverSafeGeneratedText\(claim\.text\)/, "generated care-change summaries must use caregiver language");
assert.match(careDelta, /caregiverSafeGeneratedText\(String\(row\.next_question/, "generated care-change questions must use caregiver language");
assert.match(careDelta, /caregiverSafeGeneratedText\(String\(row\.promotion_warning\)/, "generated promotion warnings must use caregiver language");
assert.match(careDelta, /caregiverSafeGeneratedText\(String\(item\.interpretation_uncertainty_justification\)/, "generated change uncertainty explanations must use caregiver language");
assert.match(changeIntelligence, /caregiverSafeGeneratedText\(item\)/, "generated repeated-change explanations must use caregiver language");
assert.match(changeIntelligence, /caregiverSafeChangeText\(change\.explanation\)/, "generated change explanations must use the change-language boundary");
assert.match(careContinuityIntegrityPanel, /caregiverSafeGeneratedText\(fresh\.explanation\)/, "generated freshness explanations must use caregiver language");
assert.match(persistedOrientation, /caregiverSafeGeneratedText\(projection\.notice\)/, "generated saved-record notices must use caregiver language");
assert.match(earlyAccessConsent, /caregiverSafeErrorMessage/);
assert.doesNotMatch(earlyAccessConsent, /cause\.message/);
assert.match(community, /caregiverSafeAssistantText\(result\.summary\)/);
assert.match(community, /caregiverSafeAssistantText\(result\.notice\)/);
assert.match(historyDrawer, /Related notes or documents/);
assert.doesNotMatch(changeIntelligence, /CARE CHANGES OVER TIME|Observation time unknown|saved item\(s\)/);
assert.doesNotMatch(persistedOrientation, /value\.replaceAll\("_", " "\)/);
assert.doesNotMatch(persistedOrientation, /Possible interpretation|Still unclear|Confirmed/);
assert.match(historyDrawer, /Your saved care history, in date order/);
assert.match(historyDrawer, /What was saved and where it came from/);
assert.doesNotMatch(careRecordOverview, /Your Living Care Record|Living Care Record|AI Companion/);
assert.doesNotMatch(handoff, /Living Care Record|Qwen quotations|Evidence IDs:|Origin groups:/);
assert.match(workspaceNav, /label: "Share care information"/);
assert.doesNotMatch(workspaceNav, /label: "Care Handoffs"/);
assert.doesNotMatch(handoff, /Care Handoffs|Prepare a care handoff|handoff history|Incoming and outgoing handoffs|Recipient\(s\):|Information included:/);
assert.match(careRecordOverview, /caregiverSafeAssistantText/);
assert.doesNotMatch(careRecordOverview, /Confirmed by a source|item\.kind \|\|/);
assert.doesNotMatch(followUps, /evidenceIds\.join|uniqueEvidenceIds\(item\)\.join/);
assert.match(followUps, /related \$\{uniqueEvidenceIds\(item\)\.length === 1/);
assert.match(timeline, /<h1 className="timeline-page-title">Care history<\/h1>/);
assert.doesNotMatch(timeline, /Care Timeline|Follow-ups & open items/);
assert.match(handoff, /Check what will be shared/);
assert.doesNotMatch(handoff, /Saved information item:|Caregiver-added note \(not independently verified\)|Sharing reviewed handoff/);
assert.match(sourceReview, /How often should this information be checked/);
assert.match(sourceReview, /caregiverSafeGeneratedText\(item\.rationale\)/, "generated freshness-review explanations must use caregiver language");
assert.doesNotMatch(sourceReview, /Choose a review rule set by the caregiver/);
assert.match(sourceReview, /How sure are you about this information\?/);
assert.doesNotMatch(sourceReview, /Information quality|How reliable this information is/);
assert.match(careContinuity, /Recently checked/);
assert.match(careContinuity, /Needs a fresh check/);
assert.doesNotMatch(careContinuity, /Verified through review|Interpretation, not verified|Conflicting information/);
assert.doesNotMatch(careOverviewPage, /currently understood about care/);

console.log("Caregiver language boundary checks passed.");

assert.match(careDelta, /caregiverStatusLabel/);
assert.match(careDelta, /caregiverSafeAssistantText/);
assert.doesNotMatch(careDelta, /Provider:|Model:|source-attributed assertions|replace\(\/_\/g/);
assert.match(humanValidation, /caregiverSafeErrorMessage/);
assert.doesNotMatch(humanValidation, /data\.detail \?\? data\.error/);


const appShellLanguage = read("../src/components/app-shell/AppShell.tsx");
const morePageLanguage = read("../src/app/workspace/more/page.tsx");
const navigationLanguage = read("../src/lib/workspace-navigation.ts");
const restrictedRoleLanguage = read("../src/components/RestrictedRolePage.tsx");
const situationRouteLanguage = read("../src/app/api/situation/route.ts");

assert.doesNotMatch(morePageLanguage, /\b(?:database|OCR|provenance|reconciliation|assertion|schema|JSON|freshness|extraction|lineage|algorithm|metadata|pipeline|backend|frontend|checksum|fingerprint|PostgreSQL|SQL)\b/i,
  "the More page must not expose engineering or processing language to caregivers");
assert.doesNotMatch(navigationLanguage, /label: "Advanced care record"|description: "Review detailed care-record information"/,
  "secondary navigation must use plain caregiver language");
assert.match(morePageLanguage, /<h1>More<\/h1>/,
  "secondary destinations are grouped under the plain-language More heading");
assert.doesNotMatch(appShellLanguage, /server-issued session|stored on SolenOS servers/i,
  "workspace confirmation and error messages must not expose internal session or hosting details");
assert.match(appShellLanguage, /care information already saved in SolenOS/,
  "workspace deletion confirmation must explain in plain language what remains saved");
assert.match(settings, /Ask us to delete care information/);
assert.match(settings, /We first check that you are allowed to make the request/);
assert.match(settings, /privacyRequestStatusLabel/);
assert.doesNotMatch(settings, /server-held care information|legal holds|provider copies|backup-retention periods|server sign-out|previous session may remain valid|Submit care-record erasure request|erasureRequest\.status\.replace|item\.status\.replace/,
  "privacy settings must explain deletion and sign-out outcomes without backend or legal-process jargon");
assert.match(identityRecovery, /Devices and account access/);
assert.match(identityRecovery, /A registered device alone cannot recover your account/);
assert.match(caregiverAccessPanel, /Care tasks to review/);
assert.match(caregiverAccessPanel, /What this caregiver can do/);
assert.doesNotMatch(caregiverAccessPanel, /Caregiver activity history|Your responsibility history|Care responsibilities to review|Responsibility:|Review outcome|Possible duplicate:|Acknowledgment:|Access permissions|sign-in access|Status not available|No linked follow-up|Choose a responsibility|Care responsibility details|Tasks without someone responsible|Actions that may be repeated/,
  "caregiver access settings must describe care tasks and sharing in everyday language");
assert.match(caregiverAccessPanel, /Suggest a correction to care information/);
assert.match(caregiverAccessPanel, /Hand care tasks to another caregiver/);
assert.match(caregiverAccessPanel, /caregiverStatusLabel\(item\.status\) \|\| "Not recorded"/, "unknown responsibility states must have a readable fallback");
assert.match(caregiverAccessPanel, /caregiverSafeAssistantText\(caregiver\.relationship\) \|\| "Relationship not recorded"/, "unknown caregiver relationships must not render as blank labels");

assert.match(appShellLanguage, /We couldn't confirm your access to SolenOS, so nothing was cleared/,
  "failed access revocation must clearly say that no local data was cleared");
assert.doesNotMatch(restrictedRoleLanguage, /server-issued identity|permissions for this role|anonymous care session|unverified or demo dashboard/i,
  "restricted-role page must not expose internal identity or authorization terminology");
assert.match(restrictedRoleLanguage, /Your care information is protected/,
  "restricted-role page must explain the restriction in caregiver language");
assert.doesNotMatch(situationRouteLanguage, /anonymous session/i,
  "caregiver-facing access errors must not expose session implementation details");
assert.match(situationRouteLanguage, /Your access to SolenOS could not be confirmed/,
  "missing access must have a plain-language explanation");


const shareHelpLanguage = read("../src/app/share/page.tsx");
const earlyAccessLanguage = read("../src/app/early-access/page.tsx");
const publicShellLanguage = read("../src/components/public/PublicShell.tsx");
const landingPageLanguage = read("../src/app/page.tsx");

assert.doesNotMatch(shareHelpLanguage, /Living Care Record|care understanding path|provide evidence/i,
  "share instructions and metadata must use everyday caregiver language");
assert.match(shareHelpLanguage, /Open your Care Record/,
  "share help must link to the Care Record using its caregiver-facing name");
assert.doesNotMatch(earlyAccessLanguage, /Living Care Record|care-continuity capabilities|early-version acknowledgement/i,
  "early-access copy and metadata must not expose internal product terminology");
assert.match(earlyAccessLanguage, /Open your Care Record/,
  "early-access entry must use the caregiver-facing Care Record name");
assert.doesNotMatch(publicShellLanguage, /Living Care Record/,
  "public navigation and footer must use the same Care Record name as the workspace");
assert.doesNotMatch(landingPageLanguage, /Living Care Record|AI Companion/, "the public landing page must use Care Record and Care Assistant");
assert.match(landingPageLanguage, /A CARE RECORD FOR FAMILY CAREGIVERS/);
assert.match(landingPageLanguage, /Start your Care Record/);


const documentExtractionRouteLanguage = read("../src/app/api/extract/route.ts");
const shareSummaryLanguage = read("../src/components/mvp-workspace/share/ShareCareSummaryPanel.tsx");
const handoffSharingLanguage = read("../src/components/workflows/CareHandoffSharing.tsx");
const shareSummaryData = read("../src/lib/share-summary.ts");
assert.match(documentExtractionRouteLanguage, /We couldn’t confirm your access to SolenOS\. Refresh the page and try again\./,
  "document extraction access failures must use plain caregiver-facing language");
assert.match(documentExtractionRouteLanguage, /We couldn’t confirm your access to SolenOS\. Reopen your Care Record and try again\./,
  "expired document access must explain the next step in plain English");
assert.doesNotMatch(documentExtractionRouteLanguage, /A valid SolenOS care-record session is required|This care-record session is no longer valid/i,
  "document extraction must not expose session implementation terminology to caregivers");

assert.match(reminders, /Back to Care Record/,
  "reminders must use the caregiver-facing Care Record name");
assert.match(reminders, /Save a reminder here so you can come back to it when it is due/,
  "reminders introduction must explain the purpose in everyday language");
assert.doesNotMatch(reminders, /CARE CONTINUITY|Living Care Record|in-app notification feed|notification is recorded/i,
  "reminders must not expose internal continuity or delivery terminology");
assert.match(reminders, /Reminders you add will appear here/,
  "reminders empty state must explain what the caregiver will see");
assert.doesNotMatch(openLoopsPage, /\b(?:database|API|OCR|provenance|reconciliation|assertion|schema|JSON|freshness|extraction|lineage|algorithm|metadata|pipeline|backend|frontend|checksum|fingerprint|PostgreSQL|SQL|idempotency|retrieval)\b/i,
  "Follow-ups must not expose internal record-processing terms");
assert.match(openLoopsPage, /Follow-ups/);


assert.doesNotMatch(shareSummaryLanguage, /server-issued care session|anonymous session|API error/i,
  "share-summary errors must not expose internal access or API terminology");
assert.match(handoffSharingLanguage, /caregiverSafeAssistantText/,
  "handoff content must use caregiver-safe wording for saved source text");
assert.match(handoffSharingLanguage, /Your summary could not be shared\. Refresh the list to check before trying again\./,
  "share failures must use clear caregiver-facing wording");
assert.match(shareSummaryData, /function getShareEvents/,
  "share summaries must read the current persisted event response");
assert.match(shareSummaryData, /current\.events/,
  "share summaries must support the current Care Record event field");
assert.match(shareSummaryData, /events_created/,
  "share summaries must remain compatible with the earlier response shape");
assert.match(shareSummaryData, /function getShareEventText/,
  "share summaries must preserve caregiver-entered wording when reading saved events");

for (const [term, expected] of [
  ["Living Care Record", "Care Record"], ["LCR", "Care Record"],
  ["Care continuity", "Keeping care information together"],
  ["reconciliation", "Updating your care information"],
  ["provenance", "Where this information came from"],
  ["evidence", "Related notes and documents"],
  ["Delta Engine", "Changes since your last visit"], ["delta_engine", "Changes since your last visit"],
  ["retrieval", "Finding earlier care information"],
  ["open loops", "Things that still need attention"],
  ["longitudinal history", "Care history over time"],
  ["AI Companion", "Care Assistant"],
  ["epistemic status", "What is known, what is unclear, or not recorded"],
  ["assessment_coverage", "What information was checked"],
  ["source attribution", "Who shared this information"],
] as const) {
  assert.equal(caregiverProductTermLabel(term), expected, "caregiver wording for " + term);
}
assert.equal(caregiverInformationAreaLabel("delta_engine"), "Changes since your last visit");
assert.equal(caregiverProductTermLabel("unapproved_internal_term"), null);

assert.match(conflictReview, /When information differs/);
assert.match(conflictReview, /If you have only checked part of the information/);
assert.match(conflictReview, /Earlier reviews/);
assert.doesNotMatch(conflictReview, /partial review|supporting information and a reason; a partial review/i,
  "caregivers must not be asked to understand internal review categories");
assert.match(clarificationReview, /Questions to check/);
assert.match(clarificationReview, /Who shared this:/);
assert.doesNotMatch(clarificationReview, /Source: \{item\.answer_provenance/,
  "follow-up history must not label who shared an answer as a source");
assert.match(appointmentWorkspace, /We couldn’t find appointment information in the notes and documents available here/);
assert.match(appointmentWorkspace, /What caregivers have shared/);
assert.match(appointmentWorkspace, /Documents for this appointment/);
assert.match(sourceReview, /Do we know who shared it\?/);
assert.match(claimReview, /What did you find\?/);
assert.match(claimReview, /How this care detail is connected to others/);
assert.match(claimReview, /This detail depends on/);
assert.doesNotMatch(claimReview, /Review result|Depends on|Required by/,
  "care detail reviews must avoid internal relationship and review labels");
assert.doesNotMatch(appointmentWorkspace, /SolenOS could not retrieve the full care record|Source evidence linked|No linked evidence returned|Review progress:|Care-recorded visit|Text extracted/,
  "appointment summaries must not expose technical retrieval, evidence or review wording");
assert.doesNotMatch(appointmentWorkspace, /Status not available|Priority not available|Review status:|caregiver-recorded event|external booking confirmation|clinical fact/i,
  "appointment summaries must use plain language for missing details and review limits");


assert.doesNotMatch(livingCareRecordPanel, /Living Care Record|System interpretation|Conflicting reports|Questions to resolve|Next actions/,
  "the main Care Record summary must not expose internal product or reasoning labels");
assert.match(livingCareRecordPanel, /What we know so far/);
assert.match(livingCareRecordPanel, /Notes and documents behind this summary/);
assert.match(livingCareRecordPanel, /What you can do next/);

assert.match(livingCareRecordPanel, /caregiverSafeGeneratedText\(view\.what_changed_in_understanding\)/, "generated Care Record change summaries must use caregiver language");
assert.match(livingCareRecordPanel, /caregiverSafeGeneratedText\(view\.what_matters_now\)/, "generated Care Record priorities must use caregiver language");
assert.match(livingCareRecordPanel, /caregiverSafeGeneratedText\(view\.follow_up_items|followUpItems/, "generated next steps must use caregiver language");
assert.match(livingCareRecordPanel, /caregiverFieldLabel\(event\.event\).*Care update/s, "raw event codes must never be shown in the Care Record");

assert.match(lcr, /return HISTORY_SOURCE_LABELS\[source\] \?\? "Care information"/,
  "unknown history source codes must never be shown as raw labels");
assert.match(lcr, /caregiverSafeGeneratedText\(change\.explanation\)/,
  "generated change explanations must use caregiver language");
assert.match(lcr, /caregiverLabel\(change\.previous_state\).*caregiverLabel\(change\.current_state\)/,
  "change history must translate internal state codes before display");
assert.match(lcr, /What shows this was done/);
assert.doesNotMatch(lcr, /Care priorities could not be reviewed|Not enough information to review priorities|No priority has been assumed|Based on .*saved item\(s\)/,
  "the Care Record must not expose internal priority or evidence-count wording");

assert.doesNotMatch(livingCareRecordPanel, /Observation layer|Caregiver observations|Caregiver load note/,
  "accessible Care Record labels must not expose internal layer names");


const continuityHome = read("../src/components/mvp-workspace/ContinuityHomePanel.tsx");
const communityUnavailable = read("../src/app/workspace/community/CommunityClient.tsx");
const caregiverInvite = read("../src/app/invite/caregiver/page.tsx");
assert.doesNotMatch(continuityHome, /Living Care Record|No notes in this session yet/,
  "the Care Record home must use familiar names and avoid session terminology");
assert.match(continuityHome, /No care notes have been added yet/);
assert.doesNotMatch(communityUnavailable, /Living Care Record/,
  "the disabled community screen must still use the caregiver-facing Care Record name");
assert.doesNotMatch(caregiverInvite, /missing its secure code|access was authorised/i,
  "caregiver invitations must not expose internal link-security or authorization language");
assert.match(caregiverInvite, /This invitation link is incomplete/);

assert.doesNotMatch(caregiverHandoverInbox, /Care handover|primary caregiver|responsibility_type\.replaceAll/,
  "caregiver responsibility requests must not expose internal handover or raw responsibility labels");
assert.match(caregiverHandoverInbox, /Care responsibilities waiting for you/);
assert.match(caregiverHandoverInbox, /take over a care responsibility/);

const correctionLabels = read("../src/components/trust/CorrectThis.tsx");
const privacyIndicator = read("../src/components/trust/PrivacyIndicator.tsx");
assert.doesNotMatch(correctionLabels, /Extracted information|AI interpretation|Source association/,
  "correction choices must use words caregivers understand");
assert.match(correctionLabels, /Details read from a document/);
assert.match(correctionLabels, /Suggested by SolenOS/);
assert.match(privacyIndicator, /We couldn't check who can see this/);
assert.doesNotMatch(privacyIndicator, /Access information unavailable/);

assert.doesNotMatch(lcr, /Checking linked evidence|View supporting information|What is known:/,
  "Care Record history must describe related notes and documents in everyday language");
assert.match(lcr, /Checking related notes and documents/);
assert.match(lcr, /caregiverSafeGeneratedText\(item\.interpretation_limit\)/, "generated Care Record limits must use caregiver language");
assert.match(lcr, /caregiverSafeGeneratedText\(decision\.reason \|\| decision\.priority_basis\?\.join\("; "\)\)/, "generated attention reasons must use the stricter caregiver-language boundary");
assert.match(lcr, /item\.priority_reasons[\s\S]*?map\(caregiverSafeGeneratedText\)/, "generated priority explanations must be filtered before display");
assert.match(lcr, /caregiverSafeGeneratedText\(review\.rationale\)/, "generated source-review explanations must use caregiver language");
assert.match(lcr, /caregiverSafeGeneratedText\(group\.interpretation\)/, "generated source-relationship explanations must use caregiver language");
assert.match(lcr, /caregiverSafeGeneratedText\(projection\.notice\)/, "generated Care Record notices must use caregiver language");
assert.match(careRecordOverview, /caregiverSafeGeneratedText\(item\.source_label\)/, "Care Record source labels must use caregiver language");
assert.match(careRecordOverview, /caregiverSafeChangeText\(change\.previous_state\)/, "Care Record change summaries must use the change-language boundary");
assert.match(careRecordOverview, /caregiverSafeChangeText\(change\.current_state\)/, "Care Record current-state summaries must use the change-language boundary");
assert.match(lcr, /caregiverSafeAssistantText\(transition\.reason\)/, "caregiver-written review reasons must remain readable without being treated as generated copy");
assert.match(lcr, /caregiverSafeGeneratedText\(alternative\)/, "generated care-pattern explanations must use caregiver language");
assert.match(lcr, /const safeInterpretation = caregiverSafeGeneratedText\(item\)/, "repeated care-pattern explanations must use the generated-text boundary");
assert.match(lcr, /See related notes and documents/);
assert.match(lcr, /This view includes the care information saved here so far/);

assert.doesNotMatch(lcr, /care record session|Open Loop record|action could not be registered|suggestion could not be deferred/i,
  "Care Record errors and follow-up actions must not expose internal workflow names");
assert.match(lcr, /We couldn't confirm your access to the Care Record/);
assert.match(lcr, /We couldn't save this as an agreed next step/);

assert.doesNotMatch(openLoopsPage, /Appointment connection|Linked to an appointment in this care record|Not established|Record action taken|What we know:.*epistemic/i,
  "Follow-ups must describe appointments and actions in familiar terms");
assert.match(openLoopsPage, /Related appointment/);
assert.match(openLoopsPage, /Save what you did/);
assert.match(openLoopsPage, /There may still be something that needs attention, even if it is not shown here/);

assert.doesNotMatch(changeIntelligence, /Loading saved notes and documents|Review notes and documents|Care updates considered|Time period:|Information:.*Review:/,
  "care change history must avoid internal labels and stiff technical phrasing");
assert.match(changeIntelligence, /See the notes and documents/);
assert.match(changeIntelligence, /When this happened:/);
assert.match(changeIntelligence, /What we know:/);
assert.doesNotMatch(claimReview, /Loading saved review versions|Retry load|source completeness|semantic sufficiency|assessment rationale/i,
  "care detail reviews must not expose internal assessment terminology");
assert.match(claimReview, /Check whether anything new changes this review/);
assert.match(claimReview, /Check result:/);
assert.doesNotMatch(conflictReview, /Review status|Supporting information|review decisions have been recorded/i,
  "reports that differ must use plain caregiver wording");
assert.match(conflictReview, /What did you find\?/);
assert.match(conflictReview, /Notes or documents you checked/);
assert.doesNotMatch(openLoopsPage, /SolenOS could not check what needs attention|Record action|CARE FOLLOW-UPS/i,
  "Follow-ups must not expose internal workflow wording");
assert.match(openLoopsPage, /We couldn’t check what needs attention just now/);
assert.match(openLoopsPage, /Tell us what has changed/);

const progressiveTurnCopy = read("../src/lib/progressive-understanding/turn-copy.ts");
const burdenMessages = read("../src/lib/caregiver-load-engine/burden-messages.ts");
const continuityHomeCopy = read("../src/lib/mvp-surface-area/continuity-home.ts");
const activationCopy = read("../src/lib/activation-system/contract-constants.ts");
const searchRedirectCopy = read("../src/lib/product-north-star/search-demand-redirect.ts");
const careMemoryCopy = read("../src/lib/care-memory-maturity/index.ts");
const careDiffCopy = read("../src/lib/care-context-diff-engine/compute-diff.ts");
const responseComposerCopy = read("../src/lib/caregiver-response-composer/index.ts");
assert.match(progressiveTurnCopy, /Saved in your Care Record/);
assert.doesNotMatch(progressiveTurnCopy, /Living Care Record/);
assert.match(burdenMessages, /What you shared is saved in your Care Record/);
assert.doesNotMatch(burdenMessages, /Living Care Record/);
assert.match(continuityHomeCopy, /Added to your Care Record/);
assert.doesNotMatch(continuityHomeCopy, /Living Care Record/);
assert.match(activationCopy, /ACTIVATION_ACKNOWLEDGEMENT =\s*"Saved in your Care Record"/);
assert.match(activationCopy, /Anything new to add to your Care Record\?/);
assert.doesNotMatch(searchRedirectCopy, /Living Care Record|general Q&A engine|memory system/);
assert.match(careMemoryCopy, /"Added to your Care Record"/);
assert.match(careMemoryCopy, /"As you add more, your earlier care details stay together in your Care Record\."/);
assert.match(careDiffCopy, /caregiverFieldLabel\(change\.domain\)/);
assert.match(careDiffCopy, /caregiverStatusLabel\(change\.classification\)/);
assert.doesNotMatch(careDiffCopy, /moderate confidence|confidence decreased|factual changes since last comprehension point|care context initialization/i);
assert.match(responseComposerCopy, /caregiverFieldLabel\(top\.domain\)/);
assert.match(responseComposerCopy, /caregiverStatusLabel\(top\.classification\)/);
assert.doesNotMatch(responseComposerCopy, /moderate confidence|low confidence/);

const careContinuityIntegrity = read("../src/components/CareContinuityIntegrityPanel.tsx");
assert.match(careContinuityIntegrity, /caregiverFieldLabel\(item\.field\) \|\| caregiverInformationLabel\(item\.field\) \|\| 'Care detail'/);
assert.doesNotMatch(careContinuityIntegrity, /caregiverSafeAssistantText\(item\.field\)/,
  "expanded Care Record details must not display raw field codes");

const conflictResolution = read("../src/components/ConflictResolutionPanel.tsx");
const claimAssessment = read("../src/components/ClaimAssessmentPanel.tsx");
assert.match(conflictResolution, /caregiverSafeGeneratedText\(item\.description\)/, "generated conflict descriptions must use the caregiver language boundary");
assert.match(conflictResolution, /caregiverSafeGeneratedText\(selected\.description\)/, "selected conflict descriptions must use the caregiver language boundary");
assert.match(claimAssessment, /caregiverSafeGeneratedText\(selectedClaim\.source_label\)/, "generated claim source labels must use the caregiver language boundary");
assert.match(claimAssessment, /caregiverSafeGeneratedText\(edge\.rationale\)/, "generated review dependency explanations must use the caregiver language boundary");
assert.match(claimAssessment, /caregiverSafeGeneratedText\(assessmentImpact\.interpretation_limit\)/, "generated review limits must use the caregiver language boundary");
assert.match(claimAssessment, /caregiverSafeAssistantText\(selectedClaim\.asserted_value\)/, "reported claim wording must use readable caregiver text");
assert.match(claimAssessment, /caregiverSafeAssistantText\(link\.source_passage\) \|\| ""/, "filtered source quotations must not be replaced by invented text in editable fields");
assert.match(claimAssessment, /link\.source_passage && !caregiverSafeAssistantText\(link\.source_passage\)/, "unreadable source quotations must prompt the caregiver to copy the original wording again");
assert.match(claimAssessment, /caregiverSafeAssistantText\(link\.source_passage\) \|\| "The original wording could not be displayed\."/,
  "historical source quotations must not expose raw structured metadata");

assert.match(whyAmISeeingThis, /caregiverSafeGeneratedText\(whyItMatters\)/, "generated reasons shown to caregivers must use the caregiver language boundary");
assert.match(whyAmISeeingThis, /caregiverSafeGeneratedText\(remainsUnclear\)/, "generated uncertainty explanations must use the caregiver language boundary");
assert.match(whyAmISeeingThis, /caregiverSafeGeneratedText\(couldClarify\)/, "generated next-step suggestions must use the caregiver language boundary");
assert.match(whyAmISeeingThis, /safeWhyItMatters \|\| 'A plain-language explanation is not available right now\.'/,
  "filtered explanations must show an honest fallback instead of disappearing silently");
assert.match(whyAmISeeingThis, /recordSays &&[\s\S]*?The original care information is not available in a readable form right now/,
  "unreadable source text must have a visible explanation rather than disappearing");
assert.match(whyAmISeeingThis, /aiInterpreted &&[\s\S]*?A plain-language explanation is not available right now/,
  "filtered generated interpretations must have a visible explanation rather than disappearing");

assert.match(whyAmISeeingThis, /caregiverSafeGeneratedText\(source\.description\)/, "generated source descriptions must use the caregiver language boundary");
assert.match(historyDrawer, /caregiverStatusLabel\(selectedRecord\.significance_verdict\) \|\| "No further explanation is available\."/,
  "unknown care-history status values must not fall back to displaying raw internal codes");
assert.match(historyDrawer, /caregiverStatusLabel\(status\) \|\| "Not available"/,
  "unknown follow-up statuses must not be shown as raw codes in care history");
assert.match(historyDrawer, /caregiverStatusLabel\(asText\(item\.priority\)\) \|\| "Not available"/,
  "unknown follow-up priority values must not be shown as raw codes");
assert.match(historyDrawer, /caregiverStatusLabel\(item\.status\) \|\| "Not available"/,
  "unknown handoff statuses must not be shown as raw codes");
assert.match(historyDrawer, /caregiverFieldLabel\(asText\(item\.target_type\)\)[\s\S]*?caregiverInformationAreaLabel\(asText\(item\.target_type\)\)[\s\S]*?care information/,
  "Care Record revision target types must use caregiver-facing labels");
assert.match(historyDrawer, /changedFieldLabels[\s\S]*?caregiverFieldLabel\(field\) \|\| caregiverInformationAreaLabel\(field\)/,
  "Care Record revision field names must not be displayed as raw database keys");


assert.match(lcr, /caregiverSafeGeneratedText\(item\.title\) \|\| "Care detail"/,
  "baseline titles from generated assessments must use caregiver-safe copy");
assert.match(lcr, /caregiverSafeGeneratedText\(item\.title\) \|\| "Care detail to review"/,
  "generated priority titles must use caregiver-safe copy");
assert.match(lcr, /caregiverSafeAssistantText\(item\.title\) \|\| "Care follow-up"/,
  "caregiver-created follow-up titles must preserve safe original wording");
assert.match(lcr, /caregiverSafeAssistantText\(item\.owner\) \|\| "Not recorded"/,
  "caregiver responsibility names must not expose raw structured metadata");
assert.match(changeIntelligence, /caregiverSafeGeneratedText\(record\.source_label\) \|\| "Saved note or document"/,
  "change-history source labels must use caregiver-safe generated copy");
assert.match(changeIntelligence, /caregiverSafeAssistantText\(record\.excerpt\) \|\| "The original wording could not be displayed\."/,
  "saved source excerpts must not expose raw structured metadata");
assert.match(lcr, /caregiverSafeGeneratedText\(item\.title\) \|\| "Care detail to check"/,
  "generated missing-information titles must use caregiver-safe copy");
assert.match(lcr, /caregiverSafeAssistantText\(assertion\.asserted_value\) \|\| "Saved care detail"/,
  "saved report values must not render raw structured metadata");
assert.match(lcrQwenInterpretation, /caregiverSafeAssistantText\(observation\.value\)/,
  "saved observation wording must be readable while technical diagnostics remain hidden");



const careRecipientNameGate = read("../src/components/mvp-workspace/CareRecipientNameGate.tsx");
const correctionForm = read("../src/components/trust/CorrectThis.tsx");
const feedbackForm = read("../src/components/mvp-workspace/HelpImproveSolenos.tsx");
const consentGate = read("../src/components/mvp-workspace/ConsentGatePanel.tsx");
const accessibleForm = read("../src/components/accessible/AccessibleForm.tsx");
const cameraPermission = read("../src/lib/permissions/useCameraPermission.ts");
const locationPermission = read("../src/lib/permissions/useLocationPermission.ts");

const globalErrorPage = read("../src/app/global-error.tsx");
const firstInput = read("../src/lib/mvp-input-architecture/first-input.ts");
const settingsPage = read("../src/app/workspace/settings/page.tsx");
assert.match(followUpsPage, /const reasonCandidates = \[\.\.\.\(item\.priority_basis \|\| \[\]\), \.\.\.\(item\.reason \? \[item\.reason\] : \[\]\)\]/,
  "Follow-ups must retain the count of explanations before filtering");
assert.match(followUpsPage, /reasonLines\.length < reasonCandidates\.length/,
  "partly filtered Follow-ups explanations must be disclosed");
assert.match(followUpsPage, /Some explanation could not be shown clearly\. Check the saved care information before relying on it\./,
  "fully filtered Follow-ups explanations must not be described as missing");
assert.match(followUpsPage, /caregiverSafeAssistantText\(loop\.owner_label\) \|\| "Not recorded"/,
  "filtered Follow-ups responsibility labels must not render blank");
assert.match(reminders, /caregiverSafeAssistantText\(reminder\.title\)/,
  "saved reminder titles must use readable caregiver text");
assert.match(reminders, /caregiverSafeAssistantText\(reminder\.note\)/,
  "saved reminder notes must not expose raw structured metadata");
assert.match(reminders, /caregiverSafeAssistantText\(reminder\.completion_note\)/,
  "reminder completion notes must use readable caregiver text");
assert.match(reminders, /caregiverSafeAssistantText\(member\.name\)/,
  "caregiver assignment names must not expose raw structured values");
assert.match(firstInput, /We couldn’t confirm whether that update was saved\. Check your Care Record before trying again\./,
  "first-input transport failures must not claim an uncertain update was not saved");
assert.match(caregiverAccessPanel, /We couldn't confirm whether this responsibility was saved\. Check the list before trying again\./,
  "responsibility save failures must not claim the write definitely failed");
assert.match(cognitiveWorkspace, /We couldn’t confirm whether your message was saved\. Check the conversation before trying again\./,
  "Companion response failures must not claim an uncertain message was not saved");
assert.match(globalErrorPage, /If you were saving an update, check your Care Record before trying again so you do not add the same information twice/,
  "global errors must not claim an unverified save succeeded or that data is safe");
assert.doesNotMatch(globalErrorPage, /Your care information is safe|Error ID:/,
  "global errors must avoid unsupported safety claims and technical labels");
assert.match(settingsPage, /caregiverSafeGeneratedText\(item\.title\)/, "notification titles must use caregiver-safe generated copy");
assert.match(settingsPage, /caregiverSafeGeneratedText\(item\.body\)/, "notification bodies must use caregiver-safe generated copy");
assert.match(settingsPage, /caregiverStatusLabel\(item\.priority\)/, "notification priority codes must be translated before display");
assert.match(settingsPage, /caregiverSafeGeneratedText\(erasureRequest\.message\)/, "privacy request messages from the server must use caregiver-safe generated copy");
assert.match(reminders, /error && reminders\.length === 0 \? null : visibleReminders\.length === 0/, "a failed reminder read must not be presented as an empty saved list");

assert.match(careRecipientNameGate, /setError\(caregiverSafeErrorMessage\(\)\)/,
  "care-recipient naming must not show raw server errors");
assert.match(correctionForm, /setSubmitError\(caregiverSafeErrorMessage\(\)\)/,
  "correction forms must not show raw server errors");
assert.match(feedbackForm, /caregiverSafeErrorMessage\(\)/,
  "feedback forms must not show raw server errors");
assert.match(consentGate, /setError\(caregiverSafeErrorMessage\(\)\)/,
  "privacy consent must not show raw server errors");
assert.match(accessibleForm, /announce\(caregiverSafeErrorMessage\(\)\)/,
  "accessible form error announcements must not read raw server details aloud");
assert.doesNotMatch(cameraPermission, /message = err\.message/,
  "camera permission errors must not expose raw browser diagnostics");
assert.doesNotMatch(locationPermission, /message = err\.message/,
  "location permission errors must not expose raw browser diagnostics");


assert.match(evidenceReview, /caregiverSafeAssistantText\(item\.title\) \|\| "Saved care detail"/,
  "historical Care Record snapshot titles must use readable caregiver text");
assert.match(evidenceReview, /caregiverSafeAssistantText\(item\.detail\) \|\| "The saved details could not be displayed in a readable form\."/,
  "historical Care Record snapshot details must not expose raw structured metadata");
assert.match(evidenceReview, /item\.reviewed_by_caregiver_id \? "Checked by a caregiver" : "Reviewer not recorded"/,
  "missing reviewer identity must be described as unrecorded, not as an unavailable person");

assert.match(livingCareRecordPanel, /factCandidates\.length > facts\.length[\s\S]*?saved information remains in your Care Record/,
  "filtered generated care facts must not disappear without explanation");
assert.match(livingCareRecordPanel, /const factCandidates = view\.what_understood\.slice\(0, 2\)/,
  "the fact filtering notice must account for the intentional two-fact display limit");
assert.match(livingCareRecordPanel, /const questionCandidates[\s\S]*?questionCandidates\.length > stillUnclear\.length/,
  "filtered questions must be disclosed even when other questions remain visible");
assert.match(livingCareRecordPanel, /rememberedCandidates\.length > remembered\.length/,
  "partly filtered memory summaries must be disclosed");
assert.match(livingCareRecordPanel, /followUpCandidates\.length > followUpItems\.length/,
  "partly filtered next-step suggestions must be disclosed");
assert.match(livingCareRecordPanel, /supportingEvidenceCandidates[\s\S]*?saved notes and documents are available, but their wording could not be shown clearly/,
  "source notes must remain visible as available when their text cannot be safely displayed");
assert.match(livingCareRecordPanel, /view\.contradictions\.length > contradictions\.length/,
  "partly filtered conflicting reports must not silently disappear");
assert.match(livingCareRecordPanel, /view\.contradictions\.length > 0[\s\S]*?Check the original notes before drawing a conclusion/,
  "filtered conflicting-report explanations must preserve a visible caution");
assert.match(livingCareRecordPanel, /view\.what_needs_context\.length > 0[\s\S]*?questions are saved, but their wording could not be shown clearly/,
  "filtered questions must remain visible as unavailable rather than silently disappearing");
assert.match(livingCareRecordPanel, /view\.what_will_be_remembered\.length > 0[\s\S]*?Nothing has been removed from your Care Record/,
  "filtered memory summaries must explain that saved information remains intact");
assert.match(livingCareRecordPanel, /view\.follow_up_items\.length > 0[\s\S]*?Suggested next steps could not be shown clearly/,
  "filtered next-step suggestions must have an honest caregiver-facing fallback");

const shareCareSummaryPanel = read("../src/components/mvp-workspace/share/ShareCareSummaryPanel.tsx");
assert.match(shareCareSummaryPanel, /caregiverReadableCaptureText\(item\.supporting_quote\)/,
  "exported source wording must be converted to readable caregiver text");
assert.match(shareCareSummaryPanel, /caregiverSafeGeneratedText\(item\.summary \|\| item\.text\)/,
  "generated briefing summaries must pass the generated-language boundary before export");
assert.match(shareCareSummaryPanel, /caregiverReadableCaptureText\(item\.summary \|\| item\.text\)/,
  "source-only briefing summaries must render structured caregiver notes without metadata");
assert.match(shareCareSummaryPanel, /caregiverSafeGeneratedText\(item\.section\) \|\| "this care detail"/,
  "export review checklist section names must use caregiver-safe labels");
assert.match(shareCareSummaryPanel, /caregiverSafeGeneratedText\(item\.section\)/,
  "generated briefing section headings must use caregiver-facing labels");
assert.match(careHandoffSharing, /caregiverReadableCaptureText\(item\.supporting_quote\)/,
  "handoff source quotations must not expose structured capture metadata");
assert.match(careHandoffSharing, /caregiverReadableCaptureText\(item\.summary \|\| item\.text\)/,
  "source-only handoff summaries must use readable saved care wording");
assert.match(careHandoffSharing, /draft\?\.audience !== "professional" \|\| draft\?\.purpose !== "professional_appointment"[\s\S]*?source\.source_table \+ ":" \+ source\.source_id[\s\S]*?sourceTables\.get\(item\.source_ref\) !== "caregiver_profiles"/,
  "professional appointment briefings must not treat caregiver profile records as care history");
assert.match(shareCareSummaryPanel, /caregiverVisibleBriefingSections\(draft\)/,
  "exported briefings must use the same care-relevant source filter as the review screen");


const continuityPrompt = read("../src/components/ContinuityPrompt.tsx");
const situationProxy = read("../src/app/api/situation/route.ts");
assert.match(continuityPrompt, /We couldn’t complete account setup\. Check your details and try again\./, "identity errors must use plain recovery guidance");
assert.doesNotMatch(continuityPrompt, /e instanceof Error \? e\.message/, "identity service errors must not be rendered raw");
assert.match(situationProxy, /The care service is not available right now\. No update was sent\. Try again later\./, "configuration failures must not expose internal service details and must state no update was sent");
assert.doesNotMatch(situationProxy, /error instanceof Error \? error\.message/, "proxy configuration exceptions must not be returned to caregivers");


assert.match(workspaceLayout, /caregiverSafeAssistantText\(active\.title\)/, "the shared care-context title must not expose internal generated wording");
assert.match(workspaceLayout, /caregiverStatusLabel\(active\.status\)/, "the shared care-context status must use caregiver-readable wording");
