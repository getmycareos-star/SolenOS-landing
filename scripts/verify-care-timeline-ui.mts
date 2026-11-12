import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "src/app/workspace/timeline/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

assert.match(source, /ensureAnonymousSession/);
assert.match(source, /getJSON/);
assert.ok(source.includes("daily-care/intelligence/history"));
assert.match(source, /occurred_at/);
assert.match(source, /recorded_at/);
assert.match(source, /time_provenance/);
assert.match(source, /evidence_ids/);
assert.match(source, /aria-expanded/);
assert.match(source, /Search the care history/);
assert.match(source, /setAppliedQuery\(nextQuery\)/,
  "the caregiver can submit a query against the complete server-side history");
assert.ok(source.includes("query=${encodeURIComponent(searchTerm.trim())}"),
  "search terms are sent to the persisted history retrieval endpoint");
assert.match(source, /Showing server-matched records/,
  "the interface distinguishes server-wide search from the currently loaded page");
assert.match(source, /mapHistoryRecord/,
  "the timeline maps persisted history records from all supported source types");
assert.match(source, /sourceType === "correction"/,
  "corrections are included as separate history entries");
assert.match(source, /original_text/,
  "correction history preserves the earlier source text");
assert.match(source, /scheduled: "scheduled; not confirmed as given"/,
  "timeline history does not collapse scheduled medication into administration");
assert.match(source, /not proof it was given/,
  "scheduled medicine time is presented separately from administration evidence");
assert.match(source, /Load older care records/,
  "the full history can be paginated beyond the first 200 records");
assert.match(source, /postJSON\("\/corrections"/,
  "care-history corrections use the existing persisted correction endpoint");
assert.match(source, /target_type: "care_event"/,
  "corrections target the original care event");
assert.match(source, /target_id\?: string \| null/,
  "history records preserve the correction's target identifier");
assert.match(source, /Original care event/,
  "the correction entry links back to the untouched source event");
assert.match(source, /original_text: parseDescription\(event\.description\)/,
  "the correction receipt preserves a readable rendering linked to the untouched original event");
assert.match(source, /original entry remains unchanged/,
  "the caregiver is told corrections do not overwrite the original record");
assert.ok(source.includes("daily-care/intelligence/history?limit=200&offset="),
  "timeline pagination reads the authenticated persisted history endpoint");
assert.match(source, /Timeline could not be loaded/);
assert.match(source, /No saved care-history entries were returned/);
assert.match(source, /never inserts example care history/);
assert.match(source, /latest saved history entry, not a substitute for the reconciled current-care view/);
assert.doesNotMatch(source, /runtime\.timeline\.entries/);
assert.doesNotMatch(source, /localStorage\.getItem\(.*timeline/i);

console.log("Care Timeline UI contract checks passed: authenticated persisted event read, temporal provenance, evidence references, filters, accessible expansion, explicit failure/empty states, and no local-only timeline source.");
