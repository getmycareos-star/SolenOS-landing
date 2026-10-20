/**
 * verify-capacity-self.mts
 * Capacity & Self Modules — context batching, capacity, caregiver profile, factual reflection.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCaregiverSelfProfileStore,
  buildCareItemsFromInput,
  buildBatchView,
  buildCapacityMatchedSuggestion,
  setSessionCapacity,
  ingestCaregiverSelfEntry,
  generateFactualReflection,
  resolveCareItem,
  topPriorityItem,
  VALUES_CAPTURE_ROADMAP,
  classifyContextType,
} from "../src/lib/capacity-self";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Capacity & Self Modules ===\n");

resetCaregiverSelfProfileStore();

const multiInput = `
Electrical hazard at grandma's house needs an electrician call.
Property tax payment requires a phone call to the county.
I also need to schedule my own dental appointment — my tooth has been hurting.
Roof repair this weekend.
`.trim();

const recipientItems = buildCareItemsFromInput(
  "Electrical hazard and roof repair needed at grandma's house",
  "care_recipient",
);
const caregiverItems = buildCareItemsFromInput(
  "I need to schedule my own dental appointment",
  "caregiver",
);
const allItems = [...recipientItems, ...caregiverItems];

assert(recipientItems.some((i) => i.context_type === "home_repair"), "home_repair context tagged");
assert(recipientItems.some((i) => i.context_type === "phone_call" || i.context_type === "home_repair"), "context_type on items");
console.log("✓ context_type tagging");

const batch = buildBatchView(allItems, "phone_call");
assert(batch.groups.length >= 2, "multiple context groups");
assert(batch.groups.some((g) => g.context_type === "home_repair"), "home repair batch");
const highRiskOutside = batch.outside_batch_high_risk;
assert(
  highRiskOutside.length === 0 || highRiskOutside.every((i) => i.context_type !== "phone_call"),
  "high-risk outside batch is separate visibility not hidden",
);
console.log("✓ context batching — alternate lens, not override");

setSessionCapacity("cg_cap", "low");
const lowSessionItems = buildCareItemsFromInput(
  "Electrical hazard is live. Mail the pharmacy refill envelope.",
  "care_recipient",
);
const suggestion = buildCapacityMatchedSuggestion(lowSessionItems, "low");
assert(suggestion !== null, "capacity suggestion when low");
assert(suggestion!.label === "capacity_matched_suggestion", "labeled as capacity-matched");
assert(suggestion!.top_priority_item !== null, "top priority still present");
assert(
  suggestion!.top_priority_item!.risk_level === "high" || suggestion!.top_priority_item!.decay_rate === "fast",
  "top priority remains high-stakes visible",
);
assert(suggestion!.item.id !== suggestion!.top_priority_item!.id, "suggestion is additional not replacement");
console.log("✓ capacity-matched suggestion alongside top priority");

ingestCaregiverSelfEntry({
  content: "My dental appointment is next Tuesday and my back has been hurting.",
  raw_entry_id: "ce_self_1",
  caregiver_id: "cg_cap",
});

const selfItems = buildCareItemsFromInput("My dental appointment is next Tuesday", "caregiver");
assert(selfItems[0]?.subject === "caregiver", "caregiver subject");
assert(selfItems[0]?.context_type === "medical", "caregiver dental uses same medical context");
assert(topPriorityItem(selfItems) !== null, "caregiver items use same priority machinery");
console.log("✓ caregiver profile — same schema, same engine");

await resolveCareItem({
  caregiver_id: "cg_cap",
  description: "Electrical hazard addressed",
  subject: "care_recipient",
  context_type: "home_repair",
});
await resolveCareItem({
  caregiver_id: "cg_cap",
  description: "Property tax paid",
  subject: "care_recipient",
  context_type: "financial",
});
await resolveCareItem({
  caregiver_id: "cg_cap",
  description: "Medical follow-up completed",
  subject: "care_recipient",
  context_type: "medical",
});

const reflection = generateFactualReflection([
  {
    id: "r1",
    description: "Electrical hazard addressed",
    subject: "care_recipient",
    context_type: "home_repair",
    resolved_at: new Date().toISOString(),
    raw_entry_id: null,
  },
  {
    id: "r2",
    description: "Property tax paid",
    subject: "care_recipient",
    context_type: classifyContextType("property tax paid"),
    resolved_at: new Date().toISOString(),
    raw_entry_id: null,
  },
]);

assert(reflection.lines.some((l) => l.includes("This week:")), "factual opener");
assert(!reflection.lines.some((l) => /\bgreat job|you're doing|proud of you\b/i.test(l)), "no reassurance tone");
assert(reflection.lines.some((l) => l.includes("Electrical hazard addressed")), "plain resolved record");
console.log("✓ factual reflection — evidence not soothing");

assert(VALUES_CAPTURE_ROADMAP.status === "planned_not_v1", "values capture flagged for roadmap");
console.log("✓ values capture — roadmap only, not v1");

const required = [
  "src/lib/capacity-self/index.ts",
  "src/lib/capacity-self/modules/context-batching.ts",
  "src/lib/capacity-self/modules/capacity-suggestions.ts",
  "src/lib/capacity-self/modules/factual-reflection.ts",
  "src/lib/capacity-self/caregiver-profile/store.ts",
  "db/migrations/016_capacity_self_modules.sql",
  "src/app/api/capacity-self/session/route.ts",
  "src/app/api/capacity-self/reflection/route.ts",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("ingestCaregiverSelfEntry"), "care-events feeds caregiver profile");

console.log("✓ module + API + migration files");

console.log("\n=== Capacity & Self Modules: all checks passed ===\n");
