import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/accessibility/GlobalDisplayPreferences.tsx",
  "utf8",
);

assert.match(source, /window\.matchMedia\("\(prefers-color-scheme: dark\)"\)/);
assert.match(source, /prefs\.theme === "system" \? \(systemTheme\.matches \? "dark" : "light"\) : prefs\.theme/);
assert.match(source, /systemTheme\.addEventListener\("change", applyTheme\)/);
assert.match(source, /systemTheme\.removeEventListener\("change", applyTheme\)/);
assert.match(source, /root\.style\.colorScheme = resolvedTheme/);
assert.match(source, /root\.style\.setProperty\("--solenos-text-scale"/);
assert.doesNotMatch(source, /System default intentionally means the accessible light theme/);

console.log("Display preference contract passed: explicit themes, live OS theme changes, cleanup, native color-scheme, and text scaling.");
