/**
 * verify-care-journey.mts
 * Caregiver Reality Model — generalized care journey events timeline.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCareJourneyStore,
  inferCareJourneyCategory,
  CARE_JOURNEY_CATEGORIES,
  CARE_JOURNEY_IDENTITY,
} from "../src/lib/care-journey";
import {
  recordCareJourneyEvent,
  loadCareJourneyTimeline,
  searchCareJourney,
} from "../src/lib/care-journey/server";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Journey Events ===\n");

resetCareJourneyStore();

assert(CARE_JOURNEY_CATEGORIES.includes("legal"), "legal category exists");
assert(CARE_JOURNEY_CATEGORIES.includes("financial"), "financial category exists");
assert(CARE_JOURNEY_CATEGORIES.includes("medical"), "medical category exists");
assert(CARE_JOURNEY_CATEGORIES.includes("family"), "family category exists");
console.log("✓ generalized categories — not medical-only");

assert(
  inferCareJourneyCategory("Established durable power of attorney and updated the will") === "legal",
  "classifies legal events",
);
assert(
  inferCareJourneyCategory("Applied for Medicare benefits and resolved insurance issue") === "financial",
  "classifies financial events",
);
assert(
  inferCareJourneyCategory("Neurology appointment — medication changed") === "medical",
  "classifies medical events",
);
assert(
  inferCareJourneyCategory("Family meeting — sister will share caregiving duties") === "family",
  "classifies family coordination",
);
console.log("✓ category inference across journey types");

const caregiverId = "cg_journey";

await recordCareJourneyEvent({
  description: "Secured durable power of attorney and financial authority.",
  caregiver_id: caregiverId,
  event_date: "2026-03-01T10:00:00.000Z",
});

await recordCareJourneyEvent({
  description: "Neurology appointment attended. Medication changed.",
  caregiver_id: caregiverId,
  event_date: "2026-06-22T14:00:00.000Z",
});

await recordCareJourneyEvent({
  description: "Forms completed for home care agency intake.",
  caregiver_id: caregiverId,
  event_date: "2026-05-15T09:00:00.000Z",
});

const timeline = await loadCareJourneyTimeline(caregiverId);
assert(timeline.length === 3, "three journey events stored");
assert(
  timeline[0]!.event_date >= timeline[1]!.event_date,
  "timeline sorted chronologically descending",
);
assert(timeline.some((e) => e.category === "legal"), "legal event on timeline");
assert(timeline.some((e) => e.category === "medical"), "medical event on timeline");
console.log("✓ chronological care journey timeline");

const search = await searchCareJourney(caregiverId, "power of attorney");
assert(search.matches.length >= 1, "search finds legal planning events");
console.log("✓ searchable journey record");

assert(CARE_JOURNEY_IDENTITY.includes("journey"), "product identity is journey-first");
console.log("✓ caregiver reality model identity");

const required = [
  "src/lib/care-journey/index.ts",
  "src/lib/care-journey/classify.ts",
  "src/lib/care-journey/store.ts",
  "db/migrations/020_care_journey_events.sql",
  "src/app/api/care-journey/timeline/route.ts",
  "src/components/ops-devtools/CareJourneyTimelinePanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("recordJourneyEventFromCareCapture"), "care-events feeds journey timeline");

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("CareJourneyTimelinePanel"), "journey timeline in workspace");

console.log("\n=== Care Journey verification complete ===");
