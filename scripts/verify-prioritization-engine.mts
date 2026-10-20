/**
 * verify-prioritization-engine.mts
 * Four-dimension prioritization — decay, clocks, pools, self-neglect.
 * Uses the build spec worked example as the primary test case.
 */

import fs from "node:fs";
import path from "node:path";

import {
  processPrioritizationEngine,
  PRIORITIZATION_ENGINE_BOUNDARY,
  RESOURCE_POOLS,
} from "../src/lib/prioritization-engine";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Prioritization Engine ===\n");

assert(RESOURCE_POOLS.includes("emotional_capacity"), "unified pool: emotional_capacity");
assert(RESOURCE_POOLS.includes("cognitive_capacity"), "unified pool: cognitive_capacity");
assert(RESOURCE_POOLS.includes("money"), "pool: money");
assert(RESOURCE_POOLS.includes("presence_with_care_recipient"), "pool: presence");
console.log("✓ unified resource pool model (external + internal currencies)");

const WORKED_INPUT = `
Grandmother has electrical hazards, a roof problem, plumbing issues, and mice in the house.
She needed new dentures after a tooth infection. Property taxes are due soon.
She wants to repaint the laundry room and go shopping.
There is a limited, shared pool of money.
The caregiver and her husband are doing repair labor themselves, which trades their time with grandma for money saved.
The caregiver works full time, has no backup, and has not appeared on her own priority list in days.
`.trim();

const result = processPrioritizationEngine({ input: WORKED_INPUT });
const { output } = result;

assert(result.itemCount >= 5, "extracts multiple domain items");
console.log(`✓ extracted ${result.itemCount} items (${result.decayingCount} decaying, ${result.staticCount} static)`);

const electrical = output.items.find((i) => /electrical/i.test(i.description));
assert(electrical?.type === "decaying", "electrical → decaying");
assert(electrical?.decay_rate === "fast", "electrical → fast decay");
assert(electrical?.clock_type === "consequence_bound", "electrical → consequence_bound");
assert(electrical?.pool.includes("money"), "electrical → money pool");
assert(electrical?.risk_level === "high", "electrical → high risk");
console.log("✓ electrical hazard classification");

const mice = output.items.find((i) => /mice|rodent/i.test(i.description));
assert(mice?.type === "decaying", "mice → decaying");
assert(mice?.decay_rate === "moderate", "mice → moderate decay");
console.log("✓ mice classification");

const tax = output.items.find((i) => /property tax|taxes/i.test(i.description));
assert(tax?.type === "static", "property tax → static decay (bill does not worsen)");
assert(tax?.clock_type === "deadline_bound", "property tax → deadline_bound clock");
console.log("✓ property tax clock-type distinction");

const repaint = output.items.find((i) => /repaint|laundry/i.test(i.description));
const shopping = output.items.find((i) => /shopping/i.test(i.description));
assert(repaint?.type === "static", "repaint → static");
assert(shopping?.type === "static", "shopping → static");
assert(repaint?.clock_type === null, "repaint → no clock — parked");
console.log("✓ static wants parked, not ranked");

assert(output.resource_tension.length >= 1, "surfaces resource tension");
const moneyTension = output.resource_tension.find((t) => t.pool === "money");
assert(moneyTension !== undefined, "money pool tension exists");
assert(
  !moneyTension!.note.toLowerCase().includes("you should fund"),
  "does not silently optimize money allocation",
);
console.log("✓ resource_tension surfaces tradeoffs without deciding");

const timeTension = output.resource_tension.find(
  (t) => t.pool === "presence_with_care_recipient" || t.pool === "caregiver_time",
);
assert(timeTension !== undefined, "DIY repair vs time-with-grandma tension");
console.log("✓ caregiver_time / presence tradeoff visible");

assert(output.risk_cascade.length >= 1, "risk_cascade field populated");
const miceElectrical = output.risk_cascade.find(
  (c) =>
    (c.compounding_note.includes("Mice") || c.compounding_note.includes("mice")) &&
    c.compounding_note.includes("wiring"),
);
assert(miceElectrical !== undefined, "mice + electrical cascade");
console.log("✓ risk_cascade separate from resource_tension");

assert(output.self_neglect_flag === true, "self_neglect_flag when caregiver absent from list");
assert(output.self_neglect_note !== null, "self_neglect_note surfaced directly");
assert(
  !output.self_neglect_note!.toLowerCase().includes("you should self-care"),
  "no moralizing on self-neglect",
);
console.log("✓ self_neglect_flag first-class");

assert(output.what_matters_now.includes("decision maker") || output.what_matters_now.includes("SolenOS surfaces"), "what_matters_now names stakes not instructions");
assert(!/\bfund the|sell your|you must pay\b/i.test(output.what_matters_now), "no financial instructions in what_matters_now");
assert(output.what_matters_now.toLowerCase().includes("electrical") || output.what_matters_now.toLowerCase().includes("hazard"), "what_matters_now names highest-risk item");
assert(!/^\d+\)/m.test(output.what_matters_now), "what_matters_now is not a flat ranked list");
console.log("✓ what_matters_now — single action, stakes only");

assert(
  output.items.every((i) => i.assessment_source === "caregiver_reported" || i.assessment_source === "professional_verified"),
  "every item has assessment_source",
);
assert(output.items.every((i) => i.last_updated), "every item has last_updated");
console.log("✓ confidence and staleness fields on items");

const annual = output.items.find((i) => i.recurrence === "annual");
assert(annual !== undefined || output.follow_up_items.some((f) => /annual|last year/i.test(f)), "recurrence awareness");
console.log("✓ recurrence detection");

assert(PRIORITIZATION_ENGINE_BOUNDARY.includes("does not tell"), "boundary principle documented");
console.log("✓ organize and surface, never decide");

const required = [
  "src/lib/prioritization-engine/types.ts",
  "src/lib/prioritization-engine/classify-item.ts",
  "src/lib/prioritization-engine/resource-tension.ts",
  "src/lib/prioritization-engine/risk-cascade.ts",
  "src/lib/prioritization-engine/self-neglect.ts",
  "src/lib/prioritization-engine/build-output.ts",
  "src/lib/prioritization-engine/process.ts",
  "src/lib/analyze-pipeline/index.ts",
  "src/components/ops-clarity/ClarityPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const pipeline = fs.readFileSync(path.join(root, "src/lib/analyze-pipeline/index.ts"), "utf-8");
assert(pipeline.includes("processPrioritizationEngine"), "wired in analyze pipeline");
assert(pipeline.includes("prioritization_engine_layer"), "layer exposed in API payload");

const clarity = fs.readFileSync(
  path.join(root, "src/components/ops-clarity/ClarityPanel.tsx"),
  "utf-8",
);
assert(clarity.includes("self-neglect"), "UI surfaces self_neglect");
assert(clarity.includes("resource-tension"), "UI surfaces resource_tension");
assert(clarity.includes("risk-cascade"), "UI surfaces risk_cascade");
console.log("✓ pipeline + UI wiring");

console.log("\n=== Prioritization Engine: all checks passed ===\n");
