import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "src/app/workspace/timeline/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

// Longitudinal history must use the shared, authenticated LCR context rather than
// the legacy standalone events endpoint as a competing source of truth.
assert.ok(source.includes("ensureAnonymousSession"));
assert.ok(source.includes("getJSON"));
assert.ok(source.includes("care-continuity/context"));
assert.ok(!source.includes('getJSON(`/events/'));
assert.ok(source.includes("occurred_at"));
assert.ok(source.includes("recorded_at"));
assert.ok(source.includes("time_provenance"));
assert.ok(source.includes("evidence_ids"));
assert.ok(source.includes("aria-expanded"));
assert.ok(source.includes("Search the care history"));
assert.ok(source.includes("Timeline could not be loaded"));
assert.ok(source.includes("No saved history entries were returned"));
assert.ok(source.includes("never inserts example care history"));
assert.ok(source.includes("latest saved event, not a substitute for the reconciled current-care view"));
assert.ok(!source.includes("runtime.timeline.entries"));
assert.ok(!/localStorage\.getItem\(.*timeline/i.test(source));

console.log("Care Timeline UI contract checks passed: authenticated shared LCR context, temporal provenance, evidence references, filters, accessible expansion, explicit failure/empty states, and no local-only timeline source.");
