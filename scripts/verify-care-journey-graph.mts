/**
 * verify-care-journey-graph.mts
 * Care Journey Graph — structured events, relationships, mandatory pipeline.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCareJourneyGraphStore,
  classifyJourneyEventType,
  toCareJourneyGraphLayerPayload,
  CARE_JOURNEY_GRAPH_IDENTITY,
  JOURNEY_EVENT_TYPES,
  RELATIONSHIP_TYPES,
} from "../src/lib/care-journey-graph";
import { processCareJourneyInput } from "../src/lib/care-journey-graph/server";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Journey Graph ===\n");

resetCareJourneyGraphStore();

assert(JOURNEY_EVENT_TYPES.includes("fall"), "fall event type exists");
assert(JOURNEY_EVENT_TYPES.includes("medication_started"), "medication_started exists");
assert(RELATIONSHIP_TYPES.includes("caused"), "caused relationship exists");
assert(RELATIONSHIP_TYPES.includes("continued_from"), "continued_from relationship exists");
console.log("✓ structured event types and relationship types");

assert(classifyJourneyEventType("Mom slipped and fell in the bathroom") === "fall", "classifies fall");
assert(
  classifyJourneyEventType("Started antibiotics today as prescribed") === "medication_started",
  "classifies medication",
);
console.log("✓ event classification");

const caregiverId = "cg_graph_test";

const uti = processCareJourneyInput({
  description: "UTI diagnosed at clinic yesterday.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-10T10:00:00.000Z",
});

assert(uti.event.event_type === "diagnosis", "stores diagnosis event");
assert(uti.graph.events.length === 1, "graph has one event after first input");

const meds = processCareJourneyInput({
  description: "Antibiotics started today.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-11T09:00:00.000Z",
});

assert(meds.graph.events.length === 2, "graph grows with each input");
assert(
  meds.new_relationships.some((r) => r.relationship_type === "resulted_in"),
  "detects diagnosis → medication relationship",
);
console.log("✓ relationship detection and graph update");

const confusion = processCareJourneyInput({
  description: "Mom seems more confused today and eating less.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-12T14:00:00.000Z",
});

assert(confusion.continuity.patterns_detected.length >= 1, "continuity patterns detected");
assert(
  confusion.continuity.suggested_connection_questions.length >= 1,
  "suggests connection questions",
);
console.log("✓ continuity assessment across history");

const fall = processCareJourneyInput({
  description: "She fell walking to the bathroom.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-13T08:00:00.000Z",
});

assert(fall.event.event_type === "fall", "classifies fall event");

const er = processCareJourneyInput({
  description: "Emergency room visit after the fall. Hip X-ray ordered.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-13T12:00:00.000Z",
});

assert(
  er.new_relationships.some((r) => r.relationship_type === "caused"),
  "fall → ER caused relationship",
);
console.log("✓ causal chain: fall → emergency visit");

const layer = toCareJourneyGraphLayerPayload(er);
assert(layer.journey_id.length > 0, "layer payload has journey_id");
assert(layer.continuity !== undefined, "layer includes continuity assessment");
assert(layer.identity === CARE_JOURNEY_GRAPH_IDENTITY, "layer identity matches product model");
console.log("✓ layer payload for analyze pipeline");

const insufficient = processCareJourneyInput({
  description: "She fell.",
  caregiver_id: caregiverId,
});
assert(
  insufficient.completeness_status === "INSUFFICIENT" ||
    insufficient.continuity.open_questions.length > 0,
  "information completeness gate surfaces missing context for falls",
);
console.log("✓ information completeness gate");

const required = [
  "src/lib/care-journey-graph/index.ts",
  "src/lib/care-journey-graph/pipeline.ts",
  "src/lib/care-journey-graph/graph-store.ts",
  "src/lib/care-journey-graph/detect-relationships.ts",
  "src/lib/care-journey-graph/continuity-assess.ts",
  "db/migrations/021_care_journey_graph.sql",
  "src/app/api/care-journey/graph/route.ts",
  "src/components/ops-clarity/CareContinuityPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const analyzePipeline = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(analyzePipeline.includes("processCareJourneyInput"), "analyze pipeline updates graph before reasoning");
assert(analyzePipeline.includes("care_journey_graph_layer"), "analyze pipeline exposes graph layer");

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("processCareJourneyInputAsync"), "care-events feeds graph pipeline");

const clarityPanel = fs.readFileSync(
  path.join(root, "src/components/ops-clarity/ClarityPanel.tsx"),
  "utf-8",
);
assert(clarityPanel.includes("CareContinuityPanel"), "continuity panel in clarity view");

console.log("\n=== Care Journey Graph verification complete ===");
