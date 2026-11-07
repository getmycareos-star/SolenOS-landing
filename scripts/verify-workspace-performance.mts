import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const page = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const shell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");

assert.match(workspace, /\/care-continuity\/current-care\?limit_per_source=12/, "the persisted current-care projection remains the primary LCR data source");
assert.match(workspace, /setProjection\(currentCare as CurrentCareProjection\);\s*setLoading\(false\);\s*backgroundStarted = true;/, "the first usable LCR state must be released as soon as the current-care projection is validated");
assert.match(workspace, /Promise\.allSettled\(backgroundTasks\)/, "secondary LCR reads must settle independently instead of serially blocking the first screen");
assert.match(workspace, /\/registered-actions\//, "registered actions remain loaded");
assert.match(workspace, /\/change\/changes\//, "persisted change history remains loaded");
assert.match(workspace, /\/change\/patterns\//, "persisted patterns remain loaded");
assert.match(workspace, /situation-understanding\/reassess/, "the situation assessment remains refreshed");
assert.match(workspace, /const CareContinuityIntegrityPanel = dynamic/, "advanced integrity tools must be split from the initial module graph");
assert.match(workspace, /const EvidenceReviewPanel = dynamic/, "evidence review must be split from the initial module graph");
assert.match(workspace, /advancedPanelsOpen && \(/, "advanced review tools must not mount until the caregiver opens the section");
assert.match(workspace, /onToggle=\{\(event\) => setAdvancedPanelsOpen\(event\.currentTarget\.open\)\}/, "advanced review tools must load on explicit disclosure");
assert.match(shell, /href=\{href\}\s+prefetch=\{false\}/, "secondary workspace routes must not prefetch all route bundles on initial load");
assert.match(shell, /href="\/workspace\/settings"\s+prefetch=\{false\}/, "settings route bundle must not prefetch on initial load");
assert.match(page, /<LCRCurrentUnderstanding \/>/, "the canonical workspace route continues to render the LCR");
assert.doesNotMatch(workspace, /sample|demo|placeholder|fake care/i, "performance changes must not introduce fabricated care data");

console.log("✓ current-care projection is the first-screen dependency");
console.log("✓ secondary history and reassessments no longer block initial LCR readiness");
console.log("✓ advanced review modules are loaded only after explicit caregiver expansion");
console.log("✓ canonical LCR route and persisted-data safety contract remain intact");
