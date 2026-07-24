/**
 * verify-care-event-priority.mts
 * Deterministic CareEvent priority engine — scoring, tiers, query layer, UI contract.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import {
  CARE_EVENT_PRIORITY_IDENTITY,
  computePriority,
  classifyPriorityTier,
  getTopEvents,
  getAttentionEvents,
  queryPriorityEvents,
  UI_SURFACE_LIMIT,
  ATTENTION_PANEL_THRESHOLD,
} from "../src/lib/care-event-priority";
import {
  processSituationInput,
  resetCareContextRootStore,
  getTopSituationEvents,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Event Priority Engine ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();

assert(CARE_EVENT_PRIORITY_IDENTITY.includes("prioritization"), "priority identity");
console.log("✓ system contract");

const highUrgency = computePriority({
  id: "e1",
  timestamp: new Date().toISOString(),
  event_time: new Date().toISOString(),
  urgency: 100,
  uncertainty: 80,
  dependency_count: 5,
  recency_days: 0,
  attention_status: "active",
});
assert(highUrgency >= 80, `high urgency → high score (got ${highUrgency})`);
assert(classifyPriorityTier(highUrgency) === "CRITICAL", "tier CRITICAL at >= 80");
assert(classifyPriorityTier(45) === "CONTEXTUAL", "tier CONTEXTUAL at 20–49");
assert(classifyPriorityTier(10) === "BACKGROUND", "tier BACKGROUND below 20");
console.log("✓ computePriority + tier boundaries");

const defaults = computePriority({
  id: "e2",
  timestamp: new Date().toISOString(),
  event_time: null,
  urgency: 30,
  uncertainty: 70,
  dependency_count: 1,
  recency_days: 5,
  attention_status: "provisional",
});
assert(defaults > 0, "defaults still produce score");
console.log("✓ default field scoring");

const caregiverId = "cg_priority";

await processSituationInput({
  raw_input: "Mom fell yesterday and hasn't been eating",
  caregiver_id: caregiverId,
  timestamp: new Date().toISOString(),
});

await processSituationInput({
  raw_input: "Insurance rejected the claim",
  caregiver_id: caregiverId,
  timestamp: new Date().toISOString(),
});

const top = getTopSituationEvents(caregiverId, 5);
assert(top.length >= 1, "getTopSituationEvents returns events");
assert(top.length <= UI_SURFACE_LIMIT, "surface limit enforced");
assert(top.every((e) => e.priority?.priority_score != null), "every event has priority_score");

const sorted = [...top].sort((a, b) => b.priority.priority_score - a.priority.priority_score);
assert(
  top.every((e, i) => e.id === sorted[i]?.id),
  "UI sort by priority_score only",
);
console.log("✓ getTopEvents query layer");

const result = await processSituationInput({
  raw_input: "Follow-up appointment next week",
  caregiver_id: caregiverId,
  timestamp: new Date().toISOString(),
});

assert(result.priority_layer !== null, "priority_layer in situation response");
assert(result.priority_layer!.top_events.length <= UI_SURFACE_LIMIT, "top_events capped");
assert(
  result.events_created.every((e) => typeof e.priority.priority_score === "number"),
  "ingestion attaches priority",
);

const attention = getAttentionEvents(result.context.events);
assert(
  attention.every((e) => e.priority.priority_score >= ATTENTION_PANEL_THRESHOLD),
  "attention panel threshold",
);
console.log("✓ ingestion hook + attention rule");

const query = queryPriorityEvents(result.context.events);
assert(query.hidden_count >= 0, "hidden count computed");
console.log("✓ priority query with hidden count");

const required = [
  "src/lib/care-event-priority/index.ts",
  "src/lib/care-event-priority/compute-priority.ts",
  "src/lib/care-event-priority/query.ts",
  "src/lib/situation-entry/pipeline.ts",
  "src/components/ops-devtools/SituationTimelinePanel.tsx",
  "src/components/ops-devtools/PriorityAttentionPanel.tsx",
  "db/migrations/029_care_event_priority.sql",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const timeline = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/SituationTimelinePanel.tsx"),
  "utf-8",
);
assert(timeline.includes("getTopEvents"), "timeline uses priority sort");
assert(timeline.includes("priority.tier"), "timeline shows tier");

const attentionPanel = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/PriorityAttentionPanel.tsx"),
  "utf-8",
);
assert(attentionPanel.includes("priority_score >= 80"), "CRITICAL panel threshold");

console.log("\n=== Care Event Priority verification complete ===");
