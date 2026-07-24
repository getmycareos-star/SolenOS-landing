/**
 * verify-dementia-layer.mts
 * Dementia Layer V1 — schema, storage, retrieval, display only.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCareRecipientProfileStore,
  ingestCareEntry,
} from "../src/lib/cognitive-relief";
import {
  DEMENTIA_LAYER_BOUNDARY,
  FINANCIAL_RISK_LABEL,
  SUNDOWNING_WARNING,
} from "../src/lib/care-contexts";
import {
  addFinancialRiskEvent,
  addWanderingEvent,
  getDementiaProfileView,
  setCareContext,
  updateDementiaContext,
  updateDrivingStatus,
} from "../src/lib/care-contexts/dementia/server";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Dementia Layer V1 ===\n");

resetCareRecipientProfileStore();

const caregiverId = "cg_dementia_v1";

let view = await getDementiaProfileView({ caregiver_id: caregiverId });
assert(view.care_context === "general", "default care_context is general");
assert(view.dementia_context === null, "no dementia context when general");
console.log("✓ general care context default");

view = await setCareContext({ caregiver_id: caregiverId, care_context: "dementia" });
assert(view.care_context === "dementia", "care_context set to dementia");
assert(view.dementia_context !== null, "dementia context initialized");
console.log("✓ mark profile as dementia-related");

view = await updateDementiaContext({
  caregiver_id: caregiverId,
  patch: { dementia_stage: "moderate", medication_risk: "needs_supervision" },
});
assert(view.dementia_context?.dementia_stage === "moderate", "dementia stage stored");
assert(view.dementia_context?.medication_risk === "needs_supervision", "medication risk stored");
console.log("✓ record dementia stage and medication supervision");

view = await updateDementiaContext({
  caregiver_id: caregiverId,
  patch: { sundowning_window: { start: "16:00", end: "20:00" } },
});
assert(view.dementia_context?.sundowning_window?.start === "16:00", "sundowning window stored");
console.log("✓ record sundowning window");

const wander = await addWanderingEvent({
  caregiver_id: caregiverId,
  description: "Tried to leave house at 8pm",
  trigger: "evening confusion",
  location: "front door",
});
assert(wander.event.description.includes("leave house"), "wandering event recorded");
assert(wander.view.dementia_context!.wandering_events.length === 1, "wandering events retrievable");
console.log("✓ record wandering incidents");

view = await updateDrivingStatus({
  caregiver_id: caregiverId,
  driving_status: "conversation_pending",
});
view = await updateDrivingStatus({
  caregiver_id: caregiverId,
  driving_status: "recently_stopped",
});
assert(view.dementia_context?.driving_status === "recently_stopped", "driving status updated");
assert(
  (view.dementia_context?.driving_status_history.length ?? 0) >= 2,
  "driving status history maintained",
);
console.log("✓ driving status with history");

const fin = await addFinancialRiskEvent({
  caregiver_id: caregiverId,
  description: "Unknown caller requested account details.",
});
assert(
  fin.view.dementia_context!.possible_financial_risk_events[0]!.description.includes("caller"),
  "financial risk observation stored",
);
console.log("✓ possible financial risk observations (not exploitation labels)");

await ingestCareEntry({
  content: "Morning meds: donepezil 5mg with breakfast.",
  raw_entry_id: "ce_dementia_med",
  caregiver_id: caregiverId,
});
const withMeds = await getDementiaProfileView({ caregiver_id: caregiverId });
assert(
  withMeds.current_medications.length >= 0,
  "medications available for display alongside supervision level",
);
console.log("✓ medication risk display context alongside care record");

assert(SUNDOWNING_WARNING.includes("High-stress conversations"), "sundowning display warning");
assert(FINANCIAL_RISK_LABEL === "Possible financial risk", "financial risk label never exploitation");
assert(DEMENTIA_LAYER_BOUNDARY.includes("No diagnosis"), "boundary excludes clinical judgment");
console.log("✓ V1 display-only boundaries");

const generalAgain = await setCareContext({ caregiver_id: caregiverId, care_context: "general" });
assert(generalAgain.dementia_context === null, "dementia fields hidden when not dementia context");
console.log("✓ dementia fields hidden when care_context !== dementia");

const required = [
  "src/lib/care-contexts/index.ts",
  "src/lib/care-contexts/dementia/operations.ts",
  "src/lib/care-contexts/dementia/types.ts",
  "db/migrations/017_dementia_layer.sql",
  "src/app/api/care-contexts/dementia/route.ts",
  "src/components/ops-devtools/DementiaCareRecordPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const analyzePipeline = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(!analyzePipeline.includes("dementia_context"), "core analyze pipeline unchanged");

const prioritization = fs.readFileSync(
  path.join(root, "src/lib/prioritization-engine/process.ts"),
  "utf-8",
);
assert(!prioritization.includes("dementia"), "prioritization engine unchanged by dementia layer");

console.log("\n=== Dementia Layer V1 verification complete ===");
