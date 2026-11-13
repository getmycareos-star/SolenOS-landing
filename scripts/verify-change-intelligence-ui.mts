/**
 * Regression guard for the caregiver-facing change-intelligence integration.
 *
 * This is an architecture/contract check, not a browser or production test.
 * It ensures the panel remains a view of persisted backend assessments and
 * fails visibly rather than fabricating findings when the API is unavailable.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const panel = fs.readFileSync(path.join(root, "src/components/mvp-workspace/ChangeIntelligencePanel.tsx"), "utf8");
const api = fs.readFileSync(path.join(root, "src/api/change-intelligence.ts"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const contract of [
  ["panel lists persisted changes", /listPersistedChanges\(\)/],
  ["panel lists persisted patterns", /listPersistedPatterns\(\)/],
  ["older change assessments can be loaded", /Load earlier changes/],
  ["older patterns can be loaded", /Load earlier patterns/],
  ["change history is not silently limited to eight rows", !/changes\.slice\(0, 8\)/],
  ["pattern history is not silently limited to eight rows", !/patterns\.slice\(0, 8\)/],
  ["panel requests backend reassessment", /reassessPersistedChangeIntelligence\(\)/],
  ["change source details are user-reviewable", /Review source evidence/],
  ["pattern source details are user-reviewable", /Review pattern sources/],
  ["missing earlier information is not proof an event did not happen", /Earlier care information may be missing\. That does not mean the event did not happen\./],
  ["failed loads are exposed as an error state", /role="alert"/],
  ["empty state does not claim no changes occurred", /This does not mean that no changes occurred/],
] as const) {
  assert(contract[1].test(panel), `Missing UI contract: ${contract[0]}`);
}
assert(!/\bconfidence\b/i.test(panel), "uncalibrated model confidence must not be displayed in caregiver-facing change intelligence");

assert(!/recordObservationCoverage|submitCoverage|Save observation coverage|lcr-coverage-editor|<form\b/.test(panel), "observation coverage cannot be independently submitted from this panel");

assert(
  /function requirePersonId\(\)[\s\S]*?getPersonId\(\)[\s\S]*?server-issued SolenOS care session is required/.test(api),
  "API requests must require the current server-issued care session",
);
assert(
  /getJSON\(\`\/change\/changes\/\$\{personId\}/.test(api),
  "Change listings must be read from the authoritative backend API",
);
assert(
  /new URLSearchParams\(\{ limit: String\(limit\), offset: String\(offset\) \}\)/.test(api),
  "change and pattern history reads must support server-side pagination",
);
assert(
  /getJSON\(\`\/change\/patterns\/\$\{personId\}/.test(api),
  "Pattern listings must be read from the authoritative backend API",
);
assert(
  /postJSON\(\`\/change\/changes\/reassess\?person_id=\$\{personId\}/.test(api),
  "Reassessment must invoke the backend, not the local pattern mock",
);
assert(
  !/runPatternEngine|runPatternIntelligence|resetPatternIntelligenceStore/.test(panel),
  "The live panel must not synthesize findings with the local pattern-intelligence store",
);

console.log("CHANGE_INTELLIGENCE_UI_CONTRACT=PASS");
console.log("Assertions=14");
console.log("Scope=source contract only; browser rendering and live production API remain separate gates");
