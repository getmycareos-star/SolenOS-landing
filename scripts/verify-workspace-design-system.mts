import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("src/app/workspace/layout.tsx");
const base = read("src/app/workspace/experience-design-system.css");
const v2 = read("src/app/workspace/experience-design-system-v2.css");
const navigation = read("src/app/workspace/navigation-accessibility.css");
const accessibility = read("src/app/accessibility-overrides.css");

const baseImport = layout.indexOf('import "./experience-design-system.css";');
const v2Import = layout.indexOf('import "./experience-design-system-v2.css";');
const navigationImport = layout.indexOf('import "./navigation-accessibility.css";');
const accessibilityImport = layout.indexOf('import "./../accessibility-overrides.css";');
assert.ok(baseImport >= 0 && baseImport < v2Import && v2Import < navigationImport && navigationImport < accessibilityImport,
  "base styles, v2 overrides, navigation rules and accessibility overrides must load in cascade order");
assert.match(accessibility, /Shared display preferences and theme overrides; imported after base and mobile styles/,
  "global accessibility overrides must remain the final workspace stylesheet");
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
