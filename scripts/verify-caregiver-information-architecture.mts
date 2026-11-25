import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const navigation = read("src/lib/workspace-navigation.ts");
const shell = read("src/components/app-shell/AppShell.tsx");
const breadcrumbs = read("src/components/app-shell/WorkspaceRouteBreadcrumbs.tsx");
const home = read("src/app/workspace/page.tsx");
const addUpdate = read("src/app/workspace/daily-care/page.tsx");
const careInformation = read("src/app/workspace/care-continuity/page.tsx");
const documents = read("src/app/workspace/documents/page.tsx");
const history = read("src/app/workspace/timeline/page.tsx");
const appointments = read("src/app/workspace/appointments/page.tsx");
const needsAttention = read("src/app/workspace/open-loops/page.tsx");
const companion = read("src/components/workflows/AICompanion.tsx");
const notifications = read("src/app/workspace/notifications/page.tsx");
const settings = read("src/app/workspace/settings/page.tsx");
const more = read("src/app/workspace/more/page.tsx");
const legacyRecord = read("src/app/workspace/record/page.tsx");
const legacyContinuity = read("src/app/workspace/continuity/page.tsx");
const community = read("src/app/workspace/community/page.tsx");
const featureFlags = read("src/lib/feature-flags.ts");
const legacySettings = read("src/app/settings/page.tsx");

const routes = [
  ["/workspace", "src/app/workspace/page.tsx"],
  ["/workspace/daily-care", "src/app/workspace/daily-care/page.tsx"],
  ["/workspace/care-continuity", "src/app/workspace/care-continuity/page.tsx"],
  ["/workspace/documents", "src/app/workspace/documents/page.tsx"],
  ["/workspace/timeline", "src/app/workspace/timeline/page.tsx"],
  ["/workspace/appointments", "src/app/workspace/appointments/page.tsx"],
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
  ["/workspace/handoffs", "Share care information"],
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
assert.ok(breadcrumbs.includes("CARE_INFORMATION_NAVIGATION"), "breadcrumbs share the canonical care destination labels");

for (const [source, expected, label] of [
  [home, "<h1>Home</h1>", "Home"],
  [addUpdate, "<h1>Add an update</h1>", "Add an update"],
  [careInformation, "<h1>Care information</h1>", "Care information"],
  [appointments, "<h1>Appointments</h1>", "Appointments"],
  [needsAttention, "<h1>Needs attention</h1>", "Needs attention"],
  [companion, '<h1 className="companion-page-title">Ask SolenOS</h1>', "Ask SolenOS"],
  [more, "<h1>More</h1>", "More"],
] as const) {
  assert.ok(source.includes(expected), `${label} page title matches its navigation label`);
}
assert.ok(careInformation.includes("CARE_INFORMATION_NAVIGATION.map"), "Care information exposes its child destinations");
assert.ok(documents.includes("<h1>Documents</h1>") || documents.includes(">Documents<"), "Documents remains a directly reachable workspace page");
assert.ok(history.includes("Care history"), "the history route retains its distinct historical responsibility");
assert.ok(notifications.includes("settings#settings-notifications"), "the notification shortcut lands on the real notification inbox");
assert.ok(settings.includes("/notifications?limit=100&offset=0") && settings.includes("/notifications/unread-count"), "the notification inbox reads its authenticated feed and unread count");
assert.ok(settings.includes("/read"), "marking a notification read uses its own notification endpoint");
assert.ok(needsAttention.includes("/open-loops?limit="), "Needs attention retrieves persisted follow-ups from their own service");
assert.ok(navigation.includes("Notifications") && navigation.includes("Needs attention"), "notifications and unresolved matters have distinct caregiver labels");

assert.ok(legacyRecord.includes("redirect") && legacyRecord.includes("/workspace"), "the legacy record route preserves a safe Home destination");
assert.ok(legacyContinuity.includes("redirect") && legacyContinuity.includes("/workspace"), "the technical continuity route does not expose a separate caregiver page");
assert.ok(featureFlags.includes("community: false") && featureFlags.includes("professionalCommunity: false"), "Community remains explicitly disabled");
assert.ok(community.includes("redirect") && community.includes("/workspace"), "the disabled Community route fails closed");
assert.ok(legacySettings.includes("redirect") && legacySettings.includes("/workspace/settings"), "the legacy Settings route preserves its destination");
assert.ok(more.includes("CaregiverHandoverInbox"), "family access handovers remain reachable under account management");
assert.ok(!more.includes("HistoryDrawer") && !more.includes("Recent care history"), "More does not duplicate core care browsing");
assert.ok(addUpdate.includes('href="/workspace/documents"'), "document upload remains discoverable from Add an update");
assert.ok(!navigation.toLowerCase().includes("community"), "the disabled Community feature remains absent from navigation");

console.log("Caregiver information architecture contract checks passed.");
