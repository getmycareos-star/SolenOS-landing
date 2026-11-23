import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sanitizeCaregiverErrorMessage } from "../src/lib/mvp-input-architecture/first-input";
import { adaptForCaregiverCapacity } from "../src/lib/care-reality-engine/capacity-adaptation";

const root = process.cwd();

// Explicit overload language must reduce demands without turning ordinary concern
// into an overload classification.
for (const phrase of [
  "I'm exhausted",
  "I can't cope with all of this",
  "I'm so tired",
  "This is too much to handle",
  "I am at my limit",
  "I can't do this anymore",
]) {
  const adaptation = adaptForCaregiverCapacity(phrase);
  assert.equal(adaptation.overload_likely, true, phrase);
  assert.equal(adaptation.max_asks, 1, phrase);
  assert.equal(adaptation.shorten_response, true, phrase);
  assert.equal(adaptation.single_priority_only, true, phrase);
}
assert.equal(adaptForCaregiverCapacity("Can you explain the appointment time?").overload_likely, false);
const companion = fs.readFileSync(path.join(root, "src/components/workflows/AICompanion.tsx"), "utf8");
const settings = fs.readFileSync(path.join(root, "src/app/workspace/settings/page.tsx"), "utf8");
const orientation = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const deltaPanel = fs.readFileSync(path.join(root, "src/components/CareDeltaPanel.tsx"), "utf8");
const dailyCapture = fs.readFileSync(path.join(root, "src/components/workflows/StructuredDailyCapture.tsx"), "utf8");
const captureReview = fs.readFileSync(path.join(root, "src/components/workflows/CaptureAnalysisReview.tsx"), "utf8");
const landingStyles = fs.readFileSync(path.join(root, "src/app/landing.css"), "utf8");
const notifications = fs.readFileSync(path.join(root, "src/app/workspace/notifications/page.tsx"), "utf8");
const assistPanel = fs.readFileSync(path.join(root, "src/components/qwen/QwenAssistPanel.tsx"), "utf8");
const qwenPanel = fs.readFileSync(path.join(root, "src/components/qwen/QwenAssistPanel.tsx"), "utf8");
const workspaceComposer = fs.readFileSync(path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"), "utf8");

// Errors must be event-driven, dismissible through correction/reset, and not stale.
assert.match(companion, /\{requestError && messages\.length > 0 && <div className="companion-error" role="alert"/, "a retryable message error must only appear after a conversation message exists");
assert.match(companion, /setRequestError\(null\)/);
assert.match(companion, /const startNewSession = \(\) => \{[\s\S]*?setRequestError\(null\)/);
assert.match(companion, /onChange=\{event => handleInput\(event\.target\.value\)\}/);
assert.match(workspaceComposer, /setRawInput\(value\);[\s\S]*?setLcrOrientationReply\(null\);[\s\S]*?setCaregiverError\(null\)/);
assert.match(workspaceComposer, /setDocuments\(nextDocuments\);[\s\S]*?setLcrOrientationReply\(null\);[\s\S]*?setCaregiverError\(null\)/);
assert.match(sanitizeCaregiverErrorMessage("Situation hydration failed (404)"), /We couldn’t complete that step/);
assert.match(sanitizeCaregiverErrorMessage("Failed to fetch /api/situation"), /We couldn’t complete that step/);

// Internal evaluation metadata must never be rendered into the caregiver conversation.
assert.doesNotMatch(companion, /Safety: \{msg\.safety_note\}/);
assert.doesNotMatch(companion, /Guard: \{msg\.guard_verdict\}/);
assert.doesNotMatch(companion, /Confidence: \{Math\.round/);
assert.doesNotMatch(companion, /Evidence: \{msg\.evidence_ids/);
assert.match(companion, /deterministic_low_capacity_support_fallback/);
assert.match(companion, /I couldn't find enough information in your Care Record to give a reliable answer/);
assert.match(companion, /msg\.safety_note/);
assert.doesNotMatch(companion, /Replies may be unavailable sometimes/);
assert.doesNotMatch(companion, /The safety engine flagged this exchange/);
assert.match(companion, /A few words are enough/);
assert.match(companion, /You don’t have to figure it all out right now/);
assert.match(companion, /postJSON\('\/conversation\/message'/);
assert.match(companion, /pendingCareUpdates/, "Companion must load caregiver-created, person-scoped review proposals");
assert.match(companion, /getJSON\('\/companion\/care-updates'/, "Companion must use the authenticated review queue");
assert.match(companion, /reviewCareUpdate/, "caregivers must explicitly accept or decline a suggested care report");
assert.match(companion, /postJSON\('\/companion\/care-updates\//, "review decisions must use the persisted backend review endpoint");
assert.match(companion, /response\?\.status !== expectedStatus/, "a review must not be reported successful without the server-confirmed terminal status");
assert.match(companion, /response\?\.decision !== decision/, "the returned decision must match the caregiver's requested decision");
assert.match(companion, /window\.dispatchEvent\(new Event\('careRecordUpdated'\)\)/, "an accepted Companion report must refresh canonical LCR consumers");
assert.match(companion, /We couldn’t confirm whether this review was saved/, "ambiguous network outcomes must not be misreported as failed or successful");
assert.match(companion, /source_message_id\?: string \| null/, "the Companion must retain the original persisted user-message ID");
assert.match(companion, /from-message\//, "caregivers must be able to submit an exact original message for review");
assert.match(companion, /confirm_care_report: true/, "creating a care report must require explicit caregiver confirmation");
assert.match(companion, /not a question, possibility or guess/, "the confirmation must distinguish reports from questions and hypotheticals");
assert.match(companion, /Save as a care note/, "the report action must be explicit and separate from ordinary chat");
assert.match(companion, /Add to Care Record/, "adding a Companion report must require an explicit caregiver action");
assert.match(companion, /Don’t add/, "caregivers must be able to decline a suggested update");
assert.match(companion, /A healthcare professional has not confirmed it/, "accepted Companion reports must remain distinct from clinical verification");
assert.match(settings, /notificationReviewHref/);
assert.match(settings, /care_attention.*care_change/s, "care attention and change notifications must link to the Care Record");
assert.match(settings, /\/workspace\/care-continuity/);
assert.match(settings, /\/workspace\/open-loops/);
assert.match(settings, /\/workspace\/reminders/);
assert.match(settings, /Review in Care Record/);
assert.match(companion, /Nothing is added to your Care Record unless you choose to save a message as a care note and approve it\./, "Companion must accurately explain the explicit approval boundary");
assert.doesNotMatch(deltaPanel, /autoInput|showPanel|lastToken/,
  "Delta comparison must not support hidden automatic reconciliation");
assert.match(deltaPanel, /onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void reconcile\(/,
  "a Delta comparison must only run from an explicit caregiver submission");
assert.doesNotMatch(dailyCapture, /CareDeltaPanel|deltaAutoInput|care-delta\/reconcile/,
  "Daily Care must not launch a second browser-side Delta comparison; the persisted backend reconciliation is authoritative");
assert.match(dailyCapture, /window\.dispatchEvent\(new Event\('careRecordUpdated'\)\)/,
  "a successful Daily Care save must refresh the existing persisted LCR projections");


// The saved-care orientation must use the same authenticated, read-only
// current-care projection as the main Care Continuity view.
assert.match(orientation, /Your Care Record does not have any care information yet/);
assert.match(orientation, /getJSON\("\/care-continuity\/current-care/);
assert.match(orientation, /projection_type !== "bounded_evidence_derived_current_care"/);
assert.match(orientation, /data\.read_only !== true/);
assert.match(orientation, /Missing information does not mean that nothing happened/);
assert.doesNotMatch(orientation, /situation-understanding\/reassess|postJSON|fetch\(\x60\/api\/situation/);
assert.match(orientation, /Your care information isn't available right now\. Check your connection and try again\./);
assert.doesNotMatch(orientation, /<p><\/p>/);

// Primary controls have explicit, high-contrast sage/ink tokens.
assert.match(styles, /--solenos-sage-button: #b9d5b5/);
assert.match(styles, /--solenos-button-ink: #17251c/);
assert.match(styles, /\.structured-daily-capture input[^,]*,[\s\S]*?color: #172b35 !important/);
assert.match(dailyCapture, /measured_at: toLocalDateTimeInput\(\)/);
assert.match(dailyCapture, /heart_rate: 'bpm'/);
assert.match(dailyCapture, /observed_at: toLocalDateTimeInput\(\)/);
assert.match(dailyCapture, /Added to this daily-care draft/);
assert.doesNotMatch(dailyCapture, /The backend did not provide a persistent review ID/);
assert.doesNotMatch(dailyCapture, /Failed to add vital:/);
assert.match(dailyCapture, /medicationError && <p role="alert"/);
assert.match(dailyCapture, /medicationFeedback && <p role="status"/);
assert.doesNotMatch(dailyCapture, /alert\('Medication added successfully'\)/);
assert.doesNotMatch(dailyCapture, /alert\('Scale added successfully'\)/);
assert.match(dailyCapture, /mode = "all"/, "Daily Care capture supports the current mode-based entry contract");
assert.match(dailyCapture, /Added to this daily-care draft/);
assert.doesNotMatch(dailyCapture, /Unverified extraction/);
assert.doesNotMatch(dailyCapture, /Not returned by the extractor/);
assert.doesNotMatch(landingStyles, /Strong, high-contrast calls to action/);
assert.doesNotMatch(landingStyles, /box-shadow: 0 3px 0 rgba\(23, 63, 75, 0\.18\)/);
assert.doesNotMatch(notifications, /Backend-backed notifications/);
assert.ok(assistPanel.includes('background: "var(--theme-field-bg)"') && assistPanel.includes('color: "var(--theme-field-fg)"'));
assert.ok(assistPanel.includes("--theme-action-disabled-bg"));
assert.match(assistPanel, /setQuestion\(event\.target\.value\); setError\(null\)/);
assert.match(assistPanel, /--theme-warning-bg/);
assert.ok(qwenPanel.includes('background: "var(--theme-field-bg)"') && qwenPanel.includes('color: "var(--theme-field-fg)"'));
assert.ok(qwenPanel.includes("--theme-action-disabled-bg"));
assert.match(qwenPanel, /setError\(null\)/);
// Qwen context details are not rendered as a caregiver-facing debug label in this component.


const themeOverrides = fs.readFileSync(path.join(root, "src/app/accessibility-overrides.css"), "utf8");
const dailyCarePage = fs.readFileSync(path.join(root, "src/app/workspace/daily-care/page.tsx"), "utf8");
const lcrCurrent = fs.readFileSync(path.join(root, "src/components/mvp-workspace/LCRCurrentUnderstanding.tsx"), "utf8");
const appLayout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
assert.ok(appLayout.includes('import "./accessibility-overrides.css";'));
const experienceStyles = fs.readFileSync(path.join(root, "src/app/workspace/experience-design-system.css"), "utf8");
const careOverviewStyles = experienceStyles.slice(
  experienceStyles.indexOf(".solenos-chat-app .solenos-care-next-step"),
  experienceStyles.indexOf("/* Care Record overview presentation"),
);
assert.match(careOverviewStyles, /background: var\(--sn-surface-soft\)/, "Care Overview action panel must follow the active surface theme");
assert.match(careOverviewStyles, /\.solenos-care-primary-action \{ background: var\(--sn-sage\); border-color: var\(--sn-sage\); color: #17251c; \}/, "primary Care Overview action must retain sage-and-ink contrast in both themes");
assert.match(careOverviewStyles, /\.solenos-care-secondary-action \{ background: var\(--sn-surface\); color: var\(--sn-forest\); \}/, "secondary Care Overview action must use the active surface and text tokens");
const v2Styles = fs.readFileSync(path.join(root, "src/app/workspace/experience-design-system-v2.css"), "utf8");
const workspaceLayout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");
const appShell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const navigationRegistry = fs.readFileSync(path.join(root, "src/lib/workspace-navigation.ts"), "utf8");
const settingsPageSource = fs.readFileSync(path.join(root, "src/app/workspace/settings/page.tsx"), "utf8");
const caregiverAccessSource = fs.readFileSync(path.join(root, "src/components/mvp-workspace/CaregiverAccessPanel.tsx"), "utf8");
assert.ok(settingsPageSource.includes("onToggle={(event) => setCaregiverAccessOpen(event.currentTarget.open)}"));
assert.ok(settingsPageSource.includes("<CaregiverAccessPanel enabled={caregiverAccessOpen} />"));
assert.match(caregiverAccessSource, /if \(enabled\) void load\(\)/);
assert.match(caregiverAccessSource, /getJSON\(\s*"\/caregiver-responsibilities\/history\//, "caregiver responsibility history must be retrieved from the authenticated backend");
assert.match(caregiverAccessSource, /getJSON\("\/caregiver-activities\//, "caregiver activity history must be retrieved from the authenticated backend");
assert.match(caregiverAccessSource, /postJSON\("\/caregiver-activities"/, "caregiver activity records must persist through the backend");
assert.match(caregiverAccessSource, /does not change the person’s Care Record/, "caregiver activity history must remain separate from the person’s Care Record");
assert.match(caregiverAccessSource, /We couldn't confirm that this activity was saved/, "ambiguous activity writes must not be reported as success");
assert.ok(workspaceLayout.includes('import "./experience-design-system-v2.css";'));
assert.ok(v2Styles.includes(".solenos-chat-app.is-sidebar-collapsed"));
assert.ok(appShell.includes("solenos_sidebar_collapsed") && appShell.includes("Collapse navigation"));
assert.ok(!navigationRegistry.includes('href: "/workspace/community"') && !navigationRegistry.includes('id: "community"'));
const communityPage = fs.readFileSync(path.join(root, "src/app/workspace/community/page.tsx"), "utf8");
const featureFlags = fs.readFileSync(path.join(root, "src/lib/feature-flags.ts"), "utf8");
assert.ok(featureFlags.includes("community: false") && featureFlags.includes("professionalCommunity: false"));
assert.ok(communityPage.includes('redirect("/workspace")'));
const quickCheckIn = fs.readFileSync(path.join(root, "src/components/workflows/QuickDailyCheckIn.tsx"), "utf8");
const naturalDailyUpdate = fs.readFileSync(path.join(root, "src/components/workflows/NaturalLanguageDailyUpdate.tsx"), "utf8");
const documentsPage = fs.readFileSync(path.join(root, "src/app/workspace/documents/page.tsx"), "utf8");
const appointmentsPage = fs.readFileSync(path.join(root, "src/app/workspace/appointments/page.tsx"), "utf8");
const appointmentWorkflow = fs.readFileSync(path.join(root, "src/components/workflows/AppointmentWorkspace.tsx"), "utf8");
assert.ok(appointmentWorkflow.includes("guided-appointment") && !appointmentWorkflow.includes("<style jsx>"), "appointment workflow must use the shared design system");
assert.doesNotMatch(appointmentWorkflow, /style=\{\{/, "appointment briefing layout must not use inline styles");
assert.ok(v2Styles.includes(".guided-full-span"), "appointment briefing must use the shared full-span layout utility");
assert.ok(v2Styles.includes(".guided-appointment") && v2Styles.includes(".guided-panel") && v2Styles.includes(".guided-capture-label textarea"), "appointment workflow surfaces must be styled centrally");
assert.ok(dailyCapture.includes("var(--theme-success-bg)") && dailyCapture.includes("var(--theme-warning-bg)"));
assert.doesNotMatch(documentsPage, /#(?:8eae8a|b9d5b5)|var\(--danger, #a22\)/i, "document actions and errors must use shared theme tokens");
assert.ok(documentsPage.includes("var(--theme-action-bg)") && documentsPage.includes("var(--theme-error-fg)"));
// Appointment styles are governed by semantic theme tokens; assert the required tokens above.
const careRecordOverview = fs.readFileSync(path.join(root, "src/components/app-shell/CareRecordOverview.tsx"), "utf8");
const timelinePage = fs.readFileSync(path.join(root, "src/app/workspace/timeline/page.tsx"), "utf8");
const dailyCareQwen = fs.readFileSync(path.join(root, "src/components/workflows/DailyCareQwen.tsx"), "utf8");

// Dark-mode contrast is a supported product contract, not a screenshot-only check.
assert.ok(themeOverrides.includes(':root[data-solenos-theme="dark"]') && themeOverrides.includes("--theme-panel-bg: #202a24"));
assert.ok(themeOverrides.includes("--theme-field-bg: #18211c"));
assert.ok(themeOverrides.includes("--theme-warning-fg: #fff0cf"));
assert.ok(themeOverrides.includes("--theme-action-disabled-fg: #e6eee7") && themeOverrides.includes("button:disabled"));
assert.ok(dailyCarePage.includes("var(--theme-panel-bg)"));
assert.ok(dailyCarePage.includes("var(--theme-link)") && !dailyCarePage.includes("#267c78"), "Daily Care focus treatment must use the shared theme link color");
assert.ok(dailyCarePage.includes("var(--theme-field-fg)"));
assert.ok(quickCheckIn.includes("var(--theme-selected-bg)") && quickCheckIn.includes('className="quick-daily-checkin"'));
assert.ok(appointmentsPage.includes("appointments-page") && v2Styles.includes(".solenos-chat-main .appointments-page") && v2Styles.includes("var(--sn-muted)"));
assert.ok(timelinePage.includes("timeline-workspace"));
assert.doesNotMatch(careRecordOverview, /style=\{\{/ , "Care Record overview must not use hard-coded inline presentation");
assert.ok(careRecordOverview.includes("care-record-overview__section") && careRecordOverview.includes("care-record-overview__status"));
assert.ok(careRecordOverview.includes("caregiverInformationLabel") && careRecordOverview.includes("caregiverStatusLabel"), "Care Record overview must use shared caregiver-safe evidence and status labels");
assert.doesNotMatch(careRecordOverview, /const labels: Record<string, string>/, "Care Record overview must not maintain a duplicate status dictionary");
assert.ok(v2Styles.includes(".care-record-overview__section") && v2Styles.includes("var(--theme-panel-bg)") && v2Styles.includes("var(--theme-field-bg)"), "Care Record overview must use shared light/dark theme tokens");
assert.doesNotMatch(experienceStyles, /\.solenos-chat-app \.care-record-overview/, "legacy overview selectors must not override the shared theme classes");
assert.doesNotMatch(themeOverrides, /:root\[data-solenos-theme="dark"\] \.care-record-overview/, "dark mode must not force light-card text colors on the Care Record overview");
assert.ok(timelinePage.includes("timeline-event-toggle") && timelinePage.includes("timeline-event-details"));
assert.ok(timelinePage.includes("capture_processing?.review_required"), "care history must surface pending Daily Care extraction reviews on the original saved update");
assert.ok(timelinePage.includes("<CaptureAnalysisReview"), "care history must reopen the saved caregiver review without requiring a new capture");
assert.ok(timelinePage.includes("capture_processing: row.capture_processing"), "care history mapping must preserve the review link returned by the backend");
assert.ok(v2Styles.includes(".timeline-event-toggle") && v2Styles.includes(".timeline-event-details"), "care history must use the shared, theme-aware timeline styles");
assert.ok(dailyCareQwen.includes("var(--theme-field-bg)"));
assert.ok(assistPanel.includes('className="qwen-assist-panel"'));
assert.ok(!assistPanel.includes('background: "#ffffff", color: "#172b35"'));

assert.ok(themeOverrides.includes(".companion-handoff-sharing"));
assert.ok(themeOverrides.includes(".appointment-brief-grid"));
assert.ok(themeOverrides.includes(".history-search-wrap"));
assert.ok(themeOverrides.includes(".continuity-prompt-form"));
assert.ok(themeOverrides.includes("[data-solenos-error-surface]"));

const settingsPage = fs.readFileSync(path.join(root, "src/app/workspace/settings/page.tsx"), "utf8");
assert.match(notifications, /router\.replace\("\/workspace\/settings#settings-notifications"\)/,
  "notification access must remain consolidated inside Settings");
assert.match(settingsPage, /getJSON\("\/notifications\?limit=100&offset=0"\)/,
  "care updates must load from the authenticated notification feed");
assert.match(settingsPage, /patchJSON\("\/notifications\//,
  "caregiver acknowledgment must be persisted through the backend");
assert.match(settingsPage, /No notifications yet\. When a saved care reminder is due, it will appear here\./,
  "the empty inbox must explain when saved reminders will appear");
assert.match(settingsPage, /window\.setInterval\(refreshWhenVisible, 30_000\)/,
  "the notification inbox must refresh periodically while visible");
assert.match(settingsPage, /document\.visibilityState === "visible"/,
  "background tabs must not poll for notifications");
assert.match(settingsPage, /Quiet-hours times aren't available from the server right now/,
  "missing quiet-hours capability must not be described as a future deployment");
assert.match(settingsPage, /No notifications yet/,
  "the inbox must explain a genuine empty state");
assert.match(settingsPage, /Replaced by newer information/,
  "superseded notifications must be distinguished from active attention");
assert.match(settingsPage, /No longer needs attention/,
  "resolved notifications must not continue to appear as active requests");
assert.match(settingsPage, /item\.resolved_at/,
  "the inbox must show when an update stopped requiring attention");
assert.match(settingsPage, /\(item.status \?\? "active"\) === "active"/,
  "the caregiver inbox must distinguish active notifications from resolved ones");

assert.ok(dailyCarePage.includes("<NaturalLanguageDailyUpdate />"), "free-text updates must use the existing Daily Care capture path");
assert.match(dailyCarePage, /item\.original_text\.trim\(\)/, "Daily Care must display the original caregiver report without assistant-output filtering");
assert.match(dailyCarePage, /item\.corrected_text\.trim\(\)/, "Daily Care must preserve the exact corrected caregiver wording");
assert.match(dailyCarePage, /quick\.note\.trim\(\)/, "Daily Care must preserve original quick-check-in notes");
assert.doesNotMatch(dailyCarePage, /caregiverSafeAssistantText\(item\.(original_text|corrected_text|reason)\)/, "caregiver-authored source text must not be filtered as assistant output");
assert.ok(dailyCarePage.includes("Review suggested details"), "returning caregivers must be able to reopen pending Daily Care suggestions");
assert.ok(dailyCarePage.includes("<CaptureAnalysisReview"), "Daily Care history must render the persisted review flow");
assert.ok(dailyCarePage.includes("any suggested details that still need your review"), "Daily Care must direct caregivers to earlier pending reviews in care history");
assert.ok(captureReview.includes('getJSON(`/capture/analyses/${encodeURIComponent(analysisId)}`)'), "review UI must load the caregiver-scoped persisted extraction");
assert.ok(captureReview.includes('postJSON(`/capture/analyses/${encodeURIComponent(analysisId)}/review`, {'), "review decisions must use the persisted source-bound review endpoint");
assert.match(captureReview, /const persisted = await getJSON\([\s\S]*?capture\/analyses/,
  "a review must be independently retrieved after the write before the UI reports success");
assert.match(captureReview, /persistedCandidate\.review_status !== expectedReviewStatus/,
  "the retrieved candidate status must match the caregiver's decision");
assert.match(captureReview, /couldn’t confirm whether this review was saved/,
  "a lost response must not be misreported as a failed save");
assert.ok(captureReview.includes("Accept and add to care record"), "caregiver approval must be explicit before an extracted detail enters the LCR");
assert.ok(dailyCapture.includes("qwen_job_id"), "structured Daily Care must retain the durable background job ID");
assert.ok(dailyCapture.includes('getJSON(`/assistant/jobs/${encodeURIComponent(jobId)}`)'), "structured Daily Care must poll the durable extraction job after confirming the save");
assert.ok(dailyCapture.includes("/capture/analyses/"), "structured Daily Care must load persisted review candidates after background extraction");
assert.ok(dailyCapture.includes("Your update is saved. SolenOS is checking it against earlier care information."), "the UI must distinguish a saved record from unfinished downstream reconciliation");
assert.ok(dailyCapture.includes("jobId: typeof data?.qwen_job_id === 'string' ? data.qwen_job_id : null"), "the saved receipt must retain the durable worker job ID");
assert.ok(naturalDailyUpdate.includes('sendQueuedCareWrite("/daily-care/entries"'), "natural-language updates must use the existing persisted Daily Care endpoint");
assert.ok(naturalDailyUpdate.includes("notes: report"), "the exact caregiver wording must be submitted as the source report");
assert.ok(naturalDailyUpdate.includes("response.success !== true"), "the UI must require a backend save receipt before showing success");
assert.ok(naturalDailyUpdate.includes("No extracted details have been treated as confirmed or added to your Care Record."), "failed extraction must be exposed without implying interpretation succeeded");
assert.ok(naturalDailyUpdate.includes("Your report suggests a medication may have changed"), "possible medication changes must be surfaced as unconfirmed");
assert.ok(naturalDailyUpdate.includes("execution_status?.assessment"), "the caregiver must be told when extraction assessment fails after the source is saved");
assert.ok(naturalDailyUpdate.includes("qwen_job_id?: string | null"), "Daily Care must retain the durable extraction job ID returned by the backend");
assert.ok(naturalDailyUpdate.includes('getJSON(`/assistant/jobs/${jobId}`)'), "the caregiver UI must read the existing background job status instead of waiting for inference in the save request");
assert.ok(naturalDailyUpdate.includes("processingStatus: status.status === \"processing\" ? \"processing\" : \"queued\""), "queued and processing states must remain visible without being shown as failures");
assert.ok(naturalDailyUpdate.includes("SolenOS is organizing the details in the background"), "the caregiver must be told that the original report is saved while extraction continues");
assert.ok(naturalDailyUpdate.includes("Your original report is still saved"), "an extraction failure must not imply that the original report was lost");
assert.ok(dailyCarePage.includes("capture_processing?.message"), "background extraction failures must remain visible when a caregiver returns to Daily Care history");
assert.ok(dailyCarePage.includes('getJSON(`/assistant/jobs/${jobId}`)'), "Daily Care history must refresh when a background extraction job finishes after the capture panel closes");
assert.ok(dailyCarePage.includes("Care today"), "Daily Care must present one chronological view of the current day");
assert.ok(dailyCarePage.includes("dailyTimePeriod(item)"), "daily updates must be grouped by their recorded time of day");
assert.ok(dailyCarePage.includes("Needs confirmation"), "unconfirmed medication changes must remain visible when the caregiver returns");
assert.ok(dailyCarePage.includes("No daily entry is required"), "an empty day must not be framed as an overdue entry");
assert.ok(dailyCarePage.includes('getJSON("/open-loops?limit=100&offset=0")'), "Daily Care must retrieve existing follow-ups from the existing Open Loops service");
assert.ok(dailyCarePage.includes("Open Follow-ups"), "Daily Care must route unresolved matters to the dedicated Follow-ups screen");
assert.ok(!dailyCarePage.includes("followUps.slice(0, 6)"), "Daily Care must not duplicate the Follow-ups management list");
assert.ok(dailyCarePage.includes("followUpsError"), "follow-up retrieval failures must remain visible rather than appearing as an empty list");
assert.ok(naturalDailyUpdate.includes('getJSON("/care-continuity/medications")'), "uncertain medication reports must check the existing reviewed medication record");
assert.ok(naturalDailyUpdate.includes("existing reviewed medication record lists"), "the caregiver must be shown what the existing reviewed record says without treating it as a new dose");
assert.ok(naturalDailyUpdate.includes('getJSON("/documents/intelligence")'), "uncertain medication reports must search existing saved-document extractions");
assert.match(naturalDailyUpdate, /(?:This extraction is not confirmation of a new dose|These words do not confirm a new dose)/, "document extraction must not be presented as a confirmed medication change");
assert.match(lcrCurrent, /const medicationConflicts = watchUncertainties\.filter/);
assert.match(lcrCurrent, /Medication instruction needs confirmation/);
assert.match(lcrCurrent, /prescribing clinician or pharmacist promptly to confirm it/);
assert.match(lcrCurrent, /SolenOS has not changed the medication record/);
assert.match(lcrCurrent, /saved\.source_freshness\?\.reassessment_recommended/);
assert.match(lcrCurrent, /if \(current\.assessment\?\.person_id === scopedPersonId\)/);
assert.match(lcrCurrent, /postJSON\([\s\S]*?care-continuity\/situation-understanding\/reassess/);
assert.match(lcrCurrent, /The latest care summary could not be refreshed\. The last saved view is shown and may be out of date\./);
assert.ok(dailyCarePage.includes('getJSON("/notifications?limit=100&offset=0")'), "Daily Care must check the existing notification feed for delivery failures");
assert.ok(dailyCarePage.includes("A notification could not be sent"), "failed push delivery must remain visible in plain language in Daily Care");
assert.ok(dailyCarePage.includes('["failed", "expired"]'), "failed or expired push delivery must never be presented as successful delivery");
assert.ok(dailyCarePage.includes("historyError ?"), "failed history retrieval must not be presented as an empty day");
assert.ok(dailyCarePage.includes("daily summary is unavailable"), "history processing failures must be visible to the caregiver");
console.log("Caregiver UI contract checks passed.");
