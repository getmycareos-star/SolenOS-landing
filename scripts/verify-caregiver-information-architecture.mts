import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const collectNamedFiles = (directory: string, pattern: RegExp): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectNamedFiles(absolute, pattern);
    return entry.isFile() && pattern.test(entry.name)
      ? [path.relative(root, absolute).replaceAll("\\", "/")]
      : [];
  });
const navigation = read("src/lib/workspace-navigation.ts");
const shell = read("src/components/app-shell/AppShell.tsx");
const workspaceLayout = read("src/app/workspace/layout.tsx");
const workspaceShell = read("src/components/app-shell/WorkspaceShellContent.tsx");
const workspaceContext = read("src/lib/workspace-context.tsx");
const apiClient = read("src/api/client.ts");
const breadcrumbs = read("src/components/app-shell/WorkspaceRouteBreadcrumbs.tsx");
const home = read("src/app/workspace/page.tsx");
const addUpdate = read("src/app/workspace/daily-care/page.tsx");
const careInformation = read("src/app/workspace/care-continuity/page.tsx");
const documents = read("src/app/workspace/documents/page.tsx");
const history = read("src/app/workspace/timeline/page.tsx");
const appointments = read("src/app/workspace/appointments/page.tsx");
const reminders = read("src/app/workspace/reminders/page.tsx");
const handoffs = read("src/app/workspace/handoffs/page.tsx");
const needsAttention = read("src/app/workspace/open-loops/page.tsx");
const companion = read("src/components/workflows/AICompanion.tsx");
const notifications = read("src/app/workspace/notifications/page.tsx");
const notificationCenter = read("src/components/mvp-workspace/NotificationsCenter.tsx");
const settings = read("src/app/workspace/settings/page.tsx");
const more = read("src/app/workspace/more/page.tsx");
const legacyRecord = read("src/app/workspace/record/page.tsx");
const legacyContinuity = read("src/app/workspace/continuity/page.tsx");
const community = read("src/app/workspace/community/page.tsx");
const featureFlags = read("src/lib/feature-flags.ts");
const legacySettings = read("src/app/settings/page.tsx");

const expectedPageFiles = [
  "src/app/about/page.tsx",
  "src/app/capabilities/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/early-access/page.tsx",
  "src/app/help/page.tsx",
  "src/app/how-it-works/page.tsx",
  "src/app/invite/caregiver/page.tsx",
  "src/app/metrics/page.tsx",
  "src/app/mission/page.tsx",
  "src/app/ops/clarity/page.tsx",
  "src/app/ops/devtools/page.tsx",
  "src/app/ops/page.tsx",
  "src/app/our-story/page.tsx",
  "src/app/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/share/page.tsx",
  "src/app/start/page.tsx",
  "src/app/support/page.tsx",
  "src/app/team/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/welcome/page.tsx",
  "src/app/why-solenos/page.tsx",
  "src/app/workspace/appointments/page.tsx",
  "src/app/workspace/care-continuity/page.tsx",
  "src/app/workspace/community/page.tsx",
  "src/app/workspace/companion/page.tsx",
  "src/app/workspace/continuity/page.tsx",
  "src/app/workspace/daily-care/page.tsx",
  "src/app/workspace/documents/page.tsx",
  "src/app/workspace/handoffs/page.tsx",
  "src/app/workspace/more/page.tsx",
  "src/app/workspace/notifications/page.tsx",
  "src/app/workspace/open-loops/page.tsx",
  "src/app/workspace/page.tsx",
  "src/app/workspace/record/page.tsx",
  "src/app/workspace/reminders/page.tsx",
  "src/app/workspace/settings/page.tsx",
  "src/app/workspace/timeline/page.tsx",
].sort();
const actualPageFiles = collectNamedFiles(path.join(root, "src", "app"), /^page\\.(tsx|ts|jsx|js)$/).sort();
assert.deepEqual(actualPageFiles, expectedPageFiles, "every App Router page must have an explicit route inventory entry");
assert.equal(actualPageFiles.length, 39, "the inspected application page inventory contains 39 routes");
const expectedRouteHandlers = [
  "src/app/api/analyze/route.ts",
  "src/app/api/extract/route.ts",
  "src/app/api/share-intake/route.ts",
  "src/app/api/situation/route.ts",
  "src/app/share-target/route.ts",
].sort();
const actualRouteHandlers = collectNamedFiles(path.join(root, "src", "app"), /^route\\.(ts|js)$/).sort();
assert.deepEqual(actualRouteHandlers, expectedRouteHandlers, "all App Router handlers remain accounted for");

