import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accessibility = readFileSync(
  "src/components/app-shell/WorkspaceNavigationAccessibility.tsx",
  "utf8",
);
const shell = readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const designSystem = readFileSync(
  "src/app/workspace/experience-design-system-v2.css",
  "utf8",
);
const navigationStyles = readFileSync(
  "src/app/workspace/navigation-accessibility.css",
  "utf8",
);
const accessibilityOverrides = readFileSync(
  "src/app/accessibility-overrides.css",
  "utf8",
);

assert.match(accessibility, /matchMedia\("\(max-width: 900px\)"\)/);
assert.match(designSystem, /@media \(max-width: 900px\)/);
assert.match(navigationStyles, /@media \(max-width: 900px\)/);
assert.match(navigationStyles, /\.solenos-chat-sidebar \{\s*overflow-y: auto/s);
assert.match(navigationStyles, /@media \(max-width: 760px\)\s*\{\s*\.solenos-workspace-page-heading/);

assert.match(accessibilityOverrides, /button, \[role="button"\], input\[type="button"\][\s\S]*?min-height: 44px/);
assert.match(accessibilityOverrides, /button:focus-visible[\s\S]*?outline: 3px solid/);
assert.match(accessibilityOverrides, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(accessibilityOverrides, /data-solenos-theme="dark"[\s\S]*?outline-color: #f4d35e/);

assert.match(shell, /className="solenos-sidebar-icon-button solenos-sidebar-toggle"/);
assert.match(accessibility, /sidebar\.setAttribute\("aria-modal", "true"\)/);
assert.match(accessibility, /workspace\.inert = true/);
assert.match(accessibility, /trigger\.focus\(\{ preventScroll: true \}\)/);
assert.match(accessibility, /event\.key === "Escape"/);
assert.match(accessibility, /event\.key !== "Tab"/);

console.log("Workspace navigation accessibility contract passed: matching 900px breakpoint, modal semantics, inert background, Escape, focus trap, and focus restoration.");
