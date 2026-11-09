import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const shell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const documents = fs.readFileSync("src/app/workspace/documents/page.tsx", "utf8");
const start = workspace.indexOf("const load = useCallback");
const end = workspace.indexOf("const transitionConfirmation", start);
assert.ok(start >= 0 && end > start, "the LCR load callback must exist");
const load = workspace.slice(start, end);

assert.match(load, /\/care-continuity\/current-care\?limit_per_source=12/, "current-care projection must be the first blocking read");
assert.match(load, /setProjection\(currentCare as CurrentCareProjection\);\s*setLoading\(false\);\s*backgroundStarted = true;/, "the first caregiver screen must release after the validated projection");
assert.match(load, /Promise\.allSettled\(backgroundTasks\)/, "secondary reads must run independently in the background");
assert.doesNotMatch(load, /postJSON\(.*reassess/, "opening the LCR must not write reassessment results");
assert.match(load, /getJSON\("\/care-continuity\/situation-understanding"\)/, "initial hydration must read the last saved situation assessment");
assert.match(workspace, /const EvidenceReviewPanel = dynamic/, "evidence review must be code-split");
assert.match(workspace, /const ClaimAssessmentPanel = dynamic/, "claim review must be code-split");
assert.match(workspace, /advancedPanelsOpen && \(/, "advanced review tools must mount only after explicit expansion");
assert.match(workspace, /onToggle=\{\(event\) => setAdvancedPanelsOpen\(event\.currentTarget\.open\)\}/, "advanced review expansion must control mounting");
assert.match(shell, /href=\{href\}\s+prefetch=\{false\}/, "workspace navigation must not prefetch every route at initial load");
assert.match(shell, /href="\/workspace\/settings"\s+prefetch=\{false\}/, "settings must not prefetch on initial load");
assert.match(documents, /setTimeout\(\(\) => controller\.abort\(\), 120_000\)/, "browser-side non-text document extraction must not be cancelled by the former 40-second deadline");

console.log("LCR performance contract passed: projection-first readiness, read-only background hydration, deferred review panels and no speculative route prefetch.");
