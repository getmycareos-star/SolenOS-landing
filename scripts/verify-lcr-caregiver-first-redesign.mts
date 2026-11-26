import assert from "node:assert/strict";
import fs from "node:fs";

const legacyRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const capture = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");
const careContinuity = fs.readFileSync("src/app/workspace/care-continuity/page.tsx", "utf8");
const currentUnderstanding = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const caregiverLanguage = fs.readFileSync("src/lib/caregiver-language.ts", "utf8");
const captureReview = fs.readFileSync("src/components/workflows/CaptureAnalysisReview.tsx", "utf8");
const integrityPanel = fs.readFileSync("src/components/CareContinuityIntegrityPanel.tsx", "utf8");
const evidenceReview = fs.readFileSync("src/components/EvidenceReviewPanel.tsx", "utf8");
const changeIntelligence = fs.readFileSync("src/components/mvp-workspace/ChangeIntelligencePanel.tsx", "utf8");
const styles = fs.readFileSync("src/app/mobile-app.css", "utf8");
const experienceStyles = fs.readFileSync("src/app/workspace/experience-design-system.css", "utf8");
const workspaceLayout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const dailyCare = fs.readFileSync("src/app/workspace/daily-care/page.tsx", "utf8");
const structuredDailyCapture = fs.readFileSync("src/components/workflows/StructuredDailyCapture.tsx", "utf8");
const durableWriteSender = fs.readFileSync("src/lib/offline-sync/send-queued-care-write.ts", "utf8");
const workspaceHome = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const handoffs = fs.readFileSync("src/app/workspace/handoffs/page.tsx", "utf8");
const workspaceMore = fs.readFileSync("src/app/workspace/more/page.tsx", "utf8");
const historyDrawer = fs.readFileSync("src/components/app-shell/HistoryDrawer.tsx", "utf8");
const followUps = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");
const companion = fs.readFileSync("src/components/workflows/AICompanion.tsx", "utf8");
const navigation = fs.readFileSync("src/lib/workspace-navigation.ts", "utf8");
const howItWorks = fs.readFileSync("src/app/how-it-works/page.tsx", "utf8");
const publicHome = fs.readFileSync("src/app/page.tsx", "utf8");

