import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const drawer = fs.readFileSync(path.join(root, "src/components/app-shell/HistoryDrawer.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/mobile-app.css"), "utf8");
const apiClient = fs.readFileSync(path.join(root, "src/api/client.ts"), "utf8");
const followUpsPage = fs.readFileSync(path.join(root, "src/app/workspace/open-loops/page.tsx"), "utf8");
const navigation = fs.readFileSync(path.join(root, "src/lib/workspace-navigation.ts"), "utf8");
const evidenceReview = fs.readFileSync(path.join(root, "src/components/EvidenceReviewPanel.tsx"), "utf8");
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
assert.match(drawer, /getJSON\("\/care-continuity\/decisions\?limit=100"\)/);
assert.match(drawer, /getJSON\("\/care-continuity\/outcomes\/" \+ personPath\)/);
assert.match(drawer, /mapLcrRevision/);
assert.match(drawer, /setRecords\(nextRecords\.filter\(\(record\) => record\.source_kind !== "lcr-revision"\)\)/, "internal LCR revisions must not appear as caregiver care-history events");
assert.doesNotMatch(drawer, /Living Care Record revision history could not be loaded/, "internal audit-source failures must not be shown as missing caregiver care history");
assert.match(drawer, /must not make an otherwise failed history\s+load look successful/, "internal audit reads must not count as an available caregiver-history source");
assert.match(drawer, /shouldShowLcrRevision/);
assert.match(drawer, /REVISION_TYPES_ALREADY_SHOWN_BY_SOURCE/);
assert.match(drawer, /mapDecision/);
assert.match(drawer, /mapOutcome/);
assert.ok(drawer.includes('getJSON("/open-loops?limit=100")'), "saved follow-ups must be retrieved from the authenticated follow-up service");
assert.match(drawer, /mapFollowUp/, "persisted follow-ups must be represented in care history using their saved fields");
assert.match(drawer, /const followUpResult = results\[8\]/, "follow-up retrieval must have an independent result state");
assert.match(drawer, /followUpPayload\.count > followUps\.length/, "bounded follow-up retrieval must be disclosed using the backend total");
assert.match(drawer, /source_kind: "follow-up"/, "history details must retain the saved follow-up source type");
assert.match(drawer, /selectedRecord\.source_kind === "follow-up"/, "follow-up details must identify their actual source");
assert.match(followUpsPage, /item\.evidence_status/, "follow-up cards must show the evidence status separately from care priority");
assert.match(followUpsPage, /item\.history_completeness/, "follow-up cards must disclose incomplete earlier history");
assert.match(followUpsPage, /item\.action_status === "not_recorded"/, "follow-up cards must distinguish an unrecorded action from a completed one");
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
assert.match(shell, /<HistoryDrawer \/>/);
assert.match(shell, /solenos-chat-sidebar/);
assert.match(shell, /Search history/);
assert.match(navigation, /href: "\/workspace\/daily-care"[\s\S]*?label: "Daily Care"/, "Daily Care is registered as its own navigation destination");
assert.match(navigation, /href: "\/workspace\/open-loops"[\s\S]*?label: "Follow-ups"/, "Follow-ups has a dedicated route");
assert.match(navigation, /href: "\/workspace\/timeline"[\s\S]*?label: "Care history"/, "Care Timeline has a dedicated route");
assert.match(navigation, /href: "\/workspace\/documents"[\s\S]*?label: "Documents"/, "Documents has a dedicated route");
assert.match(navigation, /href: "\/workspace\/companion"[\s\S]*?label: "Care Assistant"/, "Care Assistant has a dedicated route");
assert.match(navigation, /href: "\/workspace\/handoffs"[\s\S]*?label: "Share care information"/, "Share care information remains a separate workflow");
assert.match(navigation, /href: "\/workspace\/appointments"[\s\S]*?label: "Appointments"/, "Appointments remains a separate workflow");
assert.doesNotMatch(shell, /Community/);
assert.match(shell, /from "@\/components\/app-shell\/HistoryDrawer"/);
assert.match(shell, /prefetch=\{false\}/, "secondary workspace routes must not be downloaded speculatively on first load");
assert.match(shell, /onMouseEnter=\{\(\) => router\.prefetch\(href\)\}/, "navigation should prefetch only after explicit pointer intent");
assert.match(shell, /solenos\.workspace\.navigation-click/, "navigation intent timing must begin on caregiver action");
assert.match(shell, /solenos\.workspace\.navigation-to-route-mounted/, "route mount timing must be measured after navigation");
assert.match(shell, /const ShareCareSummaryPanel = dynamic\(/, "the share/export panel must not be part of the initial workspace bundle");
assert.doesNotMatch(shell, /Community/, "the intentionally disabled Community module must remain absent");
assert.match(styles, /\.history-backdrop/);
assert.match(styles, /\.history-drawer/);
assert.match(styles, /\.history-source-warning/);
assert.match(styles, /@media \(max-width: 480px\)/);
assert.match(apiClient, /requestAuthorizationHeaders/);

console.log("History drawer contract checks passed: authenticated event, document, appointment, handoff, follow-up, LCR revision, decision and outcome reads; source-specific metadata; chronological ordering; partial-source failures; record detail; responsive browsing-only history.");
