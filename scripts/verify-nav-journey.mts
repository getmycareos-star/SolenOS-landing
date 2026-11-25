/**
 * Direct LCR entry contract.
 * Any CTA that says to use/open the Living Care Record must route directly to /workspace.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_TRUST_LAYER } from "../src/lib/solenos-layers/architecture-map";
import { WELCOME_HOME } from "../src/lib/trust-content";

const root = process.cwd();
const landing = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const start = fs.readFileSync(path.join(root, "src/app/start/page.tsx"), "utf8");
const earlyAccess = fs.readFileSync(path.join(root, "src/app/early-access/page.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/public/PublicShell.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");

assert.equal(PUBLIC_TRUST_LAYER.enterCareRecord, "/workspace?enter=1");
assert.match(WELCOME_HOME.primaryCtaHref, /^\/workspace\?enter=1$/);
assert.match(landing, /const start = "\/workspace\?enter=1"/);
assert.match(landing, /href=\{start\}/);
assert.match(start, /primaryCtaHref/);
assert.match(earlyAccess, /href="\/workspace\?enter=1"/);
assert.match(shell, /href="\/workspace\?enter=1"/);
assert.doesNotMatch(earlyAccess, /EarlyAccessConsentForm|type="checkbox"|ResearchPreviewAckGate/);
assert.doesNotMatch(layout, /ConsentGatePanel|WorkspacePrivacyBoundary|ResearchPreviewAckGate|type="checkbox"/);
assert.match(layout, /<WorkspaceProvider>/);

console.log("✓ primary, navigation, start, and early-access CTAs route directly to the LCR");
console.log("✓ workspace access is not blocked by a checkbox or acknowledgement overlay");


// Canonical workspace navigation contract: one registry, visible labels, real routes.
const appShell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const navigationRegistry = fs.readFileSync(path.join(root, "src/lib/workspace-navigation.ts"), "utf8");
const morePage = fs.readFileSync(path.join(root, "src/app/workspace/more/page.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");

assert.match(appShell, /WORKSPACE_NAVIGATION\.care\.map/);
assert.doesNotMatch(appShell, /WORKSPACE_NAVIGATION\.support\.map/);
assert.match(appShell, /WORKSPACE_NAVIGATION\.settings\.map/);
assert.doesNotMatch(appShell, /const NAVIGATION\s*=|NAVIGATION\.map/);
assert.doesNotMatch(layout, /WORKSPACE_NAV\s*=|navItems=/);
assert.match(appShell, /href=\{brandHref\}/, "the brand link remains a direct route to the Care Record");
assert.match(appShell, /if \(href === "\/workspace"\) return pathname === href/, "Home must not match every nested route");
assert.match(appShell, /WORKSPACE_SECONDARY_NAVIGATION\.some/, "secondary routes keep More active");
assert.match(appShell, /CARE_INFORMATION_NAVIGATION\.some/, "Care information stays active while a caregiver browses its child destinations");
assert.match(appShell, /solenos-chat-nav-subnav[\s\S]*?aria-label="Care information sections"/, "Care information exposes its child destinations in the sidebar");
assert.match(appShell, /solenos-mobile-bottom-nav[\s\S]*?href="\/workspace\/companion"/, "mobile bottom navigation includes the Ask destination");
assert.match(appShell, /solenos-mobile-add-update[\s\S]*?href="\/workspace\/daily-care"/, "Add an update is a separate mobile action");
assert.match(appShell, /solenos-notification-shortcut[\s\S]*?href="\/workspace\/notifications"/, "Notifications is directly reachable from the workspace header");
assert.match(navigationRegistry, /CARE_INFORMATION_NAVIGATION[\s\S]*?href: "\/workspace\/documents"[\s\S]*?label: "Documents"/, "Documents is nested under Care information");


for (const label of ["Home", "Add an update", "Care information", "Documents", "Ask SolenOS", "Notifications", "More"]) {
  assert.ok(navigationRegistry.includes(`label: "${label}"`), `canonical navigation includes ${label}`);
}
assert.match(navigationRegistry, /CARE_INFORMATION_NAVIGATION[\s\S]*?href: "\/workspace\/open-loops"[\s\S]*?label: "Needs attention"/, "Needs attention is grouped with Care information");
assert.match(navigationRegistry, /id: "ask-solenos"[\s\S]*?href: "\/workspace\/companion"[\s\S]*?label: "Ask SolenOS"/, "Ask SolenOS is a primary destination");
assert.match(navigationRegistry, /WORKSPACE_SECONDARY_NAVIGATION/);
assert.match(morePage, /WORKSPACE_SECONDARY_NAVIGATION\.map/);
const careInformationRoutes = ["/workspace/timeline", "/workspace/documents", "/workspace/appointments", "/workspace/open-loops", "/workspace/reminders", "/workspace/handoffs"];
for (const route of careInformationRoutes) {
  assert.ok(navigationRegistry.slice(navigationRegistry.indexOf("export const CARE_INFORMATION_NAVIGATION")).includes(route),
    `Care information owns the care destination ${route}`);
}
assert.ok(navigationRegistry.includes("/workspace/companion"), "Ask SolenOS remains a primary destination");
assert.ok(navigationRegistry.includes("/workspace/notifications"), "Notifications remains directly accessible");
assert.ok(navigationRegistry.slice(navigationRegistry.indexOf("export const WORKSPACE_SECONDARY_NAVIGATION")).includes("/workspace/settings"),
  "More contains application and account settings");
for (const route of [
  "src/app/workspace/page.tsx",
  "src/app/workspace/daily-care/page.tsx",
  "src/app/workspace/care-continuity/page.tsx",
  "src/app/workspace/notifications/page.tsx",
  "src/app/workspace/open-loops/page.tsx",
  "src/app/workspace/timeline/page.tsx",
  "src/app/workspace/documents/page.tsx",
  "src/app/workspace/appointments/page.tsx",
  "src/app/workspace/handoffs/page.tsx",
  "src/app/workspace/companion/page.tsx",
  "src/app/workspace/settings/page.tsx",
  "src/app/workspace/more/page.tsx",
]) {
  assert.ok(fs.existsSync(path.join(root, route)), `navigation destination exists: ${route}`);
}
assert.match(appShell, /solenos-chat-nav-description/, "navigation explains each destination in plain language");
assert.match(styles, /\.solenos-chat-sidebar-host\s*\{\s*flex:\s*0 0 264px;\s*width:\s*264px;/,
  "desktop navigation is visible without first opening the menu");
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?translateX\(-105%\)/,
  "mobile navigation remains a closed drawer until requested");
assert.match(styles, /\.solenos-chat-nav-item\s*\{[^}]*min-height:\s*48px/s,
  "navigation links have comfortable touch targets");

console.log("✓ one canonical navigation registry drives every workspace navigation group");
console.log("✓ all visible navigation destinations resolve to existing workspace routes");
console.log("✓ desktop navigation is visible by default and mobile navigation opens as a drawer");


// End-to-end navigation safeguards: real route contracts, consistent titles,
// caregiver-session gating, keyboard operation, and modal mobile-drawer behavior.
const navigationA11y = fs.readFileSync(path.join(root, "src/components/app-shell/WorkspaceNavigationAccessibility.tsx"), "utf8");
const breadcrumbs = fs.readFileSync(path.join(root, "src/components/app-shell/WorkspaceRouteBreadcrumbs.tsx"), "utf8");
const workspaceStyles = fs.readFileSync(path.join(root, "src/app/workspace/navigation-accessibility.css"), "utf8");
const workspaceContext = fs.readFileSync(path.join(root, "src/lib/workspace-context.tsx"), "utf8");
const companion = fs.readFileSync(path.join(root, "src/components/workflows/AICompanion.tsx"), "utf8");
const workspaceHome = fs.readFileSync(path.join(root, "src/app/workspace/page.tsx"), "utf8");

assert.match(layout, /function WorkspaceEntryGate[\s\S]*?entryReady[\s\S]*?Preparing your care workspace/);
assert.match(workspaceHome, /\/\* Show the current care situation before inbox and detailed record content\. \*\/\}/, "Care Record page JSX comment must be closed");
assert.match(workspaceContext, /ensureAnonymousSession\(\)/, "caregiver workspace bootstraps a server-issued session before entry");
assert.match(navigationA11y, /event\.key === "Escape"/, "Escape closes the mobile drawer");
assert.match(navigationA11y, /event\.key !== "Tab"/, "Tab handling is explicitly trapped in the open drawer");
assert.match(navigationA11y, /workspace\.inert = true/, "background workspace is inert while the drawer is open");
assert.match(navigationA11y, /host\.inert = true/, "closed mobile navigation cannot receive keyboard focus");
assert.match(navigationA11y, /aria-modal/, "mobile drawer is announced as a modal dialog");
assert.match(navigationA11y, /trigger\.focus/, "focus returns to the menu trigger after closing");
assert.match(navigationA11y, /main\.focus/, "route changes move keyboard focus to the new page content");
assert.match(breadcrumbs, /CARE_INFORMATION_NAVIGATION/, "breadcrumbs use the same Care information destination labels");
assert.match(breadcrumbs, /aria-label="Breadcrumb"/);
assert.match(breadcrumbs, /aria-current="page"/);
assert.match(breadcrumbs, /href="\/workspace"/);
assert.match(workspaceStyles, /:focus-visible/);
assert.match(workspaceStyles, /overflow-y: auto/);

const routeContracts = [
  ["src/app/workspace/page.tsx", "Home"],
  ["src/app/workspace/daily-care/page.tsx", "Add an update"],
  ["src/app/workspace/care-continuity/page.tsx", "Care information"],
  ["src/app/workspace/notifications/page.tsx", "Notifications"],
  ["src/app/workspace/open-loops/page.tsx", "Needs attention"],
  ["src/app/workspace/timeline/page.tsx", "Care history"],
  ["src/app/workspace/documents/page.tsx", "Documents"],
  ["src/app/workspace/appointments/page.tsx", "Appointments"],
  ["src/app/workspace/handoffs/page.tsx", "Share care information"],
  ["src/components/workflows/AICompanion.tsx", "Ask SolenOS"],
  ["src/app/workspace/settings/page.tsx", "Settings"],
  ["src/app/workspace/more/page.tsx", "More"],
];
for (const [route, title] of routeContracts) {
  const source = fs.readFileSync(path.join(root, route), "utf8");
  assert.match(source, new RegExp("<h1[^>]*>[^<]*" + title + "[\\s\\S]*?<\\/h1>"),
    `${title} has a page-level heading that matches its navigation label`);
}

for (const route of [
  "src/app/workspace/page.tsx",
  "src/app/workspace/daily-care/page.tsx",
  "src/app/workspace/open-loops/page.tsx",
  "src/app/workspace/timeline/page.tsx",
  "src/app/workspace/documents/page.tsx",
  "src/app/workspace/appointments/page.tsx",
  "src/app/workspace/handoffs/page.tsx",
  "src/app/workspace/companion/page.tsx",
  "src/app/workspace/settings/page.tsx",
]) {
  const source = fs.readFileSync(path.join(root, route), "utf8");
  assert.doesNotMatch(source, /<main\b/, `${route} must not create a nested main landmark inside the app shell`);
}
assert.doesNotMatch(companion, /<main\b/, "AI Companion must not add a nested main landmark");
const firstVisitRouter = fs.readFileSync(path.join(root, "src/components/mvp-workspace/FirstVisitWorkspaceRouter.tsx"), "utf8");
assert.doesNotMatch(firstVisitRouter, /<main\\b/, "first-visit states must not add nested main landmarks inside the workspace shell");

console.log("✓ route titles and breadcrumbs agree with navigation labels");
console.log("✓ mobile drawer has focus containment, Escape handling, inert background, and focus restoration");
console.log("✓ workspace routes are gated on caregiver session bootstrap");
console.log("✓ workspace destinations do not create nested main landmarks");
