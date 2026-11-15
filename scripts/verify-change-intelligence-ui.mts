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
const historyPanel = fs.readFileSync(path.join(root, "src/components/mvp-workspace/CareChangeHistoryPanel.tsx"), "utf8");
const lcr = fs.readFileSync(path.join(root, "src/components/mvp-workspace/LCRCurrentUnderstanding.tsx"), "utf8");
const dailyCapture = fs.readFileSync(path.join(root, "src/components/workflows/StructuredDailyCapture.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const contract of [
  ["panel lists persisted changes", /listPersistedChanges\(\)/],
  ["panel lists persisted patterns", /listPersistedPatterns\(\)/],
  ["panel loads persisted care situations", /listPersistedSituations\(\)/],
  ["caregiver trajectory decisions are explicit and evidence-linked", /transitionSituationState\(situation\.id, targetState, reason, evidenceIds\)/],
  ["caregiver-facing status controls and history are present", /Caregiver-reported status[\s\S]*Previous status updates/],
  ["older change assessments can be loaded", /Load earlier changes/],
  ["older patterns can be loaded", /Load earlier patterns/],
  ["panel offers an explicit saved-assessment refresh", /Check for new changes/],
  ["manual refresh is visibly in progress", /Checking for new changes…/],
  ["panel keeps backend reassessment available for deliberate refresh", /reassessPersistedChangeIntelligence\(\)/],
  ["resolved decisions are restricted to cessation/disappearance with complete coverage", /\["cessation", "disappearance"\][\s\S]*?baseline_coverage_status === "covered"[\s\S]*?current_coverage_status === "covered"[\s\S]*?changeStatus\(change\.id, "resolved"\)/],
  ["historical assessments remain visible", /setChanges\(changeRows\)/],
  ["inactive assessments are labeled as history", /Past assessment/],
  ["change explanations use the caregiver-safe change language filter", /caregiverSafeChangeText\(change\.explanation\)/],
  ["change source details are user-reviewable", /Review source evidence/],
  ["pattern source details are user-reviewable", /Review pattern sources/],
  ["missing earlier information is not proof an event did not happen", /Earlier care information may be missing\. That does not mean the event did not happen\./],
  ["failed loads are exposed as an error state", /role="alert"/],
  ["empty state does not claim no changes occurred", /This does not mean that no changes occurred/],
] as const) {
  const matches = contract[1] instanceof RegExp ? contract[1].test(panel) : contract[1];
  assert(matches, `Missing UI contract: ${contract[0]}`);
}
assert(!/\bconfidence\b/i.test(panel), "uncalibrated model confidence must not be displayed in caregiver-facing change intelligence");
assert(!/changes\.slice\(0,\s*8\)/.test(panel), "change history must not be silently truncated to eight rows");
assert(!/patterns\.slice\(0,\s*8\)/.test(panel), "pattern history must not be silently truncated to eight rows");

const initialLoadStart = panel.indexOf("useEffect(() => {");
const initialLoadEnd = panel.indexOf("  return (", initialLoadStart);
assert(initialLoadStart >= 0 && initialLoadEnd > initialLoadStart, "initial persisted assessment load must exist");
const initialLoad = panel.slice(initialLoadStart, initialLoadEnd);
assert(
  !/reassessPersistedChangeIntelligence\(\)/.test(initialLoad),
  "opening the LCR must read persisted assessments without triggering a write/reassessment",
);
assert(
  /async function refreshSavedAssessments\(\)[\s\S]*?await reassessPersistedChangeIntelligence\(\)/.test(panel),
  "reassessment must be available only through the explicit refresh action",
);

assert(!/recordObservationCoverage|submitCoverage|Save observation coverage|lcr-coverage-editor|<form\b/.test(panel), "observation coverage cannot be independently submitted from this panel");