assert.match(legacyRoute, /redirect\("\/workspace\/care-continuity"\)/, "the legacy record route redirects safely to Care information");
assert.doesNotMatch(legacyRoute, /SOLENOS · LIVING CARE RECORD|Record timeline|Add to record|CognitiveWorkspace/, "old LCR interface must not be rendered as a separate home");
assert.doesNotMatch(capture, /ConsentGatePanel|consentState !== "accepted"|ResearchPreviewAckGate/, "care-record capture is not blocked by acknowledgement checkboxes");
assert.doesNotMatch(capture, /HelpImproveSolenos|QwenAssistPanel/, "capture workspace does not interleave feedback or a separate AI chat panel");
assert.match(capture, /Start with one thing you want to remember/);
assert.match(capture, /Add a new detail to the care record/, "first-time and returning caregivers retain the shared care-record capture workflow");
assert.match(dailyCare, /StructuredDailyCapture/, "Daily Care retains its structured capture workflow");
assert.match(dailyCare, /useState<CaptureMode \| null>\(null\)/, "Add an update presents contribution choices before opening a specialised form");
assert.match(dailyCare, /<NaturalLanguageDailyUpdate \/>/, "the main update entry uses the existing natural-language capture");
assert.match(dailyCare, /Upload a medical document/, "medical document upload is visible from Add an update");
assert.match(dailyCare, /href="\/workspace\/documents"/, "the medical document action opens the existing Documents workflow");
assert.match(durableWriteSender, /response\?\.success !== true \|\| response\.id === undefined \|\| response\.id === null/, "structured capture cannot show success unless the shared write sender receives a persisted server event receipt");
assert.match(durableWriteSender, /response\?\.ok !== true \|\| typeof response\.care_event_id !== "string"/, "legacy situation writes require an explicit server event receipt");
assert.match(durableWriteSender, /The server did not confirm that this care update was saved\./, "uncertain save outcomes remain explicit instead of displaying a false success");
assert.match(dailyCare, /<section aria-labelledby="daily-care-capture-title"/, "Daily Care keeps the capture workflow directly available");
assert.match(dailyCare, /<section aria-labelledby="daily-care-today-title"/, "today's saved care updates remain visible without opening history");
assert.match(dailyCare, /<details className="daily-care-context-panel">\s*<summary><h2 id="daily-care-documents-title">Recent documents<\/h2><\/summary>/, "documents remain accessible but no longer compete with capture on the Daily Care opening screen");
assert.match(dailyCare, /<details className="daily-care-context-panel">\s*<summary><h2 id="daily-care-follow-ups-title">Needs attention<\/h2><\/summary>/, "unresolved matters are labelled consistently in the update context");
assert.match(dailyCare, /<details className="daily-care-context-panel">\s*<summary><h2 id="daily-care-since-last-title">Since you last opened Daily Care<\/h2><\/summary>/, "visit analytics stay available without crowding the capture and retrieval workflow");
assert.match(dailyCare, /<details className="daily-care-context-panel">\s*<summary><h2>Need to review an earlier update\?<\/h2><\/summary>/, "historical navigation remains accessible through progressive disclosure");
const dailySessionAuthorization = dailyCare.indexOf("void ensureAnonymousSession()");
const dailySessionReady = dailyCare.indexOf("setReady(true);");
const dailyFollowUpRead = dailyCare.indexOf('void getJSON("/open-loops?limit=100&offset=0")');
const dailyContextReads = dailyCare.indexOf("const carePromise = getJSON(");
assert.ok(
  dailySessionAuthorization >= 0
    && dailySessionReady > dailySessionAuthorization
    && dailyFollowUpRead > dailySessionReady
    && dailyContextReads > dailySessionReady,
  "Daily Care capture becomes available after session authorization, then loads follow-ups independently of secondary context reads",
);
assert.match(dailyCare, /ensureAnonymousSession\(\)/, "Daily Care requires a valid server-issued session before capture");
assert.match(dailyCare, /Promise\.all\(\[carePromise, historyPromise\]\)/, "only current care and history determine the page-level context loading state");
assert.doesNotMatch(dailyCare, /Promise\.allSettled\(\[/, "follow-ups, documents and notification status are not blocked behind unrelated secondary reads");
assert.match(dailyCare, /void getJSON\("\/documents\/status\?limit=10"\)/, "document status loads independently");
assert.match(dailyCare, /void getJSON\("\/notifications\?limit=100&offset=0"\)/, "notification status loads independently");
assert.doesNotMatch(dailyCare, /DailyCareQwen|daily-care\/intelligence\/ask/, "Daily Care has no embedded AI agent");
assert.doesNotMatch(workspaceLayout, /type="checkbox"|ResearchPreviewAckGate|ConsentGatePanel/, "workspace route mounts without a pre-entry checkbox");
assert.match(styles, /\.lcr-home/, "existing responsive LCR style system is preserved for continuity components");
assert.doesNotMatch(evidenceReview, /fontSize: 12\b/, "caregiver source review details must not use dense small text");
assert.ok(evidenceReview.includes('fontSize: "calc(14px * var(--solenos-text-scale, 1))"'), "source and review information remains comfortably readable and follows the caregiver’s saved text size");
assert.match(experienceStyles, /lcr-current-fact :where\(p,small,li\)[\s\S]*?font-size: 0\.95rem;[\s\S]*?line-height: 1\.7;/, "care-record detail text remains comfortably readable");
assert.match(experienceStyles, /lcr-current-fact h4[\s\S]*?font-size: calc\(15px \* var\(--solenos-text-scale, 1\)\);/, "care-record section labels remain readable and follow the caregiver’s saved text size");
assert.match(styles, /@media \(max-width: 540px\)/, "mobile layout remains explicitly handled");
const caregiverRenderedCode = currentUnderstanding.slice(currentUnderstanding.indexOf("export function LCRCurrentUnderstanding"));
assert.notEqual(currentUnderstanding.indexOf("export function LCRCurrentUnderstanding"), -1, "caregiver LCR component must exist");
assert.doesNotMatch(caregiverRenderedCode, /persisted records examined|\bConfidence:\s*|Open loops [(]|Situation trajectory [(]|Observation coverage [(]|Personal baseline|No coverage record means unknown|numeric confidence\b|assessment quality/i, "technical assessment diagnostics are not exposed in the caregiver view");
assert.doesNotMatch(careContinuity, /NaturalLanguageDailyUpdate|StructuredDailyCapture|CognitiveWorkspace|AddSituationPanel|compose=1/, "Care information links to contribution without embedding a second capture form");
assert.match(careContinuity, /Add an update/, "Care information links new contributions to the Add an update destination");
assert.match(careContinuity, /Need to add something\?/, "the Care Record links to the owning capture workflow");
assert.match(careContinuity, /CARE_INFORMATION_NAVIGATION\.map/, "Care information exposes the dedicated historical destination");
assert.doesNotMatch(careContinuity, /lcr-timeline|situations\.map/, "the Care Record does not render a second historical event feed");
assert.doesNotMatch(careContinuity, /Additional care details are saved\./, "timeline entries never substitute generic filler for a missing care summary");
assert.doesNotMatch(careContinuity, /situation\.openQuestions\.map/, "care questions are not duplicated under every timeline thread");
assert.doesNotMatch(careContinuity, /Winner selected: no|Supporting information:/, "raw conflict evidence counts and audit flags are not shown in the default timeline");
assert.doesNotMatch(careContinuity, /PersistedCareOrientation|ChangeIntelligencePanel/, "duplicate overview and standalone observation-coverage editor are not mounted on Care Continuity");
assert.match(currentUnderstanding, /lcr-first-screen-summary/, "workspace opens with a concise three-part care orientation");
assert.match(currentUnderstanding, /Your care information/, "first screen explains the recorded care picture");
assert.match(currentUnderstanding, /What matters now/, "first screen surfaces supported care priorities");
assert.match(currentUnderstanding, /<strong>Still unclear:<\/strong>/, "the first-screen summary surfaces recorded uncertainty without turning it into a task");
assert.match(currentUnderstanding, /This record reflects the care information saved here/, "the Care Record uses one concise scope statement instead of repeating its introduction");
assert.doesNotMatch(currentUnderstanding, /Your care information, brought together/, "the redundant introductory headline is removed");
assert.match(currentUnderstanding, /What’s changed/, "first screen summarizes persisted changes");
assert.match(followUps, /item\.source === "events" \|\| item\.source === "persisted_change"\) && item\.record_id/, "event- and change-derived follow-up candidates require an explicit caregiver action before becoming a responsibility");
assert.match(followUps, /onClick=\{\(\) => void onCreate\(item\)\}/, "a suggested follow-up becomes a responsibility only after the caregiver explicitly chooses to create it");
assert.match(followUps, /postJSON\("\/open-loops"/, "adding an event follow-up persists it through the authoritative open-loop API");
assert.match(followUps, /source_type: item\.source,\s*source_id: item\.record_id/, "a persisted follow-up retains its source record link");
assert.match(followUps, /evidence: uniqueEvidenceIds\(item\)\.map\(\(evidenceId\) => \(\{ evidence_id: evidenceId \}\)\)/, "follow-up creation preserves authorized source evidence links");
assert.match(followUps, /pendingCreateKeys\.current\[sourceKey\] \|\| crypto\.randomUUID\(\)/, "uncertain follow-up creation retries reuse an idempotency key");
assert.match(followUps, /const loop = loops\.find\(\(candidate\) => candidate\.id === item\.record_id \|\| \(candidate\.source_type === item\.source && candidate\.source_id === item\.record_id\)\)/, "an event suggestion linked to a saved follow-up must resolve to that existing responsibility");
assert.match(followUps, /\{!loop && \(item\.source === "events" \|\| item\.source === "persisted_change"\)[\s\S]*?Add a follow-up/, "a source-linked suggestion must not offer a second Add to Follow-ups action");
assert.match(followUps, /const unclassifiedLoops = linkedLoops\.filter\(\(loop\) => !allAttention\.some\(\(item\) =>[\s\S]*?item\.source === loop\.source_type && item\.record_id === loop\.source_id/, "a source-linked saved follow-up must not be reintroduced as an unclassified duplicate");
assert.match(followUps, /candidate\.source_type === item\.source && candidate\.source_id === item\.record_id/, "a source-linked saved follow-up remains actionable from its original source");
assert.match(currentUnderstanding, /lcr-progressive-disclosure/, "detailed care information is progressively disclosed");
assert.doesNotMatch(currentUnderstanding, /Missing information does not mean everything is fine|Do not assume there is nothing that needs attention/, "obsolete defensive disclaimers are removed from caregiver-facing copy");
assert.match(currentUnderstanding, /There isn’t enough recorded care information to assess immediate priorities yet/, "an empty care record is described as insufficient information, not a reassuring finding");
assert.match(currentUnderstanding, /RecordState kind="error".*onAction=\{\(\) => void load\(true\)\}/s, "failed current-care retrieval renders an actionable error state with a real retry");
assert.ok(workspaceHome.includes('<LCRCurrentUnderstanding showNextStep viewMode="today" />'), "Home uses the concise current-care projection and record-aware next step");
assert.ok(workspaceHome.includes("<UpcomingAppointmentSummary />"), "Home retains upcoming appointment context after the current-care picture");
assert.doesNotMatch(workspaceHome, /<CaregiverHandoverInbox \/>/, "the Home page does not carry a secondary inbox");
assert.match(handoffs, /<CaregiverHandoverInbox \/>/, "the handover inbox remains available within Care handoffs");
assert.doesNotMatch(workspaceMore, /HistoryDrawer/, "More does not contain care-history browsing");
assert.match(careContinuity, /CARE_INFORMATION_NAVIGATION\.map/, "care-history and care-information destinations are discoverable together");
assert.ok(navigation.includes('href: "/workspace/companion"') && navigation.includes('label: "Ask SolenOS"'), "Ask SolenOS remains a primary destination");
assert.ok(navigation.includes('href: "/workspace/daily-care"') && navigation.includes('label: "Add an update"'), "Add an update remains a primary destination");
assert.match(currentUnderstanding, /evidenceReviewOpen \? <EvidenceReviewPanel personId={personId} \/>/, "evidence review mounts only when its own disclosure is opened");
assert.match(currentUnderstanding, /claimAssessmentOpen \? <ClaimAssessmentPanel \/>/, "claim review mounts only when its own disclosure is opened");
assert.match(currentUnderstanding, /conflictReviewOpen \? <ConflictResolutionPanel personId={personId} \/>/, "conflict review mounts only when its own disclosure is opened");
assert.match(currentUnderstanding, /recordHistoryOpen \? <CareContinuityIntegrityPanel personId={personId} \/>/, "record history mounts only when its own disclosure is opened");
assert.doesNotMatch(currentUnderstanding, /advancedPanelsOpen|setAdvancedPanelsOpen/, "opening the outer evidence disclosure must not mount every advanced panel");
assert.match(currentUnderstanding, /if \(evidenceReviewDetailsRef\.current\?\.open\) setEvidenceReviewOpen\(true\)/, "an evidence section opened before hydration still mounts its panel");
assert.match(currentUnderstanding, /if \(claimAssessmentDetailsRef\.current\?\.open\) setClaimAssessmentOpen\(true\)/, "a claim section opened before hydration still mounts its panel");
assert.match(currentUnderstanding, /if \(conflictReviewDetailsRef\.current\?\.open\) setConflictReviewOpen\(true\)/, "a conflict section opened before hydration still mounts its panel");
assert.match(currentUnderstanding, /if \(recordHistoryDetailsRef\.current\?\.open\) setRecordHistoryOpen\(true\)/, "a record-history section opened before hydration still mounts its panel");
assert.match(currentUnderstanding, /<details ref=\{evidenceReviewDetailsRef\} className="lcr-history-details" onToggle=\{\(event\) => setEvidenceReviewOpen\(event.currentTarget.open\)\}>/, "evidence panel follows its own native disclosure state");
assert.match(currentUnderstanding, /<details ref=\{claimAssessmentDetailsRef\} className="lcr-history-details" onToggle=\{\(event\) => setClaimAssessmentOpen\(event.currentTarget.open\)\}>/, "claim panel follows its own native disclosure state");
assert.match(currentUnderstanding, /<details ref=\{conflictReviewDetailsRef\} className="lcr-history-details" onToggle=\{\(event\) => setConflictReviewOpen\(event.currentTarget.open\)\}>/, "conflict panel follows its own native disclosure state");
assert.match(currentUnderstanding, /<details ref=\{recordHistoryDetailsRef\} className="lcr-history-details" onToggle=\{\(event\) => setRecordHistoryOpen\(event.currentTarget.open\)\}>/, "record-history panel follows its own native disclosure state");
assert.doesNotMatch(currentUnderstanding, /allowRecordCreation|allowObservationCapture/, "review panels do not expose capture-mode overrides");
assert.match(captureReview, /These suggestions are not part of the care record until you accept them\./, "unapproved extraction suggestions stay outside the care record");
assert.match(captureReview, /candidate\.source_quote/, "the caregiver can inspect the original quotation before deciding");
assert.match(captureReview, /The original quotation is not available in this review\./, "missing source quotation is disclosed rather than silently omitted");
assert.match(captureReview, /editingIndex === index \? \(/, "correction fields are hidden until the caregiver chooses Correct");
assert.match(captureReview, /onClick=\{\(\) => setEditingIndex\(index\)\}/, "the caregiver explicitly enters correction mode");
assert.match(captureReview, /onClick=\{\(\) => \{\s*setDrafts\(\(current\) => \(\{\s*\.\.\.current,\s*\[index\]: \{\s*subject: values\.subject,\s*observation: values\.observation,\s*\},\s*\}\)\);\s*setEditingIndex\(null\);\s*\}\}/, "cancelling correction restores the persisted suggestion and discards unsaved edits");
assert.match(captureReview, /persistedCandidate\.review_status !== expectedReviewStatus/, "the persisted caregiver decision must match the requested review transition");
assert.match(captureReview, /decision === "accept" && persisted\.written_to_lcr !== true/, "only an explicitly accepted suggestion may be confirmed as written to the care record");
assert.match(captureReview, /review\(index, "accept"\)/, "caregivers can accept a suggested detail");
assert.match(captureReview, /review\(index, "correct"\)/, "caregivers can correct a suggested detail");
assert.match(captureReview, /review\(index, "reject"\)/, "caregivers can dismiss a suggested detail");
assert.match(captureReview, /Correction saved\. It still needs approval before it becomes part of the care record\./, "a correction remains pending approval rather than silently becoming a care-record fact");
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
assert.match(currentUnderstanding, /Questions that still need answers/, "care questions are discoverable without dominating the first LCR view");
assert.match(currentUnderstanding, /clarificationOpen \? <ClarificationWorkflowPanel/, "the clarification workflow mounts only when a caregiver opens it");
assert.doesNotMatch(currentUnderstanding, /careAttention\.needs_clarification\.map/, "care questions are not duplicated in the priority summary and clarification workflow");
assert.match(currentUnderstanding, /Review questions/, "the summary routes unresolved clarification needs to one shared question list");
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
assert.match(caregiverLanguage, /for \(const key of \["notes", "original_notes", "text", "description", "observation", "summary"\]\)/, "serialized capture notes must be reduced to the original caregiver report before display");
assert.match(currentUnderstanding, /caregiverReadableCaptureText\(value\)/, "care-source descriptions must pass through the caregiver-readable capture parser");
assert.match(currentUnderstanding, /displayDescription\(item\.description\)/, "care-source descriptions must pass through the caregiver-readable parser");
assert.ok(currentUnderstanding.includes("if (!item.description?.trim()) return null;"), "missing current-care descriptions are omitted instead of rendered as empty-state filler");
assert.ok(currentUnderstanding.includes("Reported as current"), "medication status is explicitly qualified as a report, not a verified instruction");
assert.ok(currentUnderstanding.includes("Reported amount: "), "medication doses and strengths are labelled as reported values, not verified prescriptions");
assert.ok(currentUnderstanding.includes("Reported medication: "), "extracted medication names are labelled as caregiver-reported information");
assert.match(currentUnderstanding, /These medication details come from saved reports\. They do not confirm the current prescription or whether a dose was given\./, "medication details carry a clear provenance and safety limitation");
assert.ok(currentUnderstanding.includes("The original note could not be displayed."), "source display failures are stated honestly");
assert.match(currentUnderstanding, /<details className="lcr-entry-status">\s*<summary>More about this item<\/summary>/, "priority provenance and diagnostics stay collapsed until requested");
assert.ok(currentUnderstanding.includes("Follow-up: {caregiverSourceText(item.request_text)"), "the original follow-up wording remains visible without opening record diagnostics");
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

assert.match(currentUnderstanding, /caregiverReadableCaptureText\(value\)/, "the Living Care Record uses the shared readable source formatter");
assert.match(currentUnderstanding, /source_evidence\?: ChangeSourceEvidence\[\]/, "change detail includes original saved source records");
assert.match(currentUnderstanding, /observations\?: ChangeObservationEvidence\[\]/, "change detail includes source-linked observations");
assert.match(currentUnderstanding, /caregiverReadableCaptureText\(source\.source_text\)/, "original source text is rendered in caregiver language");
assert.match(currentUnderstanding, /Array\.isArray\(result\.source_evidence\) \? result\.source_evidence : \[\]/, "the caregiver UI remains compatible with a backend that has not yet deployed the additional source detail");
assert.match(currentUnderstanding, /changeEvidence\[change\.id\].*source_evidence\.map/, "supporting source records are visible in the change review");
assert.match(currentUnderstanding, /const refreshWholeRecord = useCallback/, "the main refresh action runs care reassessment and reloads the record");
assert.match(currentUnderstanding, /\}, \[refreshSituationAssessment, load\]\);/, "whole-record refresh callback has stable dependencies");
assert.match(currentUnderstanding, /\}, \[load, refreshWholeRecord\]\);/, "care-record update listener depends on the complete refresh callback");
assert.doesNotMatch(currentUnderstanding, /const reassess = useCallback/, "duplicate assessment-only refresh logic is removed");
assert.match(currentUnderstanding, /await refreshSituationAssessment\(\);\s*await load\(true\);/, "refresh backfills saved details before reloading the caregiver view");
assert.doesNotMatch(currentUnderstanding, /Scope: selected areas only/, "internal capture scope is not shown in the caregiver record");
assert.match(evidenceReview, /showInternalSourceChecks = props\?\.showInternalSourceChecks === true/, "technical source checks are opt-in rather than caregiver-default");
assert.match(evidenceReview, /showInternalSourceChecks && \(/, "internal source checks are hidden from the caregiver view");
assert.match(evidenceReview, /<summary>Review or correct this information<\/summary>/, "the optional source review form is collapsed until requested");
assert.match(evidenceReview, /Shared by<\/dt>/, "source review uses plain caregiver language");
assert.doesNotMatch(evidenceReview, /How much to rely on this information/, "technical source confidence wording is not exposed");
assert.match(integrityPanel, /More about the care information saved here/, "care history details use caregiver-facing language");
assert.doesNotMatch(integrityPanel, /Care Record details|Care details shared with SolenOS/, "internal panel labels are not exposed");
assert.doesNotMatch(currentUnderstanding, /bounded record view|deterministic state checks/i, "internal assessment terminology is not shown in the caregiver record");
assert.doesNotMatch(currentUnderstanding, /Compared: Time not recorded.*Time not recorded/, "missing comparison dates are not displayed as a fake date range");

console.log("✓ legacy LCR home is not exposed; its route returns caregivers to Home");
console.log("✓ underlying capture and longitudinal continuity components remain in the codebase");
assert.match(companion, /Ask SolenOS/, "the caregiver-facing assistant uses the approved caregiver-facing destination name");
assert.doesNotMatch(companion, /AI Companion/, "internal product terminology is not shown in the caregiver interface");
assert.match(navigation, /label: "Ask SolenOS"/, "workspace navigation uses the Ask SolenOS destination name");
assert.match(howItWorks, /Ask SolenOS/, "the public how-it-works guide uses the canonical Ask SolenOS name");
assert.doesNotMatch(howItWorks, /AI Companion/, "the public how-it-works guide does not expose internal product terminology");
assert.match(publicHome, /Ask SolenOS/, "the public home page uses the canonical Ask SolenOS name");
assert.doesNotMatch(publicHome, /AI Companion/, "the public home page does not expose internal product terminology");

console.log("✓ Daily Care remains structured capture only, without an embedded AI agent");

assert.match(currentUnderstanding, /<h2 id="lcr-current-understanding-heading">Your Care Record<\/h2>/, "the primary care view uses the caregiver-facing Care Record name");
assert.match(currentUnderstanding, /<h3>What matters now<\/h3>/, "the first attention summary uses caregiver language");
assert.match(currentUnderstanding, /Questions that still need answers[\s\S]*?clarificationCareDecisions\.length[\s\S]*?Review questions/, "saved clarification decisions are presented in a concise caregiver-readable summary without duplicating the full question list");
assert.match(currentUnderstanding, /<h4 id="lcr-registered-actions-heading">What’s been agreed<\/h4>/, "recorded actions are presented as agreed care");

assert.match(currentUnderstanding, /item\.derived_observations && item\.derived_observations\.length > 0[\s\S]*?Details found in this note[\s\S]*?observation\.value_text/, "the full care history renders persisted extracted details instead of hiding them");
assert.match(currentUnderstanding, /observation\.context[\s\S]*?observation\.source_passage/, "extracted details retain their caregiver context and original source passage");

assert.match(currentUnderstanding, /outcomes\?: CurrentCareItem\[\][\s\S]*?projection\.outcomes\.map/, "persisted outcomes have a dedicated caregiver-facing projection");
assert.match(currentUnderstanding, /<h3 id="lcr-outcomes-heading">What happened<\/h3>/, "the Living Care Record shows recorded outcomes separately from agreed actions");
assert.match(currentUnderstanding, /related_record_type[\s\S]*?Linked to/, "outcomes retain their link to the decision, action or follow-up that produced them");

assert.match(currentUnderstanding, /<h3 id="lcr-history-heading">Your care history<\/h3>[\s\S]*?href="\/workspace\/timeline"/, "the caregiver can open the complete chronological care history");

assert.match(currentUnderstanding, /projection\.missing_required_sources\.length > 0 \|\| projection\.missing_optional_sources\.length > 0[\s\S]*?Some care history could not be loaded/, "an incomplete retrieval is never presented as an empty care record");
assert.match(currentUnderstanding, /!projection \|\| projection\.missing_required_sources\.length > 0[\s\S]*?Some saved outcomes may not be available right now/, "unavailable outcome history is distinguished from no recorded outcomes");

assert.match(currentUnderstanding, /reported_by_caregiver_id[\s\S]*?another caregiver/, "the saved source shows whether it was shared by the current caregiver or another caregiver without exposing internal IDs");

assert.match(currentUnderstanding, /retryHistorySource = useCallback[\s\S]*?current-care\?limit_per_source=12&source=/,
  "each failed care-history source can be retried independently");
assert.match(currentUnderstanding, /response\.requested_sources\?\.length !== 1[\s\S]*?response\.requested_sources\[0\] !== sourceName/,
  "a source retry must return only the requested history category");
assert.match(currentUnderstanding, /sourceRecoveryPanel[\s\S]*?Retrying…[\s\S]*?Retry/,
  "failed and partial care-history sources expose a category-specific retry action");
assert.match(currentUnderstanding, /failed_sources\?: string\[\]/,
  "the caregiver UI consumes explicit failed-source coverage rather than treating it as an empty list");

assert.match(currentUnderstanding, /coverage\.status === "stale"[\s\S]*?previously saved details remain available/,
  "a failed category retry must preserve and label previously retrieved care information as stale");
assert.match(currentUnderstanding, /suggestion_version: item\.version/,
  "follow-up approval must carry the version actually shown to the caregiver");
assert.match(currentUnderstanding, /if \(item\.source !== "open_loop_records"\)[\s\S]*?Only a saved follow-up with a current version can be approved/,
  "only persisted versioned follow-ups may be approved as registered actions");
assert.match(currentUnderstanding, /cause instanceof ApiResponseError && cause\.status === 409[\s\S]*?void load\(true\)/,
  "a stale follow-up approval must trigger a refresh instead of silently retrying old details");
assert.match(currentUnderstanding, /const approveFollowUp[\s\S]*?personIdRef\.current !== personId[\s\S]*?if \(personIdRef\.current === personId\) setActionApprovalLoadingId\(null\)/,
  "late follow-up approval responses must not overwrite another active care record");

assert.match(dailyCare, /schema_status !== "complete"[\s\S]*?missing_required_sources[\s\S]*?missing_optional_sources[\s\S]*?failed_sources/, "Daily Care must disclose incomplete current-care retrieval instead of treating partial results as complete");
assert.match(dailyCare, /Some saved care information could not be fully checked\. This view may be incomplete/, "a partial current-care projection must be explained in plain language");

const dailyCareResetStart = dailyCare.indexOf("const resetForSessionChange = () => {");
const dailyCareResetEnd = dailyCare.indexOf("\n    };", dailyCareResetStart);
const dailyCareReset = dailyCare.slice(dailyCareResetStart, dailyCareResetEnd);
assert.ok(dailyCareResetStart >= 0 && dailyCareResetEnd > dailyCareResetStart, "Daily Care has an explicit active-person reset handler");
assert.match(dailyCareReset, /setCareItems\(\[\]\)/, "Daily Care clears prior care items when the active person changes");
assert.match(dailyCareReset, /setHistoryItems\(\[\]\)/, "Daily Care clears prior history when the active person changes");
assert.match(dailyCareReset, /setReady\(false\)/, "Daily Care blocks the previous person’s view while the new session loads");
assert.match(dailyCare, /addEventListener\("personIdChanged", resetForSessionChange\)/, "Daily Care listens for active-person changes");
