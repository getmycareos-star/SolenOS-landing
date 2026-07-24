/**
 * verify-continuity-graph.mts
 * Universal Continuity Graph — domain-agnostic nodes, edges, intelligence.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCareJourneyGraphStore,
  } from "../src/lib/care-journey-graph";
import { processCareJourneyInput } from "../src/lib/care-journey-graph/server";
import {
  resetContinuityGraphStore,
  CONTINUITY_GRAPH_IDENTITY,
  UNIVERSAL_NODE_TYPES,
  UNIVERSAL_EDGE_TYPES,
  processContinuityInput,
  syncFromJourneyResult,
  toContinuityGraphLayerPayload,
  inferDomainFromText,
  runContinuityIntelligence,
  runContextReasoning,
} from "../src/lib/continuity-graph";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Universal Continuity Graph ===\n");

resetCareJourneyGraphStore();
resetContinuityGraphStore();

assert(UNIVERSAL_NODE_TYPES.includes("Obligation"), "Obligation node type exists");
assert(UNIVERSAL_NODE_TYPES.includes("Constraint"), "Constraint node type exists");
assert(UNIVERSAL_EDGE_TYPES.includes("depends_on"), "depends_on edge type exists");
assert(UNIVERSAL_EDGE_TYPES.includes("blocks"), "blocks edge type exists");
assert(CONTINUITY_GRAPH_IDENTITY.includes("temporal dependency graph"), "identity matches thesis");
console.log("✓ universal node and edge schema");

assert(inferDomainFromText("Power of attorney signed with attorney") === "legal", "legal domain");
assert(inferDomainFromText("Insurance claim delayed approval") === "financial", "financial domain");
assert(inferDomainFromText("She fell and went to hospital") === "care", "care domain");
console.log("✓ domain inference (non-medical + medical)");

const caregiverId = "cg_continuity_graph";

const care = processContinuityInput({
  description: "She fell walking to the bathroom.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-13T08:00:00.000Z",
});
assert(care.graph.nodes.some((n) => n.node_type === "Event"), "fall → Event node");
console.log("✓ care domain ingestion");

const hospital = processContinuityInput({
  description: "Emergency room visit after the fall. Hip X-ray ordered.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-13T12:00:00.000Z",
});
assert(hospital.graph.edges.some((e) => e.edge_type === "causes"), "fall → hospital causes edge");
console.log("✓ causal chain in universal graph");

const legal = processContinuityInput({
  description: "Power of Attorney signed at lawyer meeting. Authority activated for banking.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-01T10:00:00.000Z",
});
assert(legal.graph.nodes.some((n) => n.domain === "legal"), "legal domain nodes");
console.log("✓ legal domain example");

const financial = processContinuityInput({
  description: "Income drop led to missed payment. Debt notice received. Restructuring required.",
  caregiver_id: caregiverId,
  timestamp: "2026-05-15T10:00:00.000Z",
});
assert(financial.graph.nodes.some((n) => n.domain === "financial"), "financial domain nodes");
console.log("✓ financial domain example");

const mixed = processContinuityInput({
  description:
    "Fall led to hospitalization. Insurance claim submitted but approval delayed. Care gap until family intervened.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-14T10:00:00.000Z",
});
assert(mixed.cascade_chains.length >= 1 || mixed.graph.edges.length >= 2, "mixed continuity chain");
console.log("✓ mixed real-world continuity");

const insights = runContinuityIntelligence(hospital.graph);
assert(Array.isArray(insights), "continuity intelligence returns insights");
console.log("✓ continuity intelligence engine");

const reasoning = runContextReasoning("She fell.");
assert(reasoning.unknown.length >= 1 || reasoning.confidence === "insufficient", "context reasoning shows unknowns");
assert(reasoning.questions.length >= 1, "context reasoning generates questions");
console.log("✓ context reasoning engine (not clinical-specific)");

const journeyResult = processCareJourneyInput({
  description: "Follow-up appointment required in 14 days.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-15T10:00:00.000Z",
});
const synced = syncFromJourneyResult(journeyResult);
const layer = toContinuityGraphLayerPayload(synced);
assert(layer.graph_id.length > 0, "layer payload has graph_id");
assert(layer.node_count >= 1, "layer payload node count");
assert(layer.thesis.length > 0, "layer payload thesis");
console.log("✓ journey bridge + layer payload");

const required = [
  "src/lib/continuity-graph/index.ts",
  "src/lib/continuity-graph/pipeline.ts",
  "src/lib/continuity-graph/bridge-from-journey.ts",
  "src/lib/continuity-graph/continuity-intelligence.ts",
  "src/lib/continuity-graph/context-reasoning.ts",
  "db/migrations/024_continuity_graph.sql",
  "src/app/api/continuity-graph/route.ts",
  "src/components/ops-devtools/ContinuityGraphPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("syncFromJourneyResult"), "care-events syncs continuity graph");

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("ContinuityGraphPanel"), "continuity graph panel in workspace");

console.log("\n=== Universal Continuity Graph verification complete ===");
