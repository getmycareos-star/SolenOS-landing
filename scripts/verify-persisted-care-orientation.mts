import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const legacyRoute = fs.readFileSync(path.join(root, "src/app/workspace/record/page.tsx"), "utf8");

// The orientation surface must consume the same authenticated, read-only LCR
// projection as the primary Care Continuity screen.
assert.match(component, /ensureAnonymousSession/);
assert.match(component, /getJSON\("\/care-continuity\/current-care\?limit_per_source=12"\)/);
assert.match(component, /projection_type !== "bounded_evidence_derived_current_care"/);
assert.match(component, /data\.read_only !== true/);
assert.match(component, /data\.person_id !== session\.person\.id/);
assert.match(component, /Array\.isArray\(data\.items\)/);
assert.match(component, /item\.source_collection/);
assert.match(component, /item\.epistemic_status/);
assert.match(component, /item\.evidence_ids/);
assert.match(component, /Your Living Care Record does not have any care information available yet/);
assert.match(component, /Add a care update/);
assert.match(component, /Some parts of the record may not be available in this view/);
assert.match(component, /Missing information does not mean that nothing happened/);
assert.match(component, /Try again/);

// Reading the orientation screen must not trigger a write/reassessment.
assert.doesNotMatch(component, /situation-understanding\/reassess|postJSON|setSituationAssessment/);
assert.doesNotMatch(component, /fetch\(\x60\/api\/situation/);
assert.doesNotMatch(component, /Confidence:|Assessment status:/);
assert.doesNotMatch(component, /sample care event|demo caregiver|fabricated/i);
assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR screen redirects to the workspace");
assert.doesNotMatch(legacyRoute, /PersistedCareOrientation|LCRCurrentUnderstanding|Record timeline/, "legacy route must not render the old LCR interface");

console.log("Persisted-care orientation contract checks passed.");
