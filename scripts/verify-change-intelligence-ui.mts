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
const timeline = fs.readFileSync(path.join(root, "src/app/workspace/timeline/page.tsx"), "utf8");
const dailyCapture = fs.readFileSync(path.join(root, "src/components/workflows/StructuredDailyCapture.tsx"), "utf8");
const caregiverLanguage = fs.readFileSync(path.join(root, "src/lib/caregiver-language.ts"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const contract of [
  ["panel lists persisted changes within its person scope", /listPersistedChanges\(undefined, 100, 0, personId\)/],
  ["panel lists persisted patterns within its person scope", /listPersistedPatterns\(undefined, 100, 0, personId\)/],
  ["panel loads persisted care situations within its person scope", /listPersistedSituations\(personId\)/],
  ["caregiver trajectory decisions are explicit and evidence-linked", /transitionSituationState\(situation\.id, targetState, reason, evidenceIds, personId\)/],
  ["caregiver-facing status controls and history are present", /Status shared by caregiver[\s\S]*Earlier updates/],
  ["care situation source details can be loaded", /getPersistedSituationDetail\(situationId, personId\)/],
  ["care situation linked records are reviewable", /Review related notes and documents[\s\S]*source_records\.map/],
  ["caregiver status history is visible", /state_history/],
  ["panel is bound to the displayed person", /export function ChangeIntelligencePanel\(\{ personId \}: \{ personId: string \}\)/],
  ["panel reloads when the displayed person changes", /\}, \[personId\]\);/],
  ["completed Daily Care processing refreshes persisted change assessments", /window\.addEventListener\("careRecordUpdated", refreshAfterSavedCareUpdate\)/],
  ["automatic refresh reads saved assessments without running a second reconciliation", /refreshAfterSavedCareUpdate[\s\S]*?listPersistedChanges\(undefined, 100, 0, personId\)[\s\S]*?listPersistedPatterns\(undefined, 100, 0, personId\)[\s\S]*?listPersistedSituations\(personId\)/],
  ["caregiver change panel removes its refresh listener on unmount", /window\.removeEventListener\("careRecordUpdated", refreshAfterSavedCareUpdate\)/],
  ["stale person responses are discarded", /personIdRef\.current !== personId/],
  ["older change assessments can be loaded", /Load earlier changes/],
  ["older patterns can be loaded", /Load earlier changes/],
  ["panel offers an explicit saved-assessment refresh", /Check for updates/],
  ["manual refresh is visibly in progress", /Checking for updates…/],
  ["panel keeps backend reassessment available for deliberate refresh", /reassessPersistedChangeIntelligence\(personId\)/],
  ["resolved decisions are restricted to cessation/disappearance with complete coverage", /\["cessation", "disappearance"\][\s\S]*?baseline_coverage_status === "covered"[\s\S]*?current_coverage_status === "covered"[\s\S]*?changeStatus\(change\.id, "resolved"\)/],
  ["historical assessments remain visible", /setChanges\(changeRows\)/],
  ["inactive reviews remain in the care history", /Earlier review/],
  ["change explanations use the caregiver-safe change language filter", /caregiverSafeChangeText\(change\.explanation\)/],
  ["change source details are user-reviewable", /See the notes and documents/],
  ["pattern source details are user-reviewable", /Review notes and updates/],
  ["missing earlier information is not proof an event did not happen", /Some earlier care information may be missing\. That does not mean the event did not happen\./],
  ["failed loads are exposed as an error state", /role="alert"/],
  ["empty state does not claim no changes occurred", /This does not mean nothing changed/],
] as const) {
  const matches = contract[1] instanceof RegExp ? contract[1].test(panel) : contract[1];
  assert(matches, `Missing UI contract: ${contract[0]}`);
}
assert(!/\bconfidence\b/i.test(panel), "uncalibrated model confidence must not be displayed in caregiver-facing change intelligence");
assert(!/changes\.slice\(0,\s*8\)/.test(panel), "change history must not be silently truncated to eight rows");
assert(!/patterns\.slice\(0,\s*8\)/.test(panel), "pattern history must not be silently truncated to eight rows");

assert(/classification\?: string/.test(historyPanel), "persisted Delta classifications must reach caregiver history");
assert(/claim_supported === true/.test(historyPanel), "only positively supported claims may be presented as established changes");
assert(/potential_worsening: "May be getting worse"/.test(historyPanel), "possible worsening must remain qualified");
assert(/potential_improvement: "May be improving"/.test(historyPanel), "possible improvement must remain qualified");
assert(/potential_resolution: "May no longer be happening"/.test(historyPanel), "possible resolution must remain qualified");
assert(/source_reference_status === "partial"/.test(historyPanel), "partial source matching must be disclosed");
assert(/Review available source details/.test(historyPanel), "review-only findings must expose available source records");
for (const [term, expected] of [
  ["potential_worsening", "May be getting worse"],
  ["potential_improvement", "May be improving"],
  ["potential_resolution", "May no longer be happening"],
  ["recurring", "Happening again"],
] as const) {
  assert(caregiverLanguage.includes(`${term}: "${expected}"`), `caregiver label for ${term} must preserve uncertainty`);
}