const routes = [
  ["/workspace", "src/app/workspace/page.tsx"],
  ["/workspace/daily-care", "src/app/workspace/daily-care/page.tsx"],
  ["/workspace/care-continuity", "src/app/workspace/care-continuity/page.tsx"],
  ["/workspace/documents", "src/app/workspace/documents/page.tsx"],
  ["/workspace/timeline", "src/app/workspace/timeline/page.tsx"],
  ["/workspace/appointments", "src/app/workspace/appointments/page.tsx"],
  ["/workspace/reminders", "src/app/workspace/reminders/page.tsx"],
  ["/workspace/open-loops", "src/app/workspace/open-loops/page.tsx"],
  ["/workspace/reminders", "src/app/workspace/reminders/page.tsx"],
  ["/workspace/handoffs", "src/app/workspace/handoffs/page.tsx"],
  ["/workspace/companion", "src/app/workspace/companion/page.tsx"],
  ["/workspace/notifications", "src/app/workspace/notifications/page.tsx"],
  ["/workspace/more", "src/app/workspace/more/page.tsx"],
  ["/workspace/settings", "src/app/workspace/settings/page.tsx"],
  ["/workspace/record", "src/app/workspace/record/page.tsx"],
  ["/workspace/continuity", "src/app/workspace/continuity/page.tsx"],
  ["/workspace/community", "src/app/workspace/community/page.tsx"],
  ["/settings", "src/app/settings/page.tsx"],
] as const;
for (const [route, file] of routes) {
  assert.ok(fs.existsSync(path.join(root, file)), `${route} resolves to an existing page`);
}

for (const label of ["Home", "Add an update", "Care information", "Documents", "Ask SolenOS", "Notifications", "More"]) {
  assert.ok(navigation.includes(`label: "${label}"`), `${label} has a canonical navigation label`);
}
for (const [route, label] of [
  ["/workspace/timeline", "Care history"],
  ["/workspace/appointments", "Appointments"],
  ["/workspace/open-loops", "Needs attention"],
  ["/workspace/reminders", "Reminders"],
  ["/workspace/handoffs", "Care handoffs"],
] as const) {
  const routeIndex = navigation.indexOf(`href: "${route}"`);
  assert.ok(routeIndex >= 0, `${route} exists in the navigation registry`);
  assert.ok(navigation.slice(routeIndex, routeIndex + 220).includes(`label: "${label}"`), `${route} has the expected caregiver label`);
}

const moreDestinations = navigation.slice(navigation.indexOf("export const WORKSPACE_SECONDARY_NAVIGATION"));
assert.ok(moreDestinations.includes('href: "/workspace/settings"'));
for (const route of ["/workspace/timeline", "/workspace/documents", "/workspace/appointments", "/workspace/open-loops", "/workspace/reminders", "/workspace/handoffs", "/workspace/companion"]) {
  assert.ok(!moreDestinations.includes(`href: "${route}"`), `More does not own ${route}`);
}
assert.ok(shell.includes("CARE_INFORMATION_NAVIGATION.some"), "the Care information parent remains active on its child routes");
assert.ok(workspaceLayout.includes("<WorkspaceProvider>") && workspaceLayout.includes("<WorkspaceShellContent>"), "every workspace route shares the authenticated workspace provider and shell");
assert.ok(workspaceShell.includes("<WorkspaceEntryGate>") && workspaceShell.includes("entryReady"), "direct workspace entry waits for session bootstrap");
assert.ok(workspaceContext.includes("ensureAnonymousSession()") && workspaceContext.includes('getJSON('), "workspace bootstrap uses the server-issued caregiver session and authorized record read");
assert.ok(workspaceContext.includes('addEventListener("personIdChanged", refreshForPersonChange)'), "the shared workspace projection refreshes when the active caregiver or care recipient changes");
assert.ok(workspaceContext.includes("scopeRefreshVersionRef") && workspaceContext.includes("setRuntime({ ...createEmptyUiRuntimeState()"), "a scope change clears prior-person content and rejects stale refresh responses");

assert.ok(workspaceContext.includes("Legacy browser caches do not") && workspaceContext.includes("setRuntime({"), "legacy browser cache cannot repopulate caregiver-visible care information");
assert.ok(apiClient.includes('Authorization: `Bearer ${token}`') && apiClient.includes("personIdChanged"), "API requests retain bearer authorization and active care-recipient change signalling");

assert.ok(shell.includes("solenos-chat-nav-subnav") && shell.includes("aria-expanded={careInformationExpanded}"), "desktop and mobile menus expose an accessible expandable Care information hierarchy");
assert.ok(shell.includes("solenos-mobile-bottom-nav"), "mobile navigation exposes Home, Care, Ask and More");
assert.ok(shell.includes("solenos-mobile-add-update"), "Add an update remains a prominent action outside the mobile destination bar");
assert.ok(shell.includes("solenos-notification-shortcut"), "Notifications remains directly accessible from the workspace header");
assert.ok(shell.includes('getJSON("/notifications/unread-count")') && shell.includes("unreadNotificationCount"), "the header notification indicator reads the authenticated unread count");
assert.ok(shell.includes("solenos:notifications-updated") && notificationCenter.includes('new Event("solenos:notifications-updated")'), "marking a notification read refreshes the global unread indicator");


