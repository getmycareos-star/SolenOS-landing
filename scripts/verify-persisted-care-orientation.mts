import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "src/app/workspace/page.tsx"), "utf8");

assert.match(component, /getAnonymousAccessToken/);
assert.match(component, /fetch\("\/api\/situation\?offer_return_invite=0"/);
assert.match(component, /response\.ok/);
assert.match(component, /Current record state could not be confirmed/);
assert.match(component, /no saved care events or evidence are available/i);
assert.match(component, /not supplied by this record-hydration response/);
assert.doesNotMatch(component, /sample care event|demo caregiver|fabricated/i);
assert.match(workspace, /<PersistedCareOrientation\s*\/>/);

console.log("Persisted-care orientation contract checks passed.");
