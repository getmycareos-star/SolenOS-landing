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
assert.match(component, /is-new-caregiver/);
assert.match(component, /is-returning-caregiver/);
assert.match(component, /You can start with what you remember/);
assert.match(component, /Pick up where you left off/);
assert.match(component, /Your care information isn.t available right now/);
assert.match(component, /what_i_understood/);
assert.match(component, /ui_situations/);
assert.doesNotMatch(component, /sample care event|demo caregiver|fabricated/i);
assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR screen redirects to the Companion");
assert.doesNotMatch(legacyRoute, /PersistedCareOrientation|LCRCurrentUnderstanding|Record timeline/, "legacy route must not render the old LCR interface");
assert.match(component, /Start with one detail/, "new caregivers get a direct first action");
assert.match(component, /Add a care update/, "returning caregivers can continue their saved record");

console.log("Persisted-care orientation contract checks passed.");
