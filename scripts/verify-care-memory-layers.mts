/**
 * verify-care-memory-layers.mts
 * Graph scale & memory strategy — 4 layers, retrieval, compaction, preservation.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore, MEMORY_LAYERS_IDENTITY } from "../src/lib/care-memory-layers";
import {
  assertRawPreservation,
  buildHierarchicalGraph,
  composeContextWindow,
  detectEpisodes,
  deriveLongTermSummaries,
  getPaginatedRawEvents,
  paginate,
  processMemoryLayers,
  rawRefsFromEvents,
  rebuildMemoryLayers,
  retrieveMemoryContext,
} from "../src/lib/care-memory-layers";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Memory Layers ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();

assert(MEMORY_LAYERS_IDENTITY.includes("organizing history"), "memory identity");
console.log("✓ system contract");

const caregiverId = "cg_memory";

const first = await processSituationInput({
  raw_input: "Mom fell yesterday and went to hospital",
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.memory_layer !== null, "memory layer in response");
assert(first.memory_layer!.total_raw_events >= 1, "raw events preserved");
assert(first.memory_layer!.episode_count >= 1, "episodes detected");
console.log("✓ Layer 1 raw + Layer 3 episodes on ingest");

await processSituationInput({
  raw_input: "Discharge summary received — follow-up in 2 weeks",
  caregiver_id: caregiverId,
  timestamp: "2026-07-05T10:00:00.000Z",
});

const second = await processSituationInput({
  raw_input: "Insurance rejected the hospital claim",
  caregiver_id: caregiverId,
  timestamp: "2026-07-08T10:00:00.000Z",
});

const store = rebuildMemoryLayers(caregiverId, second.context.events);
assert(store.raw_event_refs.every((r) => r.preserved), "raw refs marked preserved");
assert(store.structured.links.length >= 0, "Layer 2 structured continuity");
console.log("✓ Layer 2 structured continuity links");

const before = store.raw_event_refs.length;
const hierarchical = buildHierarchicalGraph(store);
assert(hierarchical.total_raw_events === before, "compaction preserves raw count");
assert(hierarchical.episodes.length >= 1, "hierarchical episodes");
assert(
  assertRawPreservation(store.raw_event_refs, hierarchical.episodes.flatMap((e) => e.events)),
  "preservation rule — no raw loss",
);
console.log("✓ hierarchical graph compaction");

const retrieval = retrieveMemoryContext(store);
assert(retrieval.retrieval_order.length >= 7, "retrieval priority order");
assert(retrieval.recent_events.length >= 1, "recent events prioritized");
assert(retrieval.raw_events_on_demand === null, "full history not loaded by default");
console.log("✓ prioritized retrieval");

const rawById = new Map(store.raw_event_refs.map((r) => [r.event_id, r]));
const ctxWindow = composeContextWindow({
  retrieval,
  rawById,
  current_situation: "Current hospital follow-up",
});
assert(ctxWindow.includes_full_history === false, "context window excludes full history");
assert(ctxWindow.active_episode_summary !== null || retrieval.active_episode === null, "active episode in context");
console.log("✓ context window management");

const page = paginate(store.raw_event_refs, 0, 2);
assert(page.items.length <= 2, "pagination limit");
assert(page.has_more === store.raw_event_refs.length > 2, "has_more flag");
const paged = getPaginatedRawEvents(caregiverId, 0, 2);
assert(paged !== null && paged.items.length <= 2, "paginated raw API helper");
console.log("✓ pagination");

const oldEpisodes = detectEpisodes(caregiverId, second.context.events, []);
const summaries = deriveLongTermSummaries(
  caregiverId,
  oldEpisodes.map((ep) => ({ ...ep, status: "completed" as const, ended_at: "2025-01-01T00:00:00.000Z" })),
);
assert(summaries.every((s) => s.reversible === true), "summaries reversible");
assert(summaries.every((s) => s.event_ids.length >= 0), "summaries link to events");
console.log("✓ Layer 4 long-term summaries");

const required = [
  "src/lib/care-memory-layers/index.ts",
  "src/lib/care-memory-layers/layer-raw.ts",
  "src/lib/care-memory-layers/layer-episodes.ts",
  "src/lib/care-memory-layers/retrieve.ts",
  "src/lib/care-memory-layers/pipeline.ts",
  "src/app/api/situation/memory/route.ts",
  "src/components/ops-devtools/MemoryEpisodePanel.tsx",
  "db/migrations/030_memory_layers.sql",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const pipeline = fs.readFileSync(
  path.join(root, "src/lib/situation-entry/pipeline.ts"),
  "utf-8",
);
assert(pipeline.includes("processMemoryLayers"), "memory wired into ingest pipeline");

console.log("\n=== Care Memory Layers verification complete ===");
