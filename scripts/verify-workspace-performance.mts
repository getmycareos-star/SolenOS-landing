import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const page = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const shell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");

const initialLoad = workspace.slice(workspace.indexOf("const load = useCallback"), workspace.indexOf("const transitionConfirmation"));
assert.match(initialLoad, /\/care-continuity\/current-care\?limit_per_source=12/, "the current-care projection must be the primary LCR request");
assert.match(initialLoad, /setProjection\(currentCare as CurrentCareProjection\);\s*setLoading\(false\);\s*backgroundStarted = true;/, "the first usable care view must render immediately after the projection validates");
assert.match(initialLoad, /Promise\.allSettled\(backgroundTasks\)/, "secondary reads must not block the first screen");
assert.doesNotMatch(initialLoad, /postJSON\(.*reassess/, "opening the LCR must not trigger automatic reassessment writes");
assert.match(initialLoad, /getJSON\("\/care-continuity\/situation-understanding"\)/, "the last saved assessment must be reused");
assert.match(workspace, /const CareContinuityIntegrityPanel = dynamic/, "advanced integrity tools must be deferred");
assert.match(workspace, /const EvidenceReviewPanel = dynamic/, "evidence review must be deferred");
assert.match(workspace, /advancedPanelsOpen && \(/, "advanced review components must mount only after explicit expansion");
assert.match(shell, /href=\{href\}\s+prefetch=\{false\}/, "secondary routes must not prefetch on initial workspace load");
assert.match(shell, /href="\/workspace\/settings"\s+prefetch=\{false\}/, "settings must not prefetch on initial workspace load");
assert.match(page, /<LCRCurrentUnderstanding \/>/, "the canonical workspace route must continue to render the LCR");
assert.doesNotMatch(workspace, /sample|demo|placeholder|fake care/i, "performance changes must not introduce fabricated care data");

console.log("✓ current-care projection is the first-screen dependency");
console.log("✓ secondary LCR hydration is concurrent and read-only");
console.log("✓ advanced review modules load only after caregiver expansion");
console.log("✓ secondary workspace routes are not prefetched on mobile");
