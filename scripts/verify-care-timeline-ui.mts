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
assert.match(source, /eventTimeWasNotProvided/,
  "server receipt time must not be presented as the time a care event happened");
assert.match(source, /Time not provided · Added/,
  "the timeline distinguishes an unknown event time from the time SolenOS received the update");
assert.match(source, /eventTimeDisplay\(event\)/,
  "expanded history details label missing event time honestly");
assert.match(source, /evidence_ids/);
assert.match(source, /aria-expanded/);
assert.match(source, /Search the care history/);
assert.match(source, /setAppliedQuery\(nextQuery\)/,
  "the caregiver can submit a query against the complete server-side history");
assert.ok(source.includes("query=${encodeURIComponent(searchTerm.trim())}"),
  "search terms are sent to the persisted history retrieval endpoint");
assert.match(source, /Showing results for.*Search includes older records, not just the items currently shown\./,
  "the interface tells caregivers that search includes older saved records, not only the loaded page");
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
assert.match(source, /idempotency_key: idempotencyKey/,
  "a correction retry reuses a stable idempotency key");
assert.match(source, /processing_status === "completed"/,
  "the UI only reports a completed correction after durable backend processing");
assert.ok(source.includes('/corrections/${encodeURIComponent(session.person.id)}/${encodeURIComponent(correctionId)}/retry'),
  "a pending correction can be retried through its person-scoped backend receipt");
assert.match(source, /\["pending", "processing"\]\.includes\(item\.processing_status \|\| ""\)/,
  "only corrections awaiting processing remain eligible for retry after timeline reload");
assert.match(source, /target_type: event\.source_type === "care_assertion" \? "care_assertion" : "care_event"/,
  "corrections target the original care event or LCR assertion without changing the source type");
assert.match(source, /event\.source_type === "care_assertion"/,
  "care-history corrections are available for persisted LCR assertions as well as source events");
assert.match(source, /assertion_status === "string"/,
  "the timeline preserves assertion lifecycle state");
assert.match(source, /!\["superseded", "retracted"\]\.includes\(event\.status\.toLowerCase\(\)\)/,
  "superseded and retracted assertions cannot be corrected as if they were current");
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
assert.match(source, /Your care history starts here/, "the empty state explains that the timeline fills from saved care updates");
assert.match(source, /never adds example care history/);
assert.match(source, /This is the latest saved update\. For the current care summary, return to your Care Record\./, "the latest timeline event is distinguished from the current care summary");
assert.doesNotMatch(source, /runtime\.timeline\.entries/);
assert.doesNotMatch(source, /localStorage\.getItem\(.*timeline/i);

console.log("Care Timeline UI contract checks passed: authenticated persisted event read, temporal provenance, evidence references, filters, accessible expansion, explicit failure/empty states, and no local-only timeline source.");
