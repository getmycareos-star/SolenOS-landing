import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const legacyRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const timeline = fs.readFileSync("src/app/workspace/timeline/page.tsx", "utf8");

assert.match(legacyRoute, /redirect\("\/workspace"\)/, "legacy LCR screen must not render as a separate workspace");
assert.doesNotMatch(legacyRoute, /<LCRCurrentUnderstanding|Record timeline|CognitiveWorkspace/, "legacy route must not expose the old LCR interface");
assert.match(component, /\/care-continuity\/current-care\?limit_per_source=12/, "LCR data projection remains implemented");
assert.match(component, /read_only !== true/, "projection contract must identify itself as read-only");
assert.match(component, /currentCare\.person_id !== scopedPersonId/, "projection identity must match the active session");
const loadStart = component.indexOf("const load = useCallback(async (manual = false) => {");
const loadEnd = component.indexOf("const transitionConfirmation = useCallback(async (", loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, "caregiver load lifecycle must be identifiable for regression checks");
const loadBody = component.slice(loadStart, loadEnd);
assert.match(loadBody, /const currentCare = await getJSON\("\/care-continuity\/current-care\?limit_per_source=12"\)/, "validated current care must be the first blocking data request");
assert.ok(
  loadBody.indexOf("setProjection(currentCare as CurrentCareProjection);") >= 0 &&
  loadBody.indexOf("setProjection(currentCare as CurrentCareProjection);") < loadBody.indexOf("setLoading(false);"),
  "first caregiver view must be released immediately after the validated projection and its non-blocking local timing mark",
);
assert.match(loadBody, /void Promise\.allSettled\(backgroundTasks\)/, "secondary caregiver sections must load concurrently without blocking first paint");
assert.doesNotMatch(loadBody, /postJSON\(/, "initial LCR hydration must not trigger reassessment or any other writes");
assert.match(loadBody, /solenos\.workspace\.first-care-ready/, "first-care readiness must be measurable locally");
assert.match(loadBody, /solenos\.journey\.landing-to-first-care/, "landing-to-care readiness must be measurable locally");

assert.match(component, /schema_status !== "complete"/, "incomplete source coverage must be visible");
assert.match(component, /missing_required_sources/, "required source gaps must not be hidden");
assert.match(component, /epistemic_status/, "epistemic status must remain visible");
assert.match(component, /source_label/, "source attribution must remain visible");
assert.match(component, /evidence_ids/, "linked evidence references must remain visible");
assert.match(component, /We couldn’t load this care information\. Check your connection and try again/, "failed LCR reads must use caregiver-readable recovery guidance");
assert.match(component, /<summary>Where this information came from<\/summary>/, "source and assessment details remain collapsed behind a caregiver-readable disclosure");
assert.doesNotMatch(component, /LONGITUDINAL RECORD|No current-care items were returned|Record coverage is incomplete/, "caregiver-facing LCR copy must not expose internal terminology");
assert.match(timeline, /\/daily-care\/intelligence\/history\?limit=200/, "chronological timeline reads the persisted care-history endpoint independently");
assert.doesNotMatch(component, /sample|demo|placeholder|fake care/i, "LCR projection must not fabricate sample care information");

console.log("✓ legacy LCR screen redirects to the AI Companion rather than rendering as the main workspace");
console.log("✓ read-only current-care projection, provenance, uncertainty, and evidence contract remain intact");
console.log("✓ historical timeline remains independently implemented");
