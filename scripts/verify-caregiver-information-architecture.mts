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
const more = read("src/app/workspace/more/page.tsx");

for (const [route, file] of [
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
] as const) {
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
  assert.match(navigation, new RegExp('href: "' + route.replaceAll("/", "\\/") + '"[\\s\\S]*?label: "' + label + '"'),
    `${route} belongs to Care information`);
}

assert.match(navigation, /WORKSPACE_SECONDARY_NAVIGATION[\\s\\S]*?href: "\\/workspace\\/settings"[\\s\\S]*?label: "Settings"/);
assert.doesNotMatch(navigation, /WORKSPACE_SECONDARY_NAVIGATION[\\s\\S]*?href: "\\/workspace\\/(timeline|documents|appointments|open-loops|reminders|handoffs|companion)"/,
  "More must not own core care destinations");
assert.match(shell, /CARE_INFORMATION_NAVIGATION\\.some/, "the Care information parent remains active on its child routes");
assert.match(breadcrumbs, /CARE_INFORMATION_NAVIGATION/, "breadcrumbs share the canonical care destination labels");

assert.match(home, /<h1>Home<\\/h1>/);
assert.match(addUpdate, /<h1>Add an update<\\/h1>/);
assert.match(careInformation, /<h1>Care information<\\/h1>/);
assert.match(careInformation, /CARE_INFORMATION_NAVIGATION\\.map/, "Care information exposes its child destinations");
assert.match(documents, /Documents/, "Documents remains a directly reachable workspace page");
assert.match(history, /Care history/, "the history route retains its distinct historical responsibility");
assert.match(appointments, /<h1[^>]*>Appointments<\\/h1>/);
assert.match(needsAttention, /<h1>Needs attention<\\/h1>/);
assert.match(companion, /<h1 className="companion-page-title">Ask SolenOS<\\/h1>/);
assert.match(notifications, /settings#settings-notifications/, "the notification shortcut lands on the real notification inbox");
assert.match(more, /<h1>More<\\/h1>/);
assert.match(more, /CaregiverHandoverInbox/, "family access handovers remain reachable under account management");
assert.doesNotMatch(more, /HistoryDrawer|Recent care history/, "More does not duplicate core care browsing");
assert.ok(addUpdate.includes('href="/workspace/documents"'), "document upload remains discoverable from Add an update");
assert.doesNotMatch(navigation, /community/i, "the disabled Community feature remains absent from navigation");

console.log("Caregiver information architecture contract checks passed.");
