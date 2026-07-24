/**
 * verify-memory-reconstruction-engine.mts
 * Memory Reconstruction Engine — temporal reconstruction, not search.
 */

import fs from "node:fs";
import path from "node:path";

import {
  MRE_IDENTITY,
  parseMemoryQuery,
  reconstructMemory,
  toMemoryReconstructionLayerPayload,
} from "../src/lib/memory-reconstruction-engine";
import {
  resetCareJourneyGraphStore,
  } from "../src/lib/care-journey-graph";
import { processCareJourneyInput } from "../src/lib/care-journey-graph/server";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

console.log("=== SolenOS Memory Reconstruction Engine ===\n");

resetCareJourneyGraphStore();

assert(MRE_IDENTITY.toLowerCase().includes("temporal reconstruction"), "product identity");
console.log("✓ MRE identity — not search model");

const parsed = parseMemoryQuery("When did Dad stop eating well?");
assert(parsed.reconstruction_type === "event_onset", "detects event onset queries");
assert(parsed.concepts.some((c) => c.id === "appetite"), "extracts appetite concept");
console.log("✓ query parser — concept + reconstruction type");

const caregiverId = "cg_mre";

processCareJourneyInput({
  description: "UTI diagnosed at clinic.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(20),
});
processCareJourneyInput({
  description: "Antibiotics started for infection.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(18),
});
processCareJourneyInput({
  description: "Mom eating less today — poor appetite noted.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(12),
});
processCareJourneyInput({
  description: "Continued appetite decline — barely finishing meals.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(5),
});
processCareJourneyInput({
  description: "Mom seems more confused today.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(3),
});

const appetiteResult = reconstructMemory({
  query: "When did Dad stop eating well?",
  caregiver_id: caregiverId,
});

assert(appetiteResult.reconstructed_memory.length > 0, "reconstructed memory entries");
assert(appetiteResult.timeline_summary.length >= 2, "chronological timeline summary");
assert(appetiteResult.continuity_insight.length > 0, "continuity insight present");
assert(appetiteResult.confidence !== "insufficient_data", "sufficient events for confidence");
assert(
  appetiteResult.timeline_summary.some((l) => /appetite|eating/i.test(l)),
  "timeline references appetite events",
);
console.log("✓ event onset reconstruction — appetite trajectory");

const confusionResult = reconstructMemory({
  query: "When did confusion start?",
  caregiver_id: caregiverId,
});

assert(confusionResult.events_analyzed >= 1, "finds confusion-related events");
assert(
  confusionResult.continuity_insight.toLowerCase().includes("confusion"),
  "continuity insight names concept",
);
console.log("✓ confusion onset — temporal not search");

const progressionResult = reconstructMemory({
  query: "How has appetite changed over time?",
  caregiver_id: caregiverId,
});

assert(progressionResult.reconstruction_type === "progression", "progression query type");
assert(progressionResult.reconstructed_memory.length > 0, "progression memory entries");
console.log("✓ progression reconstruction type");

const causalResult = reconstructMemory({
  query: "What caused the appetite decline?",
  caregiver_id: caregiverId,
});

assert(causalResult.reconstruction_type === "causality", "causality query type");
console.log("✓ causality reconstruction type");

const emptyResult = reconstructMemory({
  query: "When did weight loss start?",
  caregiver_id: "empty_caregiver",
});
assert(emptyResult.confidence === "insufficient_data", "insufficient data when no events");
assert(emptyResult.reconstructed_memory.length === 0, "no invented memory");
console.log("✓ no hallucination — insufficient_data when empty");

const layer = toMemoryReconstructionLayerPayload(appetiteResult);
assert(layer.result.query === appetiteResult.query, "layer payload");
console.log("✓ layer payload for API");

const required = [
  "src/lib/memory-reconstruction-engine/index.ts",
  "src/lib/memory-reconstruction-engine/reconstruct.ts",
  "src/lib/memory-reconstruction-engine/parse-query.ts",
  "src/lib/memory-reconstruction-engine/temporal-aggregator.ts",
  "src/app/api/memory/reconstruct/route.ts",
  "src/components/ops-devtools/MemoryReconstructionPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("MemoryReconstructionPanel"), "MRE panel in workspace");

console.log("\n=== Memory Reconstruction Engine verification complete ===");
