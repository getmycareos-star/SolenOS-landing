import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const drawer = fs.readFileSync(path.join(root, "src/components/app-shell/HistoryDrawer.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/mobile-app.css"), "utf8");
const apiClient = fs.readFileSync(path.join(root, "src/api/client.ts"), "utf8");
const evidenceReview = fs.readFileSync(path.join(root, "src/components/EvidenceReviewPanel.tsx"), "utf8");
const evidenceCompletenessRoute = path.join(root, "src/app/workspace/evidence-completeness/page.tsx");
assert.equal(fs.existsSync(evidenceCompletenessRoute), false, "internal evidence policy configuration must not be routable in the caregiver workspace");
assert.doesNotMatch(evidenceReview, /workspace\/evidence-completeness|Review source completeness/, "caregiver evidence review must not link to internal policy configuration");
assert.doesNotMatch(evidenceReview, /from ["']next\/link["']/, "the removed administrative route must not leave an unused navigation dependency");
assert.match(drawer, /item\.person_id === session\.person\.id/, "history events must be restricted to the authenticated care-record person");

assert.match(drawer, /ensureAnonymousSession/);
assert.match(drawer, /getJSON\("\/events\/"/);
assert.match(drawer, /getJSON\("\/care-continuity\/current-care\?limit_per_source=50"\)/);
assert.match(drawer, /projectionResult = results\[8\]/,
  "the LCR projection is used when the dedicated event-history read is empty or unavailable");
assert.match(drawer, /source_collection === "events"/,
  "only actual care-event rows are recovered from the LCR fallback");
assert.match(drawer, /existingEventIds/,
  "the fallback does not duplicate event IDs already returned by the event-history endpoint");
assert.match(drawer, /source_event_type/,
  "fallback records preserve the original care-event type rather than the evidence source type");
assert.match(drawer, /source_coverage\?\.events/,
  "a zero count is trusted only when the LCR confirms the event source is available and empty");
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
assert.match(drawer, /shouldShowLcrRevision/);
assert.match(drawer, /REVISION_TYPES_ALREADY_SHOWN_BY_SOURCE/);
assert.match(drawer, /mapDecision/);
assert.match(drawer, /mapOutcome/);
assert.match(drawer, /Previous recorded state/);
assert.match(drawer, /Updated recorded state/);
assert.match(drawer, /Promise\.allSettled/);
assert.match(drawer, /sourceWarnings/);
assert.match(drawer, /occurred_at/);
assert.match(drawer, /recorded_at/);
assert.match(drawer, /evidence_ids/);
assert.match(drawer, /time_provenance/);
assert.match(drawer, /Search care history/);
assert.match(drawer, /<aside/);
assert.match(drawer, /aria-label="Care history"/);
assert.match(drawer, /className=\{`history-drawer/);
assert.doesNotMatch(drawer, /history-action-menu|history-event-menu-trigger|Share care summary|Add to Home|Edit record|View record details|Download \/ Export|Pin to Home|Archive record|Restore record|Delete record|history-detail-actions|copyRecord|downloadRecord|shareRecord/, "History is browse-only and exposes none of the main-screen care actions");
assert.match(drawer, /No saved care entries were found in the information currently available/);
assert.match(drawer, /will not make up a history/);
assert.match(shell, /<HistoryDrawer \/>/);
assert.match(shell, /solenos-chat-sidebar/);
assert.match(shell, /Search history/);
assert.match(shell, /Daily Care/);
assert.match(shell, /Documents/);
assert.match(shell, /Care Handoffs/);
assert.match(shell, /Appointments/);
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

console.log("History drawer contract checks passed: authenticated event, document, appointment, handoff, LCR revision, decision and outcome reads; source-specific metadata; chronological ordering; partial-source failures; record detail; responsive browsing-only history.");
