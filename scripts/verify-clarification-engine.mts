/**
 * verify-clarification-engine.mts
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import {
  CLARIFICATION_BUDGET,
  CLARIFICATION_ENGINE_IDENTITY,
  isVagueInput,
  processClarificationEngine,
  resetClarificationStore,
} from "../src/lib/clarification-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Clarification Engine ===\n");

resetClarificationStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();

assert(CLARIFICATION_ENGINE_IDENTITY.includes("reduce uncertainty"), "clarification identity");
assert(CLARIFICATION_BUDGET.low === 0, "zero questions when low uncertainty");
assert(CLARIFICATION_BUDGET.medium === 3, "medium budget");
console.log("✓ clarification contract");

assert(isVagueInput("Dad isn't acting like himself."), "detects vague input");
console.log("✓ vague input detection");

const vague = processClarificationEngine({
  caregiver_id: "cg_clarify",
  raw_input: "Dad isn't acting like himself.",
  events_created: [],
  what_is_uncertain: [],
});

assert(vague.triggered === true, "triggered on vague input");
assert(vague.questions.length >= 1, "asks minimal high-value questions");
assert(vague.questions.length <= vague.budget_max, "respects clarification budget");
assert(vague.explain_why.length >= 1, "explains why asking");
assert(vague.confidence_after_estimated_pct > vague.confidence_before_pct, "confidence improves");
console.log("✓ minimal questions for vague situation");

const migration = path.join(root, "db/migrations/041_architectural_boundaries_clarification.sql");
assert(fs.existsSync(migration), "migration 041");
console.log("✓ migration 041");

const pipeline = await processSituationInput({
  raw_input: "Dad isn't acting like himself.",
  caregiver_id: "cg_clarify",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(pipeline.clarification_engine_layer !== undefined, "layer on SituationResponse");
assert(pipeline.clarification_engine_layer.questions.length >= 1, "questions on pipeline");
assert(
  pipeline.what_needs_clarification.some((q) => q.includes("When") || q.includes("different")),
  "clarification merged into what_needs_clarification",
);
assert(
  pipeline.final_output.what_to_ask_next.length > 10,
  "clarification in final output ask-next",
);
console.log("✓ wired before reasoning and in final output");

const apiRoute = path.join(root, "src/app/api/situation/clarification/route.ts");
const panel = path.join(root, "src/components/ops-devtools/ClarificationEnginePanel.tsx");
assert(fs.existsSync(apiRoute), "clarification API route");
assert(fs.existsSync(panel), "ClarificationEnginePanel");
console.log("✓ API and UI");

console.log("\n=== All clarification engine checks passed ===\n");