for (const [source, pattern, label] of [
  [historyPanel, /care-delta\/runs/, "saved Delta history must come from the backend"],
  [historyPanel, /offset=\$\{runs\.length\}/, "older saved comparisons must be paginated from the backend"],
  [historyPanel, /Load earlier comparisons/, "caregivers must be able to retrieve older saved comparisons"],
  [historyPanel, /change\.certainty === "supported"/, "only supported changes may be promoted"],
  [historyPanel, /change\.evidence_supported === true/, "promoted changes require source evidence"],
  [historyPanel, /change\.source_record_refs\.length > 0/, "promoted changes require linked source records"],
  [historyPanel, /What still needs checking/, "uncertain findings must remain visible as uncertain"],
  [historyPanel, /Reports that differ/, "conflicting reports must remain visible"],
  [historyPanel, /const comparisonCurrent = freshnessStatus === "current"/, "only explicitly current source history may be promoted"],
  [historyPanel, /const confirmed = comparisonCurrent \? changes\.filter\(supported\) : \[\]/, "stale or unchecked comparisons must not be presented as supported changes"],
  [historyPanel, /const needsReview = comparisonCurrent \? changes\.filter/, "all findings from stale or unchecked comparisons must remain review-only"],
  [historyPanel, /SolenOS could not confirm that the source history for this comparison is current/, "unchecked source freshness must be disclosed to caregivers"],
  [lcr, /<CareChangeHistoryPanel personId=\{personId\} \/>/, "saved comparisons must appear in the primary LCR"],
  [lcr, /careHistoryOpen \? \([\s\S]*?<ChangeIntelligencePanel \/>[\s\S]*?<CareChangeHistoryPanel personId=\{personId\} \/>/, "persisted change intelligence and Delta history must appear together in earlier care history"],
  [historyPanel, /if \(!personId\) return null/, "history must wait for a scoped care record"],
]) {
  assert(pattern.test(source), "Missing persisted care-change contract: " + label);
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
  /new URLSearchParams\(\{ limit: String\(limit\), offset: String\(offset\) \}\)/.test(api),
  "change and pattern history reads must support server-side pagination",
);
assert(
  /getJSON\(\`\/change\/patterns\/\$\{personId\}/.test(api),
  "Pattern listings must be read from the authoritative backend API",
);
assert(
  /getJSON\(\`\/change\/situations\/\$\{personId\}/.test(api),
  "Care situations must be read from the authoritative backend API",
);
assert(
  /postJSON\(\s*\`\/change\/situations\/\$\{personId\}\/\$\{encodeURIComponent\(situationId\)\}\/state\`/.test(api),
  "Caregiver trajectory updates must use the person-scoped backend API",
);
assert(
  /postJSON\(\`\/change\/changes\/reassess\?person_id=\$\{personId\}/.test(api),
  "Reassessment must invoke the backend, not the local pattern mock",
);
assert(
  !/runPatternEngine|runPatternIntelligence|resetPatternIntelligenceStore/.test(panel),
  "The live panel must not synthesize findings with the local pattern-intelligence store",
);

assert(
  /medications: variables\.medications\.map/.test(dailyCapture) &&
  /scheduled_for: med\.scheduled_for \? new Date\(med\.scheduled_for\)\.toISOString\(\) : null/.test(dailyCapture) &&
  /administered_at: med\.administered_at \? new Date\(med\.administered_at\)\.toISOString\(\) : null/.test(dailyCapture) &&
  /measured_at: new Date\(vital\.measured_at\)\.toISOString\(\)/.test(dailyCapture) &&
  /observed_at: new Date\(scale\.observed_at\)\.toISOString\(\)/.test(dailyCapture),
  "Daily Capture Delta reconciliation must use the same normalized timestamps persisted in the care event",
);

console.log("CHANGE_INTELLIGENCE_UI_CONTRACT=PASS");
console.log("Scope=persisted change/pattern/situation history + caregiver-confirmed trajectory + Delta history + primary LCR contract");
console.log("Scope=source contract only; browser rendering and live production API remain separate gates");