assert.ok(breadcrumbs.includes("CARE_INFORMATION_NAVIGATION"), "breadcrumbs share the canonical care destination labels");

for (const [source, expected, label] of [
  [home, "<h1>Today</h1>", "Today"],
  [addUpdate, "<h1>Add an update</h1>", "Add an update"],
  [careInformation, "<h1>Care information</h1>", "Care information"],
  [appointments, "<h1>Appointments</h1>", "Appointments"],
  [reminders, "<h1>Reminders</h1>", "Reminders"],
  [handoffs, '<h1 id="care-handoffs-title">Care handoffs</h1>', "Care handoffs"],
  [needsAttention, "<h1>Needs attention</h1>", "Needs attention"],
  [companion, '<h1 className="companion-page-title">Ask SolenOS</h1>', "Ask SolenOS"],
  [more, "<h1>More</h1>", "More"],
] as const) {
  assert.ok(source.includes(expected), `${label} page title matches its navigation label`);
}
assert.ok(careInformation.includes("CARE_INFORMATION_NAVIGATION.map"), "Care information exposes its child destinations");
assert.ok(home.includes('viewMode="today"'), "Home uses the concise current-care projection");
assert.ok(careInformation.includes("<LCRCurrentUnderstanding />"), "Care information retains the complete care-record view");
assert.ok(documents.includes("<h1>Documents</h1>") || documents.includes(">Documents<"), "Documents remains a directly reachable workspace page");
assert.ok(history.includes("Care history"), "the history route retains its distinct historical responsibility");
assert.ok(history.includes("updateHistoryUrl") && history.includes('params.get("filter")') && history.includes('params.get("q")'), "Care history preserves its search and filters when a caregiver opens a source and returns");
assert.ok(history.includes("Open original document"), "document-backed history entries expose a direct source link");
assert.ok(documents.includes('get("evidenceId")') && documents.includes("openOriginal(matchingDocument)"), "Documents opens the exact source selected from Care history");

assert.ok(notifications.includes("<NotificationsCenter />"), "Notifications renders a dedicated inbox rather than redirecting into Settings");
assert.ok(notificationCenter.includes("/notifications?limit=100&offset=0") && notificationCenter.includes("/notifications/unread-count"), "the notification inbox reads its authenticated feed and unread count");
assert.ok(notificationCenter.includes('"/read"') && !notificationCenter.includes('postJSON("/open-loops"') && !notificationCenter.includes('patchJSON("/open-loops"'), "reading a notification changes only notification read state");
assert.ok(needsAttention.includes("/open-loops") && !needsAttention.includes('postJSON("/notifications"') && !needsAttention.includes('patchJSON("/notifications"'), "Needs attention owns unresolved care matter state independently of the notification inbox");

assert.ok(settings.includes('href="/workspace/notifications"'), "Settings links to the separate notification destination");
assert.ok(notificationCenter.includes("/read"), "marking a notification read uses its own notification endpoint");
assert.ok(needsAttention.includes("/open-loops?limit="), "Needs attention retrieves persisted follow-ups from their own service");
assert.ok(navigation.includes("Notifications") && navigation.includes("Needs attention"), "notifications and unresolved matters have distinct caregiver labels");
assert.ok(navigation.includes('href: "/workspace/documents"') && navigation.indexOf('href: "/workspace/documents"') > navigation.indexOf("export const CARE_INFORMATION_NAVIGATION"), "Documents belongs inside Care information, not at the top navigation level");

assert.ok(legacyRecord.includes("redirect") && legacyRecord.includes("/workspace"), "the legacy record route preserves a safe Home destination");
assert.ok(legacyContinuity.includes("redirect") && legacyContinuity.includes("/workspace"), "the technical continuity route does not expose a separate caregiver page");
assert.ok(featureFlags.includes("community: false") && featureFlags.includes("professionalCommunity: false"), "Community remains explicitly disabled");
assert.ok(community.includes("redirect") && community.includes("/workspace"), "the disabled Community route fails closed");
assert.ok(legacySettings.includes("redirect") && legacySettings.includes("/workspace/settings"), "the legacy Settings route preserves its destination");
assert.ok(more.includes("CaregiverHandoverInbox"), "family access handovers remain reachable under account management");
assert.ok(!more.includes("HistoryDrawer") && !more.includes("Recent care history"), "More does not duplicate core care browsing");
assert.ok(addUpdate.includes('href="/workspace/documents"'), "document upload remains discoverable from Add an update");
assert.ok(addUpdate.includes("Upload a medical document"), "medical document upload is a visible Add an update action");
assert.ok(!navigation.toLowerCase().includes("community"), "the disabled Community feature remains absent from navigation");

console.log("Caregiver information architecture contract checks passed.");
