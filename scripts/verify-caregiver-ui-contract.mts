import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sanitizeCaregiverErrorMessage } from "../src/lib/mvp-input-architecture/first-input";

const root = process.cwd();
const companion = fs.readFileSync(path.join(root, "src/components/workflows/AICompanion.tsx"), "utf8");
const orientation = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const deltaPanel = fs.readFileSync(path.join(root, "src/components/CareDeltaPanel.tsx"), "utf8");
const dailyCapture = fs.readFileSync(path.join(root, "src/components/workflows/StructuredDailyCapture.tsx"), "utf8");
const landingStyles = fs.readFileSync(path.join(root, "src/app/landing.css"), "utf8");
const notifications = fs.readFileSync(path.join(root, "src/app/workspace/notifications/page.tsx"), "utf8");
const assistPanel = fs.readFileSync(path.join(root, "src/components/qwen/QwenAssistPanel.tsx"), "utf8");
const qwenPanel = fs.readFileSync(path.join(root, "src/components/qwen/QwenAssistPanel.tsx"), "utf8");
const workspaceComposer = fs.readFileSync(path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"), "utf8");

// Errors must be event-driven, dismissible through correction/reset, and not stale.
assert.match(companion, /\{requestError && <div className="companion-error" role="alert"/);
assert.match(companion, /setRequestError\(null\)/);
assert.match(companion, /const startNewSession = \(\) => \{[\s\S]*?setRequestError\(null\)/);
assert.match(companion, /onChange=\{event => handleInput\(event\.target\.value\)\}/);
assert.match(workspaceComposer, /setRawInput\(value\);\s*setLcrOrientationReply\(null\);\s*setCaregiverError\(null\)/);
assert.match(workspaceComposer, /setDocuments\(nextDocuments\);\s*setLcrOrientationReply\(null\);\s*setCaregiverError\(null\)/);
assert.match(sanitizeCaregiverErrorMessage("Situation hydration failed (404)"), /We couldn’t complete that step/);
assert.match(sanitizeCaregiverErrorMessage("Failed to fetch /api/situation"), /We couldn’t complete that step/);

// Internal evaluation metadata must never be rendered into the caregiver conversation.
assert.doesNotMatch(companion, /Safety: \{msg\.safety_note\}/);
assert.doesNotMatch(companion, /Guard: \{msg\.guard_verdict\}/);
assert.doesNotMatch(companion, /Confidence: \{Math\.round/);
assert.doesNotMatch(companion, /Evidence: \{msg\.evidence_ids/);
assert.doesNotMatch(companion, /Replies may be unavailable sometimes/);
assert.doesNotMatch(companion, /The safety engine flagged this exchange/);
assert.match(companion, /A few words are enough/);
assert.match(companion, /You don’t have to figure it all out right now/);
assert.match(companion, /postJSON\('\/conversation\/message'/);
assert.doesNotMatch(companion, /refreshPendingCareUpdates|pendingCareUpdates/);
assert.doesNotMatch(companion, /reviewCareUpdate|care_update_candidates|\/companion\/care-updates/);
assert.match(deltaPanel, /if \(!showPanel\) return null/);
assert.match(deltaPanel, /if \(!personId \|\| !showPanel\)/);

// The saved-care orientation must use the same authenticated, read-only
// current-care projection as the main Care Continuity view.
assert.match(orientation, /Your Living Care Record does not have any care information available yet/);
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
assert.match(dailyCapture, /showPanel=\{false\}/);
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
assert.doesNotMatch(qwenPanel, /Context used:/);


const themeOverrides = fs.readFileSync(path.join(root, "src/app/accessibility-overrides.css"), "utf8");
const dailyCarePage = fs.readFileSync(path.join(root, "src/app/workspace/daily-care/page.tsx"), "utf8");
const lcrCurrent = fs.readFileSync(path.join(root, "src/components/mvp-workspace/LCRCurrentUnderstanding.tsx"), "utf8");
const appLayout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
assert.ok(appLayout.includes('import "./accessibility-overrides.css";'));
const quickCheckIn = fs.readFileSync(path.join(root, "src/components/workflows/QuickDailyCheckIn.tsx"), "utf8");
const naturalDailyUpdate = fs.readFileSync(path.join(root, "src/components/workflows/NaturalLanguageDailyUpdate.tsx"), "utf8");
const appointmentsPage = fs.readFileSync(path.join(root, "src/app/workspace/appointments/page.tsx"), "utf8");
const appointmentWorkflow = fs.readFileSync(path.join(root, "src/components/workflows/AppointmentWorkspace.tsx"), "utf8");
assert.ok(appointmentWorkflow.includes("var(--theme-panel-bg)") && appointmentWorkflow.includes("var(--theme-field-bg)"));
assert.ok(dailyCapture.includes("var(--theme-success-bg)") && dailyCapture.includes("var(--theme-warning-bg)"));
assert.doesNotMatch(appointmentWorkflow, /background:#fff|color:#26392c|color:#536653/);
const timelinePage = fs.readFileSync(path.join(root, "src/app/workspace/timeline/page.tsx"), "utf8");
const dailyCareQwen = fs.readFileSync(path.join(root, "src/components/workflows/DailyCareQwen.tsx"), "utf8");

// Dark-mode contrast is a supported product contract, not a screenshot-only check.
assert.ok(themeOverrides.includes(':root[data-solenos-theme="dark"]') && themeOverrides.includes("--theme-panel-bg: #202a24"));
assert.ok(themeOverrides.includes("--theme-field-bg: #18211c"));
assert.ok(themeOverrides.includes("--theme-warning-fg: #fff0cf"));
assert.ok(themeOverrides.includes("--theme-action-disabled-fg: #e6eee7") && themeOverrides.includes("button:disabled"));
assert.ok(dailyCarePage.includes("var(--theme-panel-bg)"));
assert.ok(dailyCarePage.includes("var(--theme-field-fg)"));
assert.ok(quickCheckIn.includes("var(--theme-selected-bg)") && quickCheckIn.includes('className="quick-daily-checkin"'));
assert.ok(appointmentsPage.includes("var(--theme-panel-fg)") && appointmentsPage.includes("var(--theme-panel-muted)"));
assert.ok(timelinePage.includes("timeline-workspace"));
assert.ok(timelinePage.includes("var(--theme-selected-bg)"));
assert.ok(dailyCareQwen.includes("var(--theme-field-bg)"));
assert.ok(assistPanel.includes('className="qwen-assist-panel"'));
assert.ok(!assistPanel.includes('background: "#ffffff", color: "#172b35"'));

assert.ok(themeOverrides.includes(".companion-handoff-sharing"));
assert.ok(themeOverrides.includes(".appointment-brief-grid"));
assert.ok(themeOverrides.includes(".history-search-wrap"));
assert.ok(themeOverrides.includes(".continuity-prompt-form"));
assert.ok(themeOverrides.includes("[data-solenos-error-surface]"));

const settingsPage = fs.readFileSync(path.join(root, "src/app/workspace/settings/page.tsx"), "utf8");
assert.match(notifications, /redirect\("\/workspace\/settings#settings-notifications"\)/,
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
assert.ok(naturalDailyUpdate.includes('postJSON("/daily-care/entries"'), "natural-language updates must use the existing persisted Daily Care endpoint");
assert.ok(naturalDailyUpdate.includes("notes: report"), "the exact caregiver wording must be submitted as the source report");
assert.ok(naturalDailyUpdate.includes("response?.success !== true"), "the UI must require a backend save receipt before showing success");
assert.ok(naturalDailyUpdate.includes("no extracted details have been treated as confirmed"), "failed extraction must be exposed without implying interpretation succeeded");
assert.ok(naturalDailyUpdate.includes("Your report suggests a medication may have changed"), "possible medication changes must be surfaced as unconfirmed");
assert.ok(naturalDailyUpdate.includes("execution_status?.assessment"), "the caregiver must be told when extraction assessment fails after the source is saved");
assert.ok(naturalDailyUpdate.includes("qwen_job_id?: string | null"), "Daily Care must retain the durable extraction job ID returned by the backend");
assert.ok(naturalDailyUpdate.includes('getJSON(`/assistant/jobs/${jobId}`)'), "the caregiver UI must read the existing background job status instead of waiting for inference in the save request");
assert.ok(naturalDailyUpdate.includes("processingStatus: status.status === \"processing\" ? \"processing\" : \"queued\""), "queued and processing states must remain visible without being shown as failures");
assert.ok(naturalDailyUpdate.includes("SolenOS is organizing the details in the background"), "the caregiver must be told that the original report is saved while extraction continues");
assert.ok(naturalDailyUpdate.includes("Your original report is still saved"), "an extraction failure must not imply that the original report was lost");
assert.ok(dailyCarePage.includes("capture_processing?.message"), "background extraction failures must remain visible when a caregiver returns to Daily Care history");
assert.ok(dailyCarePage.includes("Care today"), "Daily Care must present one chronological view of the current day");
assert.ok(dailyCarePage.includes("dailyTimePeriod(item)"), "daily updates must be grouped by their recorded time of day");
assert.ok(dailyCarePage.includes("Needs confirmation"), "unconfirmed medication changes must remain visible when the caregiver returns");
assert.ok(dailyCarePage.includes("No daily entry is required"), "an empty day must not be framed as an overdue entry");
assert.ok(dailyCarePage.includes('getJSON("/open-loops?limit=100&offset=0")'), "Daily Care must retrieve existing follow-ups from the existing Open Loops service");
assert.ok(dailyCarePage.includes("Daily Care does not create a second copy"), "Daily Care must reuse existing follow-ups instead of duplicating them");
assert.ok(dailyCarePage.includes("followUpsError"), "follow-up retrieval failures must remain visible rather than appearing as an empty list");
assert.ok(naturalDailyUpdate.includes('getJSON("/care-continuity/medications")'), "uncertain medication reports must check the existing reviewed medication record");
assert.ok(naturalDailyUpdate.includes("existing reviewed medication record lists"), "the caregiver must be shown what the existing reviewed record says without treating it as a new dose");
assert.ok(naturalDailyUpdate.includes('getJSON("/documents/intelligence")'), "uncertain medication reports must search existing saved-document extractions");
assert.ok(naturalDailyUpdate.includes("This extraction is not confirmation of a new dose"), "document extraction must not be presented as a confirmed medication change");
assert.match(lcrCurrent, /const medicationConflicts = watchUncertainties\.filter/);
assert.match(lcrCurrent, /Medication instruction needs confirmation/);
assert.match(lcrCurrent, /prescribing clinician or pharmacist promptly to confirm it/);
assert.match(lcrCurrent, /SolenOS has not changed the medication record/);
assert.match(lcrCurrent, /saved\.source_freshness\?\.reassessment_recommended/);
assert.match(lcrCurrent, /if \(current\.assessment\?\.person_id === scopedPersonId\)/);
assert.match(lcrCurrent, /postJSON\([\s\S]*?care-continuity\/situation-understanding\/reassess/);
assert.match(lcrCurrent, /The latest care summary could not be refreshed\. The last saved view is shown and may be out of date\./);
assert.ok(dailyCarePage.includes('getJSON("/notifications?limit=100&offset=0")'), "Daily Care must check the existing notification feed for delivery failures");
assert.ok(dailyCarePage.includes("Notification delivery needs attention"), "failed notification delivery must remain visible in Daily Care");
assert.ok(dailyCarePage.includes('["failed", "expired"]'), "failed or expired push delivery must never be presented as successful delivery");
assert.ok(dailyCarePage.includes("historyError ?"), "failed history retrieval must not be presented as an empty day");
assert.ok(dailyCarePage.includes("daily summary is unavailable"), "history processing failures must be visible to the caregiver");
console.log("Caregiver UI contract checks passed.");