const initialLoadStart = panel.indexOf("useEffect(() => {");
const initialLoadEnd = panel.indexOf("  return (", initialLoadStart);
assert(initialLoadStart >= 0 && initialLoadEnd > initialLoadStart, "initial persisted assessment load must exist");
const initialLoad = panel.slice(initialLoadStart, initialLoadEnd);
assert(
  !/reassessPersistedChangeIntelligence\(\)/.test(initialLoad),
  "opening the LCR must read persisted assessments without triggering a write/reassessment",
);
assert(
  /async function refreshSavedAssessments\(\)[\s\S]*?await reassessPersistedChangeIntelligence\(personId\)/.test(panel),
  "reassessment must be available only through the explicit refresh action",
);

assert(!/recordObservationCoverage|submitCoverage|Save observation coverage|lcr-coverage-editor|<form\b/.test(panel), "observation coverage cannot be independently submitted from this panel");

for (const [source, pattern, label] of [
  [historyPanel, /care-delta\/runs/, "saved Delta history must come from the backend"],
  [historyPanel, /offset=\$\{runs\.length\}/, "older saved comparisons must be paginated from the backend"],
  [historyPanel, /Load earlier comparisons/, "caregivers must be able to retrieve older saved comparisons"],
  [historyPanel, /change\.certainty === "supported"/, "only supported changes may be promoted"],
  [historyPanel, /change\.evidence_supported === true/, "promoted changes require source evidence"],
  [historyPanel, /change\.claim_supported === true/, "promoted changes require affirmative backend claim support"],
  [historyPanel, /change\.source_record_refs\.length > 0/, "promoted changes require linked source records"],
  [historyPanel, /What still needs checking/, "uncertain findings must remain visible as uncertain"],
  [historyPanel, /Reports that differ/, "conflicting reports must remain visible"],
  [historyPanel, /const comparisonCurrent = freshnessStatus === "current"/, "only explicitly current source history may be promoted"],
  [historyPanel, /const confirmed = comparisonCurrent \? changes\.filter\(supported\) : \[\]/, "stale or unchecked comparisons must not be presented as supported changes"],
  [historyPanel, /const needsReview = comparisonCurrent \? changes\.filter/, "all findings from stale or unchecked comparisons must remain review-only"],
  [historyPanel, /SolenOS could not confirm that the source history for this comparison is current/, "unchecked source freshness must be disclosed to caregivers"],
  [timeline, /<CareChangeHistoryPanel personId=\{personId\} \/>/, "saved comparisons must appear in the dedicated Care Timeline"],
  [timeline, /<ChangeIntelligencePanel personId=\{personId\} \/>[\s\S]*?<CareChangeHistoryPanel personId=\{personId\} \/>/, "persisted change intelligence and Delta history must appear together in the historical view"],
  [lcr, /<section className="lcr-record-section" aria-labelledby="lcr-current-understanding-heading">[\s\S]*?<h2 id="lcr-current-understanding-heading">Your Living Care Record<\/h2>[\s\S]*?<section className="lcr-first-screen-summary" aria-label="Care at a glance">/, "the Care Record remains the current-understanding view"],
  [historyPanel, /if \(!personId\) return null/, "history must wait for a scoped care record"],
]) {
  assert(pattern.test(source), "Missing persisted care-change contract: " + label);
}

assert(
  /function requirePersonId\(requestedPersonId\?\: string\)[\s\S]*?requestedPersonId !== activePersonId/.test(api),
  "Change intelligence requests must reject a person id outside the active caregiver session",
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
  /getJSON\(\`\/change\/situations\/\$\{personId\}\/\$\{encodeURIComponent\(situationId\)\}\/detail\`/.test(api),
  "Situation evidence details must be read from the person-scoped backend API",
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
  !/CareDeltaPanel|deltaAutoInput|care-delta\/reconcile/.test(dailyCapture),
  "Daily Care must not launch a second browser-side Delta reconciliation; the persisted backend worker owns the authoritative processing path",
);
assert(
  /window\.dispatchEvent\(new Event\('careRecordUpdated'\)\)/.test(dailyCapture),
  "a confirmed Daily Care save must refresh the existing persisted LCR projections",
);
assert(
  /deltaCompleted = \["completed", "not_applicable"\]\.includes\(execution\.delta_reconciliation \|\| ""\)/.test(dailyCapture)
    && /longitudinalProcessingCompleted = \["completed", "not_applicable"\]\.includes\(execution\.longitudinal_processing \|\| ""\)/.test(dailyCapture),
  "change intelligence must remain unavailable until Delta and longitudinal processing are complete",
);

console.log("CHANGE_INTELLIGENCE_UI_CONTRACT=PASS");
console.log("Scope=persisted change/pattern/situation history + caregiver-confirmed trajectory + archived Delta history + single Daily Care reconciliation + primary LCR contract");
console.log("Scope=source contract only; browser rendering and live production API remain separate gates");
