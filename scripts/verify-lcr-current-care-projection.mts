import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const workspace = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const timeline = fs.readFileSync("src/app/workspace/timeline/page.tsx", "utf8");

assert.match(workspace, /<LCRCurrentUnderstanding\s*\/>/, "LCR home must render the longitudinal projection");
assert.match(workspace, /Record timeline/, "chronological timeline remains a separate LCR section");
assert.match(component, /\/care-continuity\/current-care\?limit_per_source=12/, "LCR reads the canonical current-care projection");
assert.match(component, /read_only !== true/, "projection contract must identify itself as read-only");
assert.match(component, /result\.person_id !== session\.person\.id/, "projection identity must match the active session");
assert.match(component, /schema_status !== "complete"/, "incomplete source coverage must be visible");
assert.match(component, /missing_required_sources/, "required source gaps must not be hidden");
assert.match(component, /epistemic_status/, "epistemic status must remain visible");
assert.match(component, /source_label/, "source attribution must remain visible");
assert.match(component, /evidence_ids/, "linked evidence references must remain visible");
assert.match(component, /The timeline is not being used as a substitute/, "failed LCR reads must not silently fall back to the timeline");
assert.match(timeline, /\/events\//, "chronological timeline reads care events independently");
assert.doesNotMatch(component, /sample|demo|placeholder|fake care/i, "LCR projection must not fabricate sample care information");

console.log("✓ LCR home reads the backend's read-only current-care projection");
console.log("✓ Source coverage, epistemic status, attribution, and evidence references remain visible");
console.log("✓ Current-care projection failure is explicit and does not silently fall back to timeline");
