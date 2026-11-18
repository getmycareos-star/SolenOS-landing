import assert from "node:assert/strict";
import fs from "node:fs";

const legacyRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const capture = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");
const careContinuity = fs.readFileSync("src/app/workspace/care-continuity/page.tsx", "utf8");
const currentUnderstanding = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const integrityPanel = fs.readFileSync("src/components/CareContinuityIntegrityPanel.tsx", "utf8");
const evidenceReview = fs.readFileSync("src/components/EvidenceReviewPanel.tsx", "utf8");
const changeIntelligence = fs.readFileSync("src/components/mvp-workspace/ChangeIntelligencePanel.tsx", "utf8");
const styles = fs.readFileSync("src/app/mobile-app.css", "utf8");
const workspaceLayout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const dailyCare = fs.readFileSync("src/app/workspace/daily-care/page.tsx", "utf8");
const workspaceHome = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const historyDrawer = fs.readFileSync("src/components/app-shell/HistoryDrawer.tsx", "utf8");

assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR home must redirect to the Companion");
assert.doesNotMatch(legacyRoute, /SOLENOS · LIVING CARE RECORD|Record timeline|Add to record|CognitiveWorkspace/, "old LCR interface must not be rendered as a separate home");
assert.doesNotMatch(capture, /ConsentGatePanel|consentState !== "accepted"|ResearchPreviewAckGate/, "care-record capture is not blocked by acknowledgement checkboxes");
assert.doesNotMatch(capture, /HelpImproveSolenos|QwenAssistPanel/, "capture workspace does not interleave feedback or a separate AI chat panel");
assert.match(capture, /Start with one thing you want to remember/);
assert.match(capture, /Add a new detail to the care record/, "first-time and returning caregivers retain the shared care-record capture workflow");
assert.match(dailyCare, /StructuredDailyCapture/, "Daily Care retains its structured capture workflow");
assert.doesNotMatch(dailyCare, /DailyCareQwen|daily-care\/intelligence\/ask/, "Daily Care has no embedded AI agent");
assert.doesNotMatch(workspaceLayout, /type="checkbox"|ResearchPreviewAckGate|ConsentGatePanel/, "workspace route mounts without a pre-entry checkbox");
assert.match(styles, /\.lcr-home/, "existing responsive LCR style system is preserved for continuity components");
assert.match(styles, /@media \(max-width: 540px\)/, "mobile layout remains explicitly handled");
const caregiverRenderedCode = currentUnderstanding.slice(currentUnderstanding.indexOf("export function LCRCurrentUnderstanding"));
assert.notEqual(currentUnderstanding.indexOf("export function LCRCurrentUnderstanding"), -1, "caregiver LCR component must exist");
assert.doesNotMatch(caregiverRenderedCode, /persisted records examined|\bConfidence:\s*|Open loops [(]|Situation trajectory [(]|Observation coverage [(]|Personal baseline|No coverage record means unknown|numeric confidence\b|assessment quality/i, "technical assessment diagnostics are not exposed in the caregiver view");
assert.doesNotMatch(careContinuity, /Add an update|Add the first detail|Add update to this thread|compose=1|CognitiveWorkspace|AddSituationPanel/, "Care Continuity must not expose a second capture interface");
assert.match(careContinuity, /Open Daily Care/, "the Care Record routes new information to the Daily Care capture screen");
assert.match(careContinuity, /Need to add something\?/, "the Care Record links to the owning capture workflow");
assert.match(careContinuity, /View care history/, "the Care Record links to the dedicated historical timeline");
assert.doesNotMatch(careContinuity, /lcr-timeline|situations\.map/, "the Care Record does not render a second historical event feed");
assert.doesNotMatch(careContinuity, /Additional care details are saved\./, "timeline entries never substitute generic filler for a missing care summary");
assert.doesNotMatch(careContinuity, /situation\.openQuestions\.map/, "care questions are not duplicated under every timeline thread");
assert.doesNotMatch(careContinuity, /Winner selected: no|Supporting information:/, "raw conflict evidence counts and audit flags are not shown in the default timeline");
assert.doesNotMatch(careContinuity, /PersistedCareOrientation|ChangeIntelligencePanel/, "duplicate overview and standalone observation-coverage editor are not mounted on Care Continuity");
assert.match(currentUnderstanding, /lcr-first-screen-summary/, "workspace opens with a concise three-part care orientation");
assert.match(currentUnderstanding, /Where things stand/, "first screen explains the recorded care picture");
assert.match(currentUnderstanding, /What needs attention/, "first screen surfaces supported care priorities");
assert.match(currentUnderstanding, /What has changed/, "first screen summarizes persisted changes");
assert.match(currentUnderstanding, /lcr-progressive-disclosure/, "detailed care information is progressively disclosed");
assert.doesNotMatch(currentUnderstanding, /Missing information does not mean everything is fine|Do not assume there is nothing that needs attention/, "obsolete defensive disclaimers are removed from caregiver-facing copy");
assert.match(currentUnderstanding, /There isn’t enough recorded care information to assess immediate priorities yet/, "an empty care record is described as insufficient information, not a reassuring finding");
assert.match(currentUnderstanding, /RecordState kind="error".*onAction=\{\(\) => void load\(true\)\}/s, "failed current-care retrieval renders an actionable error state with a real retry");
assert.ok(
  workspaceHome.indexOf("<LCRCurrentUnderstanding />") < workspaceHome.indexOf("What would you like to do?") &&
  workspaceHome.indexOf("What would you like to do?") < workspaceHome.indexOf("<CaregiverHandoverInbox />"),
  "workspace order is care orientation, primary actions, then handover inbox"
);
assert.ok(workspaceHome.includes('href="/workspace/companion"'), "Ask SolenOS remains directly accessible");
assert.ok(workspaceHome.includes('href="/workspace/daily-care"'), "Add a care update remains directly accessible");
assert.match(currentUnderstanding, /evidenceReviewOpen \? <EvidenceReviewPanel personId={personId} \/>/, "evidence review mounts only when its own disclosure is opened");
assert.match(currentUnderstanding, /claimAssessmentOpen \? <ClaimAssessmentPanel \/>/, "claim review mounts only when its own disclosure is opened");
assert.match(currentUnderstanding, /conflictReviewOpen \? <ConflictResolutionPanel personId={personId} \/>/, "conflict review mounts only when its own disclosure is opened");
assert.match(currentUnderstanding, /recordHistoryOpen \? <CareContinuityIntegrityPanel personId={personId} \/>/, "record history mounts only when its own disclosure is opened");
assert.doesNotMatch(currentUnderstanding, /advancedPanelsOpen|setAdvancedPanelsOpen/, "opening the outer evidence disclosure must not mount every advanced panel");
assert.match(currentUnderstanding, /<details className="lcr-history-details" onToggle=\{\(event\) => setEvidenceReviewOpen\(event.currentTarget.open\)\}>/, "evidence panel follows its own native disclosure state");
assert.match(currentUnderstanding, /<details className="lcr-history-details" onToggle=\{\(event\) => setClaimAssessmentOpen\(event.currentTarget.open\)\}>/, "claim panel follows its own native disclosure state");
assert.match(currentUnderstanding, /<details className="lcr-history-details" onToggle=\{\(event\) => setConflictReviewOpen\(event.currentTarget.open\)\}>/, "conflict panel follows its own native disclosure state");
assert.match(currentUnderstanding, /<details className="lcr-history-details" onToggle=\{\(event\) => setRecordHistoryOpen\(event.currentTarget.open\)\}>/, "record-history panel follows its own native disclosure state");
assert.doesNotMatch(currentUnderstanding, /allowRecordCreation|allowObservationCapture/, "review panels do not expose capture-mode overrides");
assert.doesNotMatch(evidenceReview, /submitObservation|Save structured observation|Observation kind|Exact source passage/, "manual structured-observation creation is removed from evidence review");
assert.doesNotMatch(evidenceReview, /<form\b/, "evidence review contains no capture forms");
assert.doesNotMatch(evidenceReview, /submitRelationship|Save source relationship|relatedEvidenceId|relationshipRationale/, "evidence review cannot create standalone source links");
assert.doesNotMatch(evidenceReview, /createFreshnessPolicy|Save new policy version|freshnessDomain|freshnessPolicyRationale/, "caregivers cannot author internal freshness policies from Care Continuity");
assert.match(evidenceReview, /loadRelationships/, "existing source relationship history remains readable");
assert.match(evidenceReview, /async function submit\(/, "evidence review capability remains available");
assert.doesNotMatch(changeIntelligence, /recordObservationCoverage|submitCoverage|Save observation coverage|lcr-coverage-editor|<form\b/, "change intelligence has no standalone observation-coverage composer");
assert.doesNotMatch(integrityPanel, /Record a structured observation|Record a source-attributed report|Save structured observation|Save report|Record reference|observationCategory|submitAssertion|recordStructuredObservation/, "independent observation and report creation workflows are removed from Care Continuity");
assert.doesNotMatch(integrityPanel, /<form\b/, "Care Continuity integrity panel contains no record-creation forms");
assert.doesNotMatch(integrityPanel, /Review window in days|reviewWindows|setReviewWindows/, "review-window values cannot be independently entered from Care Continuity");
assert.doesNotMatch(integrityPanel, /When information differs|Next questions|recordOutcome|loadResolutionHistory/, "legacy duplicate conflict and question workflows are removed from the integrity panel");
assert.match(currentUnderstanding, /<ConflictResolutionPanel personId={personId} \/>/, "conflict review remains available in its dedicated section");
assert.match(currentUnderstanding, /Questions that may help clarify care/, "care questions are discoverable without dominating the first LCR view");
assert.match(currentUnderstanding, /clarificationOpen \? <ClarificationWorkflowPanel/, "the clarification workflow mounts only when a caregiver opens it");
assert.doesNotMatch(currentUnderstanding, /careAttention\.needs_clarification\.map/, "care questions are not duplicated in the priority summary and clarification workflow");
assert.match(currentUnderstanding, /Review useful questions/, "the summary routes unresolved clarification needs to one shared question list");
assert.match(currentUnderstanding, /setClarificationOpen\(true\)/, "an explicit request for clarification opens the workflow");
const timelinePage = fs.readFileSync("src/app/workspace/timeline/page.tsx", "utf8");
assert.doesNotMatch(currentUnderstanding, /Earlier care history|ChangeIntelligencePanel|CareChangeHistoryPanel/,
  "the Care Record must not render a competing historical change feed");
assert.match(timelinePage, /How the care picture has changed/,
  "the Care Timeline owns the historical change view");
assert.match(timelinePage, /<ChangeIntelligencePanel personId=\{personId\} \/>/,
  "persisted change intelligence is available in the Care Timeline");
assert.match(timelinePage, /<CareChangeHistoryPanel personId=\{personId\} \/>/,
  "persisted Delta history is available in the Care Timeline");
assert.doesNotMatch(currentUnderstanding, /No immediate concerns were identified/, "an empty record must not be presented as having no immediate concerns");
assert.match(currentUnderstanding, /There isn’t enough recorded care information to assess immediate priorities yet/, "empty record priority state explicitly communicates insufficient information");
assert.match(currentUnderstanding, /internalCaptureRecordTypes/, "capture wrapper records must be excluded from caregiver change summaries");
assert.match(currentUnderstanding, /internalCaptureEventType/, "capture event identifiers embedded in technical explanations must also be excluded");
assert.match(currentUnderstanding, /accepted: "Reviewed"/, "caregiver-facing review status must not say Accepted");
assert.match(currentUnderstanding, /Details found in this note/, "document-derived observations must use caregiver-readable language");
assert.match(currentUnderstanding, /They are not separate reports or independent confirmation/, "extracted details must not be presented as independent evidence");
assert.match(currentUnderstanding, /Original report attached|Related report linked/, "saved source links must be described in caregiver language");
assert.match(currentUnderstanding, /Original report text is not available in this view/, "a linked source without readable text must be distinguished from a missing link");
assert.match(currentUnderstanding, /We couldn’t check whether this care summary is up to date/, "a failed freshness check must preserve the saved summary and warn that it may be out of date");
assert.match(currentUnderstanding, /original report is not linked to this item/i, "a missing source link must be distinguished from unavailable source text");
assert.match(currentUnderstanding, /captureRecord\.notes/, "serialized capture details must be reduced to the original caregiver report");
assert.match(currentUnderstanding, /displayDescription\(item\.description\)/, "care-source descriptions must pass through the caregiver-readable parser");
assert.ok(currentUnderstanding.includes("if (!item.description?.trim()) return null;"), "missing current-care descriptions are omitted instead of rendered as empty-state filler");
assert.ok(currentUnderstanding.includes("Reported as current"), "medication status is explicitly qualified as a report, not a verified instruction");
assert.ok(currentUnderstanding.includes("Reported amount: "), "medication doses and strengths are labelled as reported values, not verified prescriptions");
assert.ok(currentUnderstanding.includes("Reported medication: "), "extracted medication names are labelled as caregiver-reported information");
assert.ok(currentUnderstanding.includes("Medication details are copied from saved reports."), "medication details carry a clear provenance and safety limitation");
assert.ok(currentUnderstanding.includes("The original note could not be displayed."), "source display failures are stated honestly");
assert.match(currentUnderstanding, /<details className="lcr-entry-status">\s*<summary>More about this item<\/summary>/, "priority provenance and diagnostics stay collapsed until requested");
assert.ok(currentUnderstanding.includes("Follow-up: {caregiverSafeAssistantText(item.request_text)"), "the useful follow-up remains visible without opening record diagnostics");
assert.ok(!currentUnderstanding.includes("The original note is saved."), "the UI does not claim source visibility when the original note cannot be displayed");
assert.ok(currentUnderstanding.includes('["no description was recorded.", "saved care information"].includes(normalizedDescription)'), "generic source placeholders are not presented as care facts");
assert.ok(!currentUnderstanding.includes("Additional details are saved.") && !currentUnderstanding.includes("A recorded detail is available in the original note."), "empty observation and interpretation fields do not create caregiver-facing filler");
assert.doesNotMatch(caregiverRenderedCode, /capture_idempotency_key|capture_request_fingerprint|capture_kind/, "idempotency and capture metadata must never appear in caregiver-facing record details");
assert.doesNotMatch(currentUnderstanding, /Source details: /, "technical source-availability fallback must not be exposed to caregivers");
assert.match(integrityPanel, /INTERNAL_REVISION_TARGET_TYPES/, "internal assessment and baseline revisions must not be rendered as caregiver care-history changes");
assert.match(integrityPanel, /caregiverVisibleRevisions/, "the caregiver record-history panel must use its filtered revision view");
assert.match(currentUnderstanding, /structured_daily_capture.*daily_care_entry.*daily_capture/, "known capture wrapper types must not be presented as separate care changes");
assert.doesNotMatch(integrityPanel, /No contradiction records returned|current engine inputs/i, "backend query terminology is not used in caregiver-facing empty states");
assert.doesNotMatch(careContinuity, /lcr-primary-actions|Capture how today is going/, "Care Continuity does not expose parallel capture shortcuts");

assert.match(historyDrawer, /collapseDuplicateDailyCaptureWrappers/, "recent history groups capture wrappers linked to the exact same source evidence");
assert.ok(historyDrawer.includes("source_record_ids: group.map"), "grouped history keeps the IDs of every original source event");

console.log("✓ legacy LCR home is not exposed; its route returns caregivers to the AI Companion");
console.log("✓ underlying capture and longitudinal continuity components remain in the codebase");
console.log("✓ Daily Care remains structured capture only, without an embedded AI agent");
