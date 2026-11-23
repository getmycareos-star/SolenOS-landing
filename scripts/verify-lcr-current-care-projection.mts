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
assert.match(loadBody, /Promise\.allSettled\(backgroundTasks\)/, "secondary caregiver sections must load concurrently without blocking first paint");
assert.doesNotMatch(loadBody, /postJSON\(/, "initial LCR hydration must not trigger reassessment or any other writes");
assert.doesNotMatch(loadBody, /postJSON\(/, "initial LCR hydration must remain read-only");
assert.ok(component.includes("await load(true);") && component.includes("await refreshSituationAssessment();"), "care-record writes trigger a refreshed assessment after the read-only sections reload");
assert.match(loadBody, /solenos\.workspace\.first-care-ready/, "first-care readiness must be measurable locally");
assert.match(loadBody, /solenos\.journey\.landing-to-first-care/, "landing-to-care readiness must be measurable locally");

const refreshStart = component.indexOf("const refreshSituationAssessment = useCallback(async (): Promise<boolean> => {");
const refreshEnd = component.indexOf("}, []);", refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, "manual care reassessment must be a stable callback");
const refreshBody = component.slice(refreshStart, refreshEnd);
assert.ok(refreshBody.includes("ensureAnonymousSession()"), "reassessment must resolve the active server session instead of capturing stale component state");
assert.ok(component.includes("const refreshWholeRecord = useCallback(async () => {"), "care-write refresh orchestration must be memoized");
assert.ok(component.includes("}, [refreshSituationAssessment, load]);"), "refresh orchestration must track its stable dependencies");
assert.ok(component.includes("}, [load, refreshWholeRecord]);"), "care-write listener must subscribe to the stable refresh orchestration callback");

assert.match(component, /schema_status !== "complete"/, "incomplete source coverage must be visible");
assert.match(component, /missing_required_sources/, "required source gaps must not be hidden");
assert.match(component, /epistemic_status/, "epistemic status must remain visible");
assert.match(component, /source_label/, "source attribution must remain visible");
assert.match(component, /evidence_ids/, "linked evidence references must remain visible");
assert.match(component, /We couldn’t load this care information\. Check your connection and try again/, "failed LCR reads must use caregiver-readable recovery guidance");
assert.match(component, /<details className="lcr-entry-status">\s*<summary>More about this information<\/summary>[\s\S]*?item\.evidence_assessments/, "source and assessment details remain collapsed behind a caregiver-readable disclosure");
assert.doesNotMatch(component, /LONGITUDINAL RECORD|No current-care items were returned|Record coverage is incomplete/, "caregiver-facing LCR copy must not expose internal terminology");
assert.match(timeline, /\/daily-care\/intelligence\/history\?limit=200/, "chronological timeline reads the persisted care-history endpoint independently");
assert.doesNotMatch(component, /sample|demo|placeholder|fake care/i, "LCR projection must not fabricate sample care information");

console.log("✓ legacy LCR screen redirects to the AI Companion rather than rendering as the main workspace");
console.log("✓ read-only current-care projection, provenance, uncertainty, and evidence contract remain intact");
console.log("✓ historical timeline remains independently implemented");

assert.match(component, /"unsearchable"[\s\S]*?couldn’t be searched for this question; no conclusion can be drawn from this source/, "an unsearchable care source must be disclosed and remain distinct from an empty source");
assert.match(component, /\["failed", "partial", "unsearchable", "unavailable_schema", "unavailable_scope"\]/, "retrying an unsearchable source must not clear the incomplete-retrieval warning");
assert.match(component, /projection\.items\.length === 0 \?[\s\S]*?No matching care details were returned from the sources we could check\. This does not mean the unavailable sources have no relevant information\./, "an empty projection with incomplete sources must not be presented as an empty Care Record");

assert.match(component, /caregiverIdRef\.current !== session\.caregiver\.id[\s\S]*?setEvidenceIntegrityByFact\(\{\}\)/, "private LCR review state must be cleared when the active caregiver changes, even for the same person");
assert.match(component, /addEventListener\("personIdChanged", refreshAfterSessionChange\)/, "the Living Care Record must reload when the active person or caregiver session changes");

assert.match(component, /const isCurrentRequest = \(\) => timingId === workspaceLoadSequence[\s\S]*?if \(!isCurrentRequest\(\)\) return[\s\S]*?if \(isCurrentRequest\(\)\) setLoading\(false\)/, "overlapping LCR reads must not let an older caregiver session overwrite the current Care Record");
