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
assert.match(component, /Your care record is ready to build/);
assert.match(component, /what_i_understood/);
assert.match(component, /ui_situations/);
assert.doesNotMatch(component, /sample care event|demo caregiver|fabricated/i);
assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR screen redirects to the Companion");
assert.doesNotMatch(legacyRoute, /PersistedCareOrientation|LCRCurrentUnderstanding|Record timeline/, "legacy route must not render the old LCR interface");
assert.match(component, /Your care record is ready to build/, "persisted care orientation remains implemented even though the old LCR page is no longer the workspace home");

console.log("Persisted-care orientation contract checks passed.");
