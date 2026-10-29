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
  ["panel requests backend reassessment", /reassessPersistedChangeIntelligence\(\)/],
  ["change source details are user-reviewable", /Review source evidence/],
  ["pattern source details are user-reviewable", /Review pattern sources/],
  ["unknown coverage is explicitly not absence", /Missing coverage is unknown, not evidence that an event did not happen/],
  ["uncalibrated confidence is not presented as a percentage", /confidence == null \? "not calibrated"/],
  ["failed loads are exposed as an error state", /role="alert"/],
  ["empty state does not claim no changes occurred", /This does not mean that no changes occurred/],
] as const) {
  assert(contract[1].test(panel), `Missing UI contract: ${contract[0]}`);
}

assert(
  /function requirePersonId\(\)[\s\S]*?getPersonId\(\)[\s\S]*?server-issued SolenOS care session is required/.test(api),
  "API requests must require the current server-issued care session",
);
assert(
  /getJSON\(\`\/change\/changes\/\$\{personId\}/.test(api),
  "Change listings must be read from the authoritative backend API",
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
