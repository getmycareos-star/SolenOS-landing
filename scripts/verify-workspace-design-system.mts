import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("src/app/workspace/layout.tsx");
const shell = read("src/components/app-shell/WorkspaceShellContent.tsx");
const rootLayout = read("src/app/layout.tsx");
const base = read("src/app/workspace/experience-design-system.css");
const v2 = read("src/app/workspace/experience-design-system-v2.css");
const navigation = read("src/app/workspace/navigation-accessibility.css");
const accessibility = read("src/app/accessibility-overrides.css");

const baseImport = shell.indexOf('import "@/app/workspace/experience-design-system.css";');
const v2Import = shell.indexOf('import "@/app/workspace/experience-design-system-v2.css";');
const navigationImport = shell.indexOf('import "@/app/workspace/navigation-accessibility.css";');
assert.ok(baseImport >= 0 && baseImport < v2Import && v2Import < navigationImport,
  "workspace foundation, design-system refinements and navigation accessibility must load in explicit order");
assert.match(rootLayout, /import "\.\/accessibility-overrides\.css";/,
  "product-wide accessibility preferences are loaded once by the root layout");
assert.doesNotMatch(shell, /accessibility-overrides\.css/,
  "workspace must not import the product-wide accessibility stylesheet a second time");
assert.doesNotMatch(layout, /^"use client";/,
  "the route layout stays server-rendered and delegates client behavior to the workspace shell");
assert.match(layout, /<WorkspaceProvider>[\s\S]*?<WorkspaceShellContent>/,
  "workspace bootstrap provider and visual shell have separate ownership");
assert.match(shell, /function CareContextBar[\s\S]*?recordLoadError[\s\S]*?No care details yet[\s\S]*?Add an update/,
  "care context distinguishes unavailable data from a genuinely empty record and provides a useful next step");
assert.match(shell, /WorkspaceEntryGate[\s\S]*?Preparing your care workspace/,
  "workspace entry remains gated until bootstrap resolves");
assert.match(layout, /We cannot confirm whether your last action[\s\S]*?Reload workspace/,
  "global recovery does not make unsupported claims about whether an operation was saved");
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

console.log("PASS: workspace base styles, authoritative v2 theme tokens, navigation focus and reduced-motion rules are consolidated without deleting component styling");
