import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const legacyRoute = fs.readFileSync(path.join(root, "src/app/workspace/record/page.tsx"), "utf8");

assert.match(component, /ensureAnonymousSession/);
assert.match(component, /fetch\(`\/api\/situation\?\${params\.toString\(\)}`/);
assert.match(component, /response\.ok/);
assert.match(component, /We couldn't load your care information/);
assert.match(component, /Your Living Care Record does not have any care information available yet/);
assert.match(component, /Information reviewed and approved there will appear in your care record/);
assert.match(component, /workspace\/companion/);
assert.doesNotMatch(component, /Your care record is ready to build|Add a note, daily update, or document/);
assert.doesNotMatch(component, /aria-label="Refresh saved care context"|setAttempt|RefreshCw/);
assert.doesNotMatch(component, /Confidence: \{situationAssessment/);
assert.match(component, /There is not enough information for a reliable assessment/);
assert.match(component, /No observation coverage has been recorded yet/);
assert.doesNotMatch(component, /What remains unresolved:.*open loop/);
assert.match(component, /what_i_understood/);
assert.match(component, /ui_situations/);
assert.doesNotMatch(component, /sample care event|demo caregiver|fabricated/i);
assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR screen redirects to the Companion");
assert.doesNotMatch(legacyRoute, /PersistedCareOrientation|LCRCurrentUnderstanding|Record timeline/, "legacy route must not render the old LCR interface");
assert.doesNotMatch(component, /Your care record is ready to build/, "empty records must not be framed as ready to build or as an invitation to create a second record");

console.log("Persisted-care orientation contract checks passed.");
