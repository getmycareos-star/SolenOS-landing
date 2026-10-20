/**
 * verify-time-model.mts
 * Dual time model — event_time vs ingestion_time, dual ordering, re-timing.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import {
  getCareContextRoot,
  processSituationInput,
  resetCareContextRootStore,
  updateEventTimeInContext,
} from "../src/lib/situation-entry";
import { getSituationTimeline } from "../src/lib/situation-entry/pipeline";
import {
  applyEventTimeCorrection,
  createExactEventTime,
  formatEventTimeLabel,
  parseEventTimeFromText,
  resetTimeCorrectionStore,
  resolveLateArrival,
  sortByIngestionOrder,
  sortByTemporalOrder,
  TIME_MODEL_IDENTITY,
} from "../src/lib/time-model";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Time Model (Dual Timestamp) ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetTimeCorrectionStore();

assert(TIME_MODEL_IDENTITY.includes("interpretation"), "time model identity");
console.log("✓ system contract");

const parsedRange = parseEventTimeFromText(
  "Mom fell sometime last week",
  "2026-06-28T12:00:00.000Z",
);
assert(parsedRange.event_time.type === "range", "uncertain time → range");
assert(parsedRange.event_time.confidence <= 0.6, "range has reduced confidence");
assert(parsedRange.clarification_question !== null, "generates clarification for uncertain time");
console.log("✓ uncertain time handling");

const caregiverId = "cg_time_model";
const ingestA = "2026-07-10T10:00:00.000Z";
const ingestB = "2026-07-14T10:00:00.000Z";

await processSituationInput({
  raw_input: "Mom fell yesterday and hasn't been eating properly",
  caregiver_id: caregiverId,
  timestamp: ingestA,
});

await processSituationInput({
  raw_input: "Insurance rejected the claim yesterday",
  caregiver_id: caregiverId,
  timestamp: ingestB,
});

const ctx = getCareContextRoot(caregiverId)!;
assert(ctx.events.length >= 2, "multiple events stored");

for (const event of ctx.events) {
  assert(event.event_time !== undefined, "event_time present");
  assert(event.ingestion_time !== undefined, "ingestion_time present");
  assert(typeof event.timestamp === "string", "temporal sort key present");
}

const fallEvent = ctx.events.find((e) => /fell/i.test(e.raw_input));
assert(fallEvent !== undefined, "fall event exists");
assert(
  ctx.events.some((e) => e.ingestion_time === ingestB),
  "second ingest batch preserved separate ingestion_time",
);

const temporal = sortByTemporalOrder(ctx.events);
const ingestion = sortByIngestionOrder(ctx.events);
assert(temporal.length === ctx.events.length, "temporal order preserves all events");
assert(ingestion.length === ctx.events.length, "ingestion order preserves all events");

const timelines = getSituationTimeline(caregiverId);
assert(timelines.temporal_timeline.length >= 2, "temporal timeline returned");
assert(timelines.ingestion_timeline.length >= 2, "ingestion timeline returned");
assert(
  timelines.timeline_views.ingestion_order[0] === ingestion[0]!.id,
  "ingestion view matches ingestion sort",
);
console.log("✓ dual ordering — temporal vs ingestion never conflated");

const june12 = createExactEventTime("2026-06-12T12:00:00.000Z");
const retime = updateEventTimeInContext(caregiverId, fallEvent!.id, june12);
assert(retime !== null, "retime succeeds");
assert(retime!.correction.previous_event_time.type !== "unknown", "correction records previous time");
assert(retime!.correction.updated_event_time.start === june12.start, "correction records new time");
assert(
  retime!.context.events.find((e) => e.id === fallEvent!.id)!.ingestion_time === fallEvent!.ingestion_time,
  "retrospective update preserves ingestion_time",
);

const correction = applyEventTimeCorrection({
  eventId: fallEvent!.id,
  previousEventTime: retime!.correction.updated_event_time,
  updatedEventTime: createExactEventTime("2026-06-10T12:00:00.000Z"),
  reason: "user_correction",
});
assert(correction.reason === "user_correction", "correction event type");
console.log("✓ re-timing via correction — no silent overwrite");

const lateMatch = resolveLateArrival({
  documentText: "Hospital report: patient fell last week and was admitted",
  ingestionTime: ingestB,
  existingEvents: ctx.events.map((e) => ({
    id: e.id,
    raw_input: e.raw_input,
    event_time: e.event_time,
    ingestion_time: e.ingestion_time,
  })),
});
assert(
  lateMatch.action === "attach_to_existing" || lateMatch.action === "create_backdated",
  "late arrival resolves attach or backdate",
);
console.log("✓ late arrival rule");

assert(formatEventTimeLabel({ type: "unknown", confidence: 0 }) === "Time unknown", "unknown label");
console.log("✓ timeline labels");

const required = [
  "src/lib/time-model/index.ts",
  "src/lib/time-model/types.ts",
  "src/lib/time-model/ordering.ts",
  "src/lib/time-model/retiming.ts",
  "src/lib/time-model/late-arrival.ts",
  "src/lib/situation-entry/dual-time.ts",
  "db/migrations/027_time_model.sql",
  "src/app/api/situation/correct/route.ts",
  "src/components/ops-devtools/SituationTimelinePanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const timelinePanel = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/SituationTimelinePanel.tsx"),
  "utf-8",
);
assert(timelinePanel.includes("sortByTemporalOrder"), "UI uses temporal order");
assert(timelinePanel.includes("formatEventTimeLabel"), "UI shows event time labels");
assert(timelinePanel.includes("ingestion_time"), "UI shows ingestion anchor");

const correctRoute = fs.readFileSync(
  path.join(root, "src/app/api/situation/correct/route.ts"),
  "utf-8",
);
assert(correctRoute.includes('action === "retime"'), "retime API endpoint");

console.log("\n=== Time Model verification complete ===");
