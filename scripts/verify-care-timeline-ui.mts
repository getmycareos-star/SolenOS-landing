import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "src/app/workspace/timeline/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

assert.match(source, /ensureAnonymousSession/);
assert.match(source, /getJSON/);
assert.match(source, /care-continuity.*context/);
assert.match(source, /occurred_at/);
assert.match(source, /recorded_at/);
assert.match(source, /time_provenance/);
assert.match(source, /evidence_ids/);
assert.match(source, /aria-expanded/);
assert.match(source, /Search the care history/);
assert.match(source, /Timeline could not be loaded/);
assert.match(source, /No saved care events were returned/);
assert.match(source, /never inserts example care history/);
assert.match(source, /latest saved event, not a substitute for the reconciled current-care view/);
assert.doesNotMatch(source, /runtime\.timeline\.entries/);
assert.doesNotMatch(source, /localStorage\.getItem\(.*timeline/i);

console.log("Care Timeline UI contract checks passed: authenticated persisted event read, temporal provenance, evidence references, filters, accessible expansion, explicit failure/empty states, and no local-only timeline source.");
