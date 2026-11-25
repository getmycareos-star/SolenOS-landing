import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("src/app/workspace/layout.tsx");
const shell = read("src/components/app-shell/WorkspaceShellContent.tsx");
const recovery = read("src/components/app-shell/WorkspaceErrorFallback.tsx");
const breadcrumbs = read("src/components/app-shell/WorkspaceRouteBreadcrumbs.tsx");
const rootLayout = read("src/app/layout.tsx");
const base = read("src/app/workspace/experience-design-system.css");
const v2 = read("src/app/workspace/experience-design-system-v2.css");
const navigation = read("src/app/workspace/navigation-accessibility.css");

const baseImport = layout.indexOf('import "./experience-design-system.css";');
const v2Import = layout.indexOf('import "./experience-design-system-v2.css";');
const navigationImport = layout.indexOf('import "./navigation-accessibility.css";');
assert.ok(baseImport >= 0 && baseImport < v2Import && v2Import < navigationImport,
  "workspace foundation, design-system refinements and navigation accessibility must load in explicit order");
assert.match(rootLayout, /import "\.\/accessibility-overrides\.css";/,
  "product-wide accessibility preferences are loaded by the root layout");
assert.doesNotMatch(shell, /accessibility-overrides\.css/,
  "workspace must not import the product-wide accessibility stylesheet a second time");

assert.doesNotMatch(layout, /^"use client";/,
  "the route layout stays server-rendered");
assert.match(layout, /<ErrorBoundary[\s\S]*?<WorkspaceProvider>[\s\S]*?<WorkspaceShellContent>/,
  "the error boundary encloses workspace bootstrap and visual shell");
assert.match(recovery, /"use client"[\s\S]*?We cannot confirm whether your last action[\s\S]*?Reload workspace/,
  "recovery is an interactive client component and avoids unsupported save claims");

assert.match(shell, /function CareContextBar[\s\S]*?recordLoadError[\s\S]*?No care details yet[\s\S]*?Add an update/,
  "care context distinguishes unavailable data from an empty record and provides a useful next step");
assert.match(shell, /WorkspaceEntryGate[\s\S]*?Preparing your care workspace/,
  "workspace entry remains gated until bootstrap resolves");
assert.match(shell, /<GlobalDisplayPreferences\s*\/>/,
  "global display preferences remain mounted in the workspace");
assert.match(breadcrumbs, /solenos-workspace-breadcrumb-current/);
assert.match(breadcrumbs, /isHome \? " is-home" : ""/);
assert.match(navigation, /\.solenos-workspace-breadcrumbs\.is-home \{ display: none; \}/, "the Care Record home page does not retain an empty breadcrumb row");
assert.match(navigation, /\.solenos-workspace-breadcrumb-current[\s\S]*?clip: rect\(0, 0, 0, 0\)/,
  "current route title remains available to assistive technology without repeating the visible page heading");

assert.match(navigation, /\.workspace-connection-alert/);
assert.match(navigation, /\.workspace-error-recovery/);
assert.match(navigation, /\.care-context-action/);
assert.doesNotMatch(base, /:root\[data-solenos-theme="dark"\] \.solenos-chat-app\s*\{\s*--sn-canvas:/,
  "dark theme design tokens must not be duplicated in the legacy base stylesheet");
for (const token of ["--sn-canvas", "--sn-surface", "--sn-surface-soft", "--sn-ink", "--sn-muted", "--sn-line", "--sn-sage", "--sn-forest", "--sn-focus", "--sn-shadow-soft"]) {
  assert.ok(v2.includes(token + ":"), `v2 must own the shared ${token} token`);
}
assert.match(v2, /:root\[data-solenos-theme="dark"\] \.solenos-chat-app\s*\{[\s\S]*?--sn-canvas:/,
  "v2 must provide the authoritative dark theme token mapping");
assert.match(navigation, /:focus-visible|:focus-within/,
  "navigation must retain visible keyboard focus treatment");
assert.match(navigation, /prefers-reduced-motion/,
  "navigation must retain reduced-motion support");
assert.match(v2, /\.solenos-chat-app \.solenos-chat-nav-item\s*\{\s*min-height: 48px;/,
  "workspace navigation overrides must preserve 48px touch targets after the v2 cascade");
assert.match(v2, /\.solenos-chat-app \.solenos-sidebar-icon-button\s*\{\s*min-width: 44px;\s*min-height: 44px;/,
  "sidebar controls must retain at least 44px touch targets after the v2 cascade");

console.log("PASS: workspace shell boundaries, care-context states, breadcrumb hierarchy, authoritative theme tokens, focus and reduced-motion contracts");
