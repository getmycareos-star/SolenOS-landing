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
const styles = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");

assert.match(appShell, /WORKSPACE_NAVIGATION\.care\.map/);
assert.match(appShell, /WORKSPACE_NAVIGATION\.support\.map/);
assert.match(appShell, /WORKSPACE_NAVIGATION\.settings\.map/);
assert.doesNotMatch(appShell, /const NAVIGATION\s*=|NAVIGATION\.map/);
assert.doesNotMatch(layout, /WORKSPACE_NAV\s*=|navItems=/);
assert.match(appShell, /href=\{brandHref\}/, "the brand link remains a direct route to the Care Record");
assert.match(appShell, /href === "\/workspace"\s*\? pathname === href/, "the Care Record active state must not match every nested route");

for (const label of ["Care Record", "Daily Care", "Follow-ups", "Care Timeline", "Documents", "Appointments", "Care Handoffs", "AI Companion", "Settings"]) {
  assert.ok(navigationRegistry.includes(`label: "${label}"`), `canonical navigation includes ${label}`);
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
