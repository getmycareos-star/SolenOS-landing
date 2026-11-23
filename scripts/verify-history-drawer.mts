import assert from "node:assert/strict";
import { caregiverReadableCaptureText } from "../src/lib/caregiver-language.ts";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const drawer = fs.readFileSync(path.join(root, "src/components/app-shell/HistoryDrawer.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/mobile-app.css"), "utf8");
const apiClient = fs.readFileSync(path.join(root, "src/api/client.ts"), "utf8");
const followUpsPage = fs.readFileSync(path.join(root, "src/app/workspace/open-loops/page.tsx"), "utf8");
const navigation = fs.readFileSync(path.join(root, "src/lib/workspace-navigation.ts"), "utf8");
const morePage = fs.readFileSync(path.join(root, "src/app/workspace/more/page.tsx"), "utf8");
const evidenceReview = fs.readFileSync(path.join(root, "src/components/EvidenceReviewPanel.tsx"), "utf8");
const caregiverLanguage = fs.readFileSync(path.join(root, "src/lib/caregiver-language.ts"), "utf8");
const darkStyles = fs.readFileSync(path.join(root, "src/app/dark-mode-remediation.css"), "utf8");
const accessibilityOverrides = fs.readFileSync(path.join(root, "src/app/accessibility-overrides.css"), "utf8");
const evidenceCompletenessRoute = path.join(root, "src/app/workspace/evidence-completeness/page.tsx");
assert.equal(fs.existsSync(evidenceCompletenessRoute), false, "internal evidence policy configuration must not be routable in the caregiver workspace");
assert.doesNotMatch(evidenceReview, /workspace\/evidence-completeness|Review source completeness/, "caregiver evidence review must not link to internal policy configuration");
assert.doesNotMatch(evidenceReview, /from ["']next\/link["']/, "the removed administrative route must not leave an unused navigation dependency");
assert.match(drawer, /item\.person_id === session\.person\.id/, "history events must be restricted to the authenticated care-record person");

assert.match(drawer, /ensureAnonymousSession/);
assert.match(drawer, /getJSON\("\/events\/"/);
assert.match(drawer, /getJSON\("\/care-continuity\/context\?limit_per_source=50&include_all_history=true"\)/);
assert.match(drawer, /let projectionResult: PromiseSettledResult<unknown>/,
  "the full-history fallback has an explicit success/failure state");
assert.match(drawer, /if \(eventReadProblem \|\| eventItems\?\.length === 0\)/,
  "the full-history scan runs only when the dedicated event-history read is incomplete");
assert.match(drawer, /sources\?\.events/,
  "fallback recovery reads the persisted events source from the LCR context");
assert.match(drawer, /source_offsets_json=/,
  "fallback recovery follows per-source offsets instead of stopping at the first page");
assert.match(drawer, /fallbackPagesFetched < 4/,
  "fallback history pagination has an explicit bounded page limit");
assert.match(drawer, /existingEventIds/,
  "the fallback does not duplicate event IDs already returned by the event-history endpoint");
assert.match(drawer, /typeof item\.event_type === "string"/,
  "fallback records preserve the original care-event type");
assert.match(drawer, /candidate_scan_complete === true/,
  "a zero count is trusted only when the LCR confirms a complete event-source scan");
assert.match(drawer, /"available", "empty", "complete"/,
  "the backend's explicit empty status is recognized as a verified empty source");
assert.match(drawer, /A zero count is not confirmation that the care record is empty/,
  "an unavailable event source is not silently represented as an empty history");
assert.match(drawer, /getJSON\("\/evidence\/"/);
assert.match(drawer, /getJSON\("\/appointment-workspaces"/);
assert.match(drawer, /getJSON\("\/handoffs\/inbox"/);
assert.match(drawer, /getJSON\("\/handoffs\/outbox"/);
assert.match(drawer, /getJSON\("\/care-continuity\/revisions\/" \+ personPath\)/);
assert.match(drawer, /mapLcrRevision/);
assert.match(drawer, /const freshRecords = nextRecords\.filter\(\(record\) => record\.source_kind !== "lcr-revision"\)/, "internal LCR revisions must not appear as caregiver care-history events");
assert.match(drawer, /for \(const record of \[\.\.\.retainedRecords, \.\.\.freshRecords\]\)/, "only caregiver-facing history records are merged into the timeline");
assert.match(drawer, /setRecords\(caregiverRecords\)/, "the caregiver-facing history merge is committed to the timeline");
assert.doesNotMatch(drawer, /Living Care Record revision history could not be loaded/, "internal audit-source failures must not be shown as missing caregiver care history");
assert.match(drawer, /must not make an otherwise failed history\s+load look successful/, "internal audit reads must not count as an available caregiver-history source");
assert.match(drawer, /shouldShowLcrRevision/);
assert.match(drawer, /REVISION_TYPES_ALREADY_SHOWN_BY_SOURCE/);
assert.match(drawer, /mapDecision/);
assert.match(drawer, /mapOutcome/);
const structuredCapture = caregiverReadableCaptureText(JSON.stringify({
  original_capture: {
    notes: "she's loosing weight",
    scales: [{ axis: "mood", score: 5, note: "she's sad" }],
    vitals: [{ vital_type: "bp_systolic", value: 10, unit: "mmHg", note: "yes" }],
    medications: [],
    capture_idempotency_key: "internal-key",
    capture_request_fingerprint: "internal-fingerprint",
  },
}));
assert.ok(structuredCapture);
assert.match(structuredCapture, /she's loosing weight/);
assert.match(structuredCapture, /Mood: 5 — she's sad/);
assert.match(structuredCapture, /Blood pressure \(top number\): 10 mmHg — yes/);
assert.ok(structuredCapture.indexOf("she's loosing weight") < structuredCapture.indexOf("Mood: 5 — she's sad"));
assert.ok(structuredCapture.indexOf("Mood: 5 — she's sad") < structuredCapture.indexOf("Blood pressure (top number): 10 mmHg — yes"));
assert.match(structuredCapture, /not been independently checked/);
assert.doesNotMatch(structuredCapture, /capture_idempotency_key|capture_request_fingerprint|internal-key|internal-fingerprint/);
assert.match(drawer, /caregiverFieldLabel/, "history details use shared caregiver-readable field labels");
assert.match(drawer, /caregiverSafeAssistantText/, "history details sanitize caregiver-provided source text before display");
assert.match(evidenceReview, /caregiverReadableCaptureText\(selected\.source_text\)/, "evidence review must not print serialized capture JSON to caregivers");
assert.match(evidenceReview, /caregiverSourceText\(item\.source_passage\)/, "original source passages must retain their exact wording rather than be rewritten as generated text");
assert.match(evidenceReview, /item\.observation_method !== 'Daily Care form'/, "structured source values are not redundantly repeated below their readable source passage");
assert.match(evidenceReview, /<summary>Details recorded from this information \(\{observations\.length\}\)<\/summary>/, "source details use caregiver-facing language and remain grouped under a clear disclosure");
assert.match(evidenceReview, /caregiver_form: 'Entered in Daily Care'/, "caregiver form metadata is translated into natural language");
assert.match(evidenceReview, /note: 'Care update'/, "internal evidence type values are not exposed");
assert.match(caregiverLanguage, /capture\.axis === "string" && capture\.score !== undefined/, "a single rating source passage is readable");
assert.match(caregiverLanguage, /capture\.vital_type === "string" && capture\.value !== undefined/, "a single measurement source passage is readable");
assert.match(evidenceReview, /<summary>More details about this note or document<\/summary>/, "detailed source metadata is progressively disclosed");
assert.doesNotMatch(evidenceReview, /How this information was added<\/dt>/, "duplicate collection-method labels are removed");
assert.match(evidenceReview, /structured_daily_capture: 'Daily care update'/, "internal capture types receive caregiver-friendly labels");
assert.match(caregiverLanguage, /capture\.vitals/, "saved measurements are rendered from the original capture");
assert.match(caregiverLanguage, /capture\.scales/, "saved ratings are rendered from the original capture");
assert.match(caregiverLanguage, /capture\.medications/, "saved medicine details are rendered from the original capture");
assert.match(caregiverLanguage, /Measurements and ratings are shown as entered/, "structured values retain an accuracy limitation");
assert.match(caregiverLanguage, /return lines\.join\("\\n"\)/, "structured capture details use readable line breaks");
assert.match(drawer, /getJSON\(`\/open-loops\?limit=\$\{pageSize\}&offset=\$\{page \* pageSize\}`\)/, "saved follow-ups must be retrieved from the authenticated follow-up service using bounded, complete pagination");
assert.match(drawer, /mapFollowUp/, "persisted follow-ups must be represented in care history using their saved fields");
assert.match(drawer, /const followUpResult = results\[8\]/, "follow-up retrieval must have an independent result state");
assert.match(drawer, /followUpPayload\.count > followUps\.length/, "bounded follow-up retrieval must be disclosed using the backend total");
assert.match(drawer, /source_kind: "follow-up"/, "history details must retain the saved follow-up source type");
assert.match(drawer, /selectedRecord\.source_kind === "follow-up"/, "follow-up details must identify their actual source");
assert.match(followUpsPage, /item\.evidence_status/, "follow-up cards must show the evidence status separately from care priority");
assert.match(followUpsPage, /item\.history_completeness/, "follow-up cards must disclose incomplete earlier history");
assert.match(followUpsPage, /item\.action_status === "not_recorded"/, "follow-up cards must distinguish an unrecorded action from a completed one");
assert.match(followUpsPage, /item\.source === "persisted_change"/, "persisted change candidates must be eligible for an explicit, durable follow-up action");
assert.match(followUpsPage, /source_type: item\.source/, "new follow-ups must retain the actual originating source type");
assert.match(drawer, /Previous saved details/);
assert.match(drawer, /Updated saved details/);
assert.match(drawer, /Promise\.allSettled/);
assert.match(drawer, /sourceWarnings/);
assert.match(drawer, /occurred_at/);
assert.match(drawer, /recorded_at/);
assert.match(drawer, /evidence_ids/);
assert.match(drawer, /time_provenance/);
assert.match(drawer, /Search care history/);
assert.match(drawer, /<aside/);
assert.match(drawer, /aria-label="Care history"/);
assert.doesNotMatch(drawer, /related item\(s\)/, "care history must not expose placeholder pluralization");
assert.match(drawer, /selectedRecord\.evidence_ids\.length === 1 \? "note or document" : "notes or documents"/, "linked evidence count must use readable singular and plural labels");
assert.match(drawer, /className=\{`history-drawer/);
assert.doesNotMatch(drawer, /history-action-menu|history-event-menu-trigger|Share care summary|Add to Home|Edit record|View record details|Download \/ Export|Pin to Home|Archive record|Restore record|Delete record|history-detail-actions|copyRecord|downloadRecord|shareRecord/, "History is browse-only and exposes none of the main-screen care actions");
assert.match(drawer, /error && records.length === 0 \? \(/, "an unavailable history must render an error, not an empty state");
assert.match(drawer, /sourceWarnings.length > 0 \? \(/, "incomplete source coverage must remain distinct from a genuinely empty history");
assert.match(drawer, /<RecordState kind="first-empty" title="No saved care history yet"/, "a genuinely empty history must use the current concise empty-state copy");
assert.doesNotMatch(shell, /<HistoryDrawer \/>/, "care history must not crowd the primary navigation");
assert.match(morePage, /<HistoryDrawer \/>/, "recent care history remains available under More");
assert.match(morePage, /Recent care history/, "the history section uses plain caregiver language");
assert.match(drawer, /function historyLoadStatusLabel\(status: HistoryLoadStatus\)/,
  "saved-history availability uses caregiver-readable labels");
for (const status of ["Up to date", "Some entries may be missing", "Could not load", "No entries yet", "May be out of date"]) {
  assert.ok(drawer.includes(status), "history status is explained in plain language: " + status);
}
assert.doesNotMatch(drawer, /sourceStatuses\[category\]\[0\]\.toUpperCase\(\)/,
  "internal history status values are not printed directly");
assert.match(shell, /solenos-chat-sidebar/);
assert.doesNotMatch(shell, /Search history/, "history search is not a primary navigation destination");
for (const [route, label] of [
  ["/workspace", "Today"],
  ["/workspace/daily-care", "Share an update"],
  ["/workspace/appointments", "Appointments"],
  ["/workspace/open-loops", "Follow-ups"],
  ["/workspace/more", "More"],
]) {
  assert.match(navigation, new RegExp('href: "' + route.replaceAll("/", "\\/") + '"[\\s\\S]*?label: "' + label + '"'),
    label + " remains a primary caregiver destination");
}
for (const [route, label] of [
  ["/workspace/companion", "Care Assistant"],
  ["/workspace/timeline", "Care history"],
  ["/workspace/documents", "Documents"],
  ["/workspace/handoffs", "Share care information"],
]) {
  assert.match(navigation, new RegExp('href: "' + route.replaceAll("/", "\\/") + '"[\\s\\S]*?label: "' + label + '"'),
    label + " remains available under More");
}
assert.match(navigation, /WORKSPACE_SECONDARY_NAVIGATION/);
assert.doesNotMatch(shell, /Community/);
assert.match(morePage, /from "@\/components\/app-shell\/HistoryDrawer"/);
assert.match(shell, /prefetch=\{false\}/, "primary destinations are not downloaded speculatively on first load");
assert.match(shell, /onMouseEnter=\{\(\) => router\.prefetch\(href\)\}/, "navigation prefetch follows explicit pointer intent");
assert.match(shell, /solenos\.workspace\.navigation-click/, "navigation intent timing must begin on caregiver action");
assert.match(shell, /solenos\.workspace\.navigation-to-route-mounted/, "route mount timing must be measured after navigation");
assert.match(shell, /const ShareCareSummaryPanel = dynamic\(/, "the share/export panel must not be part of the initial workspace bundle");
assert.doesNotMatch(shell, /Community/, "the intentionally disabled Community module must remain absent");
assert.match(styles, /\.history-backdrop/);
assert.match(styles, /\.history-drawer/);
assert.match(styles, /\.history-filter-row\s*\{[^}]*flex-wrap:\s*wrap/s,
  "history filters must wrap on narrow screens instead of clipping primary controls");
assert.match(darkStyles, /\.history-drawer-footer\s*\{[^}]*background:\s*var\(--theme-panel-bg\)/s,
  "dark history footer text must sit on a dark surface");
assert.match(darkStyles, /\.history-drawer-footer\s*\{[^}]*color:\s*var\(--theme-panel-muted\)/s,
  "dark history footer must use readable muted text");
assert.doesNotMatch(accessibilityOverrides, /history-drawer-header/,
  "the light-surface accessibility override must not force dark text onto the dark history header");
assert.match(styles, /\.history-source-warning/);
assert.match(styles, /@media \(max-width: 480px\)/);
assert.match(apiClient, /requestAuthorizationHeaders/);

console.log("History drawer contract checks passed: authenticated event, document, appointment, handoff, follow-up, LCR revision, decision and outcome reads; source-specific metadata; chronological ordering; partial-source failures; record detail; responsive browsing-only history.");

assert.match(drawer, /type HistoryLoadStatus = "loading" \| "complete" \| "partial" \| "failed" \| "empty" \| "stale"/,
  "each care-history category must expose the six explicit retrieval states");
assert.match(drawer, /HISTORY_STATUS_CATEGORIES[\s\S]*?"daily-care"[\s\S]*?"document"[\s\S]*?"appointment"[\s\S]*?"handoff"[\s\S]*?"decision"[\s\S]*?"outcome"[\s\S]*?"follow-up"/,
  "Daily Care, documents, appointments, handoffs, decisions, outcomes and follow-ups must each have a retrieval status");
assert.match(drawer, /Care history sources[\s\S]*?sourceStatuses\[category\]/,
  "the caregiver must be able to see the status of every history category");
assert.match(drawer, /previousRecords[\s\S]*?return status === "stale" \|\| status === "partial"/,
  "previously loaded records must remain visible when a source refresh is incomplete");
assert.match(drawer, /category === "handoff" && consentRequiredForHandoffs\) return false/,
  "handoff records must not remain visible after required sharing consent is revoked");

assert.match(drawer, /async function loadAllHistoryPages[\s\S]*?offset=\$\{page \* pageSize\}[\s\S]*?seenIds\.has\(row\.id\)[\s\S]*?rows\.length < pageSize/,
  "decision and outcome history must use stable offset pages and reject duplicate or incomplete records");
assert.match(drawer, /loadAllHistoryPages<CareDecision>\("\/care-continuity\/decisions"\)[\s\S]*?loadAllHistoryPages<CareOutcome>\("\/care-continuity\/outcomes\//,
  "all decision and outcome pages must be retrieved before the history list is considered complete");

assert.match(drawer, /async function loadAllFollowUpHistoryPages[\s\S]*?limit=\$\{pageSize\}&offset=\$\{page \* pageSize\}[\s\S]*?expectedCount[\s\S]*?seenIds\.has\(row\.id\)[\s\S]*?records\.length >= expectedCount/,
  "the history timeline must retrieve every saved follow-up page and reject incomplete pagination");

assert.match(drawer, /response\.count !== expectedCount[\s\S]*?changed while it was loading/,
  "follow-up history must not be marked complete when the collection changes between pages");

assert.match(source, /addEventListener\("personIdChanged", resetAfterSessionChange\)[\s\S]*?loadedPersonIdRef\.current = null[\s\S]*?setHasLoaded\(false\)/, "history must clear or reload when the active person or caregiver changes");
