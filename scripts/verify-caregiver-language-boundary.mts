import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  caregiverFieldLabel,
  caregiverProductTermLabel,
  caregiverInformationAreaLabel,
  caregiverInformationLabel,
  caregiverSafeAssistantText,
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
assert.equal(caregiverStatusLabel("verified"), "Checked against a source");
assert.equal(caregiverStatusLabel("uncertain"), "Not sure yet");
assert.equal(caregiverStatusLabel("unresolved"), "Still needs attention");
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
assert.equal(caregiverInformationAreaLabel("evidence_freshness_assessments"), "Information dates");
assert.equal(caregiverInformationAreaLabel("unknown_internal_area"), null);
assert.equal(caregiverInformationLabel("epistemic_unknown"), null);
assert.equal(caregiverFieldLabel("medication_name"), "Medication name as reported");
assert.equal(caregiverFieldLabel("dose"), "Dose as reported");
assert.equal(caregiverFieldLabel("medication_name"), "Medication name as reported");
assert.equal(caregiverFieldLabel("medication_status"), "Medication status as reported");
assert.equal(caregiverFieldLabel("unknown_internal_field"), null);
assert.equal(caregiverFieldLabel("reconciliation"), "Updating your care information");
assert.equal(caregiverFieldLabel("delta_engine"), "Changes since your last visit");
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
assert.equal(caregiverSafeAssistantText("LCR Delta Engine completed"), null);
assert.equal(caregiverSafeAssistantText("Qwen inference is unavailable"), null);
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
const dailyCare = read("../src/app/workspace/daily-care/page.tsx");
const companion = read("../src/components/workflows/AICompanion.tsx");
const documentReview = read("../src/components/DocumentIntelligenceReview.tsx");
const documentsPage = read("../src/app/workspace/documents/page.tsx");
const settings = read("../src/app/workspace/settings/page.tsx");
const reminders = read("../src/app/workspace/reminders/page.tsx");
const lcr = read("../src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
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
const companionRoute = read("../src/app/workspace/companion/page.tsx");
const historyDrawer = read("../src/components/app-shell/HistoryDrawer.tsx");
const careDelta = read("../src/components/CareDeltaPanel.tsx");
const careChangeHistory = read("../src/components/mvp-workspace/CareChangeHistoryPanel.tsx");
const humanValidation = read("../src/components/HumanValidationLoop.tsx");
const careCapture = read("../src/components/CareCapture.tsx");
const feedbackPrompt = read("../src/components/mvp-workspace/UnderstandingFeedbackPrompt.tsx");
const appShell = read("../src/components/app-shell/AppShell.tsx");
const photoCapture = read("../src/components/workflows/DailyCarePhotoCapture.tsx");
const quickCheckIn = read("../src/components/workflows/QuickDailyCheckIn.tsx");
const cognitiveWorkspace = read("../src/components/mvp-workspace/CognitiveWorkspace.tsx");
const earlyAccessConsent = read("../src/components/public/EarlyAccessConsentForm.tsx");

assert.doesNotMatch(dailyCare, /epistemic_status\.replace|item\.status\.replace/);
assert.doesNotMatch(dailyCare, /item\.event_type \|\| item\.source_type/);
assert.match(dailyCare, /item\.original_text\.trim\(\)/, "original caregiver reports must remain verbatim");
assert.match(dailyCare, /item\.corrected_text\.trim\(\)/, "corrected caregiver reports must remain verbatim");
assert.doesNotMatch(dailyCare, /caregiverSafeAssistantText\(item\.(original_text|corrected_text|reason)\)/, "assistant-output filtering must not be applied to caregiver source text");
assert.doesNotMatch(dailyCare, /The latest information currently available in the care record|Processing has not started yet|Document understanding could not be completed|Document processing was stopped|Care Timeline|change and pattern assessments/);
assert.match(dailyCare, /SolenOS has finished reading it/);
assert.match(dailyCare, /Open care history/);
assert.doesNotMatch(documentsPage, /AI interpretation|Document library|Server processing after upload|extracted statements|document understanding|upload ID|10 MiB/);
assert.match(documentsPage, /Your original files are kept separate from suggested details/);
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
assert.match(companion, /not independent confirmation/);
assert.match(companion, /Only the latest source reviews are shown here/);
assert.match(companion, /No source review has been recorded for this note or document/);
assert.match(companion, /review history shown here may be incomplete/);

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
assert.doesNotMatch(naturalDailyUpdate, /setError\(\s*cause\.message/);
assert.match(naturalDailyUpdate, /reason\.includes\("could not securely keep an offline copy"\)/, "only the explicit local-save error may be surfaced; raw backend errors remain sanitized");
assert.match(claimReview, /caregiverStatusLabel/);
assert.equal(claimReview.includes("review version ${assessmentImpact.assessment_version}"), false);
assert.match(handoff, /function readableStatus\(value: string\): string \{\s+return caregiverStatusLabel\(value\) \?\? "Not available";/);
assert.match(appointment, /caregiverSafeAssistantText\(item\.title\)/);
assert.match(detailedAppointment, /caregiverSafeAssistantText\(source\.original_author\)/);
assert.doesNotMatch(detailedAppointment, /Evidence IDs:|Assessment \{item\.assessment_id/);
assert.doesNotMatch(dailyCapture, /Care-record reconciliation:|change and pattern assessments|Accept and add to LCR|LCR fact|No LCR assertion|Living Care Record/);
assert.match(dailyCapture, /Original information:/);
assert.match(dailyCapture, /Add to Care Record/);
assert.doesNotMatch(documentReview, /Document intelligence review|OCR reading confidence|CORRECTION AWAITING APPROVAL|PENDING CAREGIVER REVIEW|SAVED AS UNCONFIRMED REPORT|statement\(s\)/);
assert.match(documentReview, /Text read from your document/);
assert.doesNotMatch(documentReview, /event\.decision\}/);
assert.doesNotMatch(settings, /Living Care Record|anonymous session|Clear local data/);
assert.doesNotMatch(policySettings, /Living Care Record|Companion conversations|eligible feedback|Direct identifiers|processing path|retention and handling rules/);
assert.match(policySettings, /Your full Care Record or your full care history/);
assert.doesNotMatch(identityRecovery, /device registration|registered devices|one-time recovery code|revokes every existing session/);
assert.match(identityRecovery, /Get back into your account/);
assert.doesNotMatch(caregiverAccess, /responsibility_type\.replaceAll|transfer responsibility|primary caregiver transfer declined|No change should be assumed/);
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
assert.match(careChangeHistory, /readableChangeType\(item\.change_type\)/);
assert.match(careChangeHistory, /displayChangeText\(item\.comparison_basis/);
assert.doesNotMatch(careChangeHistory, /display\(run\.source/);
assert.doesNotMatch(lcr, /<p>\{change\.explanation\}<\/p>/);
assert.match(lcr, /caregiverSafeAssistantText\(source\.source_passage\)/);

const workspaceNav = read("../src/lib/workspace-navigation.ts");
const workspaceHome = read("../src/app/workspace/page.tsx");
const followUps = read("../src/app/workspace/open-loops/page.tsx");
const timeline = read("../src/app/workspace/timeline/page.tsx");
const informationStatus = read("../src/components/trust/InformationStatus.tsx");
const statusCareDelta = read("../src/components/CareDeltaPanel.tsx");
const careOverviewPage = read("../src/app/workspace/care-continuity/page.tsx");
const sourceReview = read("../src/components/EvidenceReviewPanel.tsx");
const careContinuity = read("../src/components/CareContinuityIntegrityPanel.tsx");
assert.doesNotMatch(careContinuity, /Care continuity|Reported care information/);
assert.match(careContinuity, /Care details shared with SolenOS/);
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
assert.doesNotMatch(cognitiveWorkspace, /error\.message|e\.message/);
assert.match(earlyAccessConsent, /caregiverSafeErrorMessage/);
assert.doesNotMatch(earlyAccessConsent, /cause\.message/);
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
assert.doesNotMatch(sourceReview, /Choose a review rule set by the caregiver/);
assert.match(sourceReview, /How much to rely on this information/);
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
const restrictedRoleLanguage = read("../src/components/RestrictedRolePage.tsx");
const situationRouteLanguage = read("../src/app/api/situation/route.ts");

assert.doesNotMatch(appShellLanguage, /server-issued session|stored on SolenOS servers/i,
  "workspace confirmation and error messages must not expose internal session or hosting details");
assert.match(appShellLanguage, /care information already saved in SolenOS/,
  "workspace deletion confirmation must explain in plain language what remains saved");
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
  ["provenance", "What was recorded and where it came from"],
  ["evidence", "What was recorded and where it came from"],
  ["Delta Engine", "Changes since your last visit"], ["delta_engine", "Changes since your last visit"],
  ["retrieval", "Finding past care information"],
  ["open loops", "Things that still need attention"],
  ["longitudinal history", "Care history over time"],
  ["AI Companion", "AI Companion"],
  ["epistemic status", "What is known, not sure yet, or not recorded"],
  ["assessment_coverage", "What information was checked"],
  ["source attribution", "Who reported it and where it came from"],
] as const) {
  assert.equal(caregiverProductTermLabel(term), expected, "caregiver wording for " + term);
}
assert.equal(caregiverInformationAreaLabel("delta_engine"), "Changes since your last visit");
assert.equal(caregiverProductTermLabel("unapproved_internal_term"), null);
