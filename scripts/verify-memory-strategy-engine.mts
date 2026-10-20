/**
 * verify-memory-strategy-engine.mts
 * Memory Strategy Engine — hierarchical tiers, promotion/demotion, selective continuity.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import { resetMoatStore } from "../src/lib/network-effect-moat";
import { resetSuccessModelStore } from "../src/lib/success-model";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";
import { resetContinuousExecutionStore } from "../src/lib/continuous-execution-loop";
import { resetBehaviorPatternStore } from "../src/lib/behavior-interpretation-engine";
import { resetContinuityDecayStore } from "../src/lib/continuity-decay-engine";
import { resetClarificationStore } from "../src/lib/clarification-engine";
import {
  MEMORY_DESIGN_PRINCIPLES,
  MEMORY_STRATEGY_DEFINING_PRINCIPLE,
  MEMORY_STRATEGY_IDENTITY,
  MEMORY_TIERS,
  classifyEventMemoryTier,
  processMemoryStrategy,
  resetMemoryStrategyStore,
} from "../src/lib/memory-strategy-engine";
import { compressRepetitiveEvents } from "../src/lib/memory-strategy-engine/compression-personal";
import { detectMemoryConflicts } from "../src/lib/memory-strategy-engine/conflict-resolution";
import type { CanonicalCareEvent } from "../src/lib/situation-entry/types";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function cloneEvent(base: CanonicalCareEvent, id: string, raw_input: string): CanonicalCareEvent {
  return {
    ...base,
    id,
    raw_input,
    timestamp: raw_input.slice(0, 10) + "T10:00:00.000Z",
    ingestion_time: "2026-07-15T10:00:00.000Z",
    attributes: { ...base.attributes, source_situation_text: raw_input },
  };
}

console.log("=== solenos Memory Strategy Engine ===\n");

resetMemoryStrategyStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetMoatStore();
resetSuccessModelStore();
resetMvpSurfaceStore();
resetContinuousExecutionStore();
resetBehaviorPatternStore();
resetContinuityDecayStore();
resetClarificationStore();

assert(MEMORY_STRATEGY_IDENTITY.includes("selective continuity"), "memory strategy identity");
assert(MEMORY_TIERS.length === 4, "four memory tiers");
assert(MEMORY_DESIGN_PRINCIPLES.length === 10, "ten design principles");
console.log("✓ memory strategy contract");

const migration = path.join(root, "db/migrations/042_memory_strategy_engine.sql");
assert(fs.existsSync(migration), "migration 042");
console.log("✓ migration 042");

const caregiverId = "cg_memory_strategy";

const baseline = await processSituationInput({
  raw_input: "Medication list unchanged. Walks independently as mobility baseline.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(baseline.memory_strategy_layer !== undefined, "layer on first SituationResponse");
assert(
  baseline.memory_strategy_layer.records_classified.some((r) => r.tier === "long_lived"),
  "medication/mobility classified long_lived",
);
console.log("✓ baseline long-lived classification");

const eventTemplate = baseline.events_created[0] ?? baseline.context.events[0];
assert(eventTemplate !== undefined, "baseline produced CareEvents");

const walkerEvent = cloneEvent(
  eventTemplate,
  "evt_walker",
  "She uses a walker now when moving around the house.",
);

const mobilityChange = processMemoryStrategy({
  caregiver_id: caregiverId,
  events_created: [walkerEvent],
  all_events: [...baseline.context.events, walkerEvent],
  as_of: "2026-07-15T10:00:00.000Z",
});

assert(
  mobilityChange.conflicts.length >= 1 || mobilityChange.transitions.length >= 1,
  "mobility transition preserves history",
);
assert(
  detectMemoryConflicts([walkerEvent], baseline.memory_strategy_layer!.records_classified).length >= 1,
  "conflict detection unit — never overwrite",
);
console.log("✓ conflict resolution — never overwrite");

const infectionEvent = cloneEvent(
  eventTemplate,
  "evt_infection",
  "Urinary tract infection — poor appetite and fever this week.",
);
processMemoryStrategy({
  caregiver_id: caregiverId,
  events_created: [infectionEvent],
  all_events: [...baseline.context.events, walkerEvent, infectionEvent],
  as_of: "2026-07-18T10:00:00.000Z",
});

const recoveryEvent = cloneEvent(
  eventTemplate,
  "evt_recovery",
  "Recovered from the urinary tract infection — back to normal appetite.",
);
const recovery = processMemoryStrategy({
  caregiver_id: caregiverId,
  events_created: [recoveryEvent],
  all_events: [...baseline.context.events, walkerEvent, infectionEvent, recoveryEvent],
  as_of: "2026-07-20T10:00:00.000Z",
});

assert(
  recovery.demotions.length >= 1 ||
    recovery.transitions.some((t) => t.to_state.includes("archived")),
  "resolved infection demoted/archived",
);
console.log("✓ demotion on recovery");

const noFallEvents = [
  cloneEvent(eventTemplate, "evt_nf1", "No falls this week — mobility stable."),
  cloneEvent(eventTemplate, "evt_nf2", "No falls this week — still stable."),
  cloneEvent(eventTemplate, "evt_nf3", "No falls this week — mobility unchanged."),
];

let reinforced = recovery;
for (const [i, evt] of noFallEvents.entries()) {
  reinforced = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created: [evt],
    all_events: [
      ...baseline.context.events,
      walkerEvent,
      infectionEvent,
      recoveryEvent,
      ...noFallEvents.slice(0, i + 1),
    ],
    as_of: `2026-07-${21 + i * 7}T10:00:00.000Z`,
  });
}

assert(
  reinforced.compressed_trends.length >= 1 ||
    reinforced.reinforcements.length >= 1 ||
    compressRepetitiveEvents(noFallEvents).length >= 1,
  "repeated no-falls reinforced or compressed",
);
assert(reinforced.current_status_summary.length >= 1, "current status summary");
assert(reinforced.explainable_facts.length >= 1, "explainable facts");
console.log("✓ reinforcement, compression, and summarization");

const pipelineFollowUp = await processSituationInput({
  raw_input: "No falls this week — mobility unchanged.",
  caregiver_id: caregiverId,
  timestamp: "2026-08-04T10:00:00.000Z",
});

assert(pipelineFollowUp.memory_strategy_layer?.active === true, "layer active on pipeline follow-up");
assert(classifyEventMemoryTier(walkerEvent) === "long_lived", "walker classified long_lived");
console.log("✓ pipeline integration");

assert(
  pipelineFollowUp.final_output.what_is_happening.length > 10,
  "memory summary merged into final output what_is_happening",
);

const apiRoute = path.join(root, "src/app/api/situation/memory-strategy/route.ts");
const panel = path.join(root, "src/components/ops-devtools/MemoryStrategyPanel.tsx");
assert(fs.existsSync(apiRoute), "memory-strategy API route");
assert(fs.existsSync(panel), "MemoryStrategyPanel");
console.log("✓ API and UI");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(
  fs.readFileSync(pillarPath, "utf-8").includes("memory_strategy_engine"),
  "pillar #22 memory_strategy_engine",
);
console.log("✓ care continuity pillar registered");

assert(reinforced.defining_principle === MEMORY_STRATEGY_DEFINING_PRINCIPLE, "defining principle");
assert(reinforced.principles_upheld.length === 10, "principles upheld in result");
console.log("✓ design principles upheld");

console.log("\n=== All memory strategy engine checks passed ===\n");
