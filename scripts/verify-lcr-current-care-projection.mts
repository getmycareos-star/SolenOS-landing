import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const legacyRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const timeline = fs.readFileSync("src/app/workspace/timeline/page.tsx", "utf8");

assert.match(legacyRoute, /redirect\("\/workspace"\)/, "legacy LCR screen must not render as a separate workspace");
assert.doesNotMatch(legacyRoute, /<LCRCurrentUnderstanding|Record timeline|CognitiveWorkspace/, "legacy route must not expose the old LCR interface");
assert.match(component, /\/care-continuity\/current-care\?limit_per_source=12/, "LCR data projection remains implemented");
assert.match(component, /read_only !== true/, "projection contract must identify itself as read-only");
assert.match(component, /result\.person_id !== session\.person\.id/, "projection identity must match the active session");
assert.match(component, /schema_status !== "complete"/, "incomplete source coverage must be visible");
assert.match(component, /missing_required_sources/, "required source gaps must not be hidden");
assert.match(component, /epistemic_status/, "epistemic status must remain visible");
assert.match(component, /source_label/, "source attribution must remain visible");
assert.match(component, /evidence_ids/, "linked evidence references must remain visible");
assert.match(component, /The timeline is not being used as a substitute/, "failed LCR reads must not silently fall back to the timeline");
assert.match(timeline, /\/events\//, "chronological timeline continues to read care events independently");
assert.doesNotMatch(component, /sample|demo|placeholder|fake care/i, "LCR projection must not fabricate sample care information");

console.log("✓ legacy LCR screen redirects to the AI Companion rather than rendering as the main workspace");
console.log("✓ read-only current-care projection, provenance, uncertainty, and evidence contract remain intact");
console.log("✓ historical timeline remains independently implemented");
