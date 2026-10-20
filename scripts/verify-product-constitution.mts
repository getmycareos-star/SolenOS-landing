/**
 * verify-product-constitution.mts
 * Product Constitution + CareRecord spine (state before UI).
 */

import "./_verify-env.mts";
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
import { seedVerifyConsent, resetPolicyEngineStore } from "../src/lib/policy-engine";
import { resetJourneyInteractionStore } from "../src/lib/single-user-journey";
import { resetRetentionSessionStore } from "../src/lib/retention-engine";
import {
  resetDerivedTables,
  resetEventStore,
  resetProjectionStore,
  resetSessionStore,
} from "../src/lib/event-sourced-storage";
import {
  CARE_RECORD_SPINE,
  evaluateFeatureAgainstConstitution,
  EXTERNAL_TAGLINE,
  PRODUCT_CONSTITUTION_WORLDVIEW,
  PRODUCT_ULTIMATE_METRIC,
  projectCareRecordModel,
  projectDailyCareConfidence,
} from "../src/lib/product-constitution";
import { passesBuildFilter } from "../src/lib/forbidden-build-zone";
import {
  resetCareContextRootStore,
  processSituationInput,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function resetAll(): void {
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
  resetRetentionSessionStore();
  resetJourneyInteractionStore();
  resetEventStore();
  resetProjectionStore();
  resetSessionStore();
  resetDerivedTables();
  resetPolicyEngineStore();
}

console.log("=== SolenOS Product Constitution ===\n");

assert(
  PRODUCT_CONSTITUTION_WORLDVIEW.includes("remember everything"),
  "worldview",
);
assert(PRODUCT_ULTIMATE_METRIC.includes("more certain"), "ultimate metric");
assert(EXTERNAL_TAGLINE.includes("remembered"), "tagline");
assert(CARE_RECORD_SPINE.length === 10, "ten spine fields");
assert(CARE_RECORD_SPINE.includes("outcomes"), "outcomes in spine");
assert(CARE_RECORD_SPINE.includes("unknowns"), "unknowns in spine");
assert(CARE_RECORD_SPINE.includes("confidence_scores"), "confidence in spine");
console.log("✓ constitution contracts");

assert(
  fs.existsSync(path.join(root, "db/migrations/071_product_constitution.sql")),
  "migration 071",
);
assert(
  fs.existsSync(path.join(root, ".cursor/rules/solenos-product-constitution.mdc")),
  "cursor rule",
);
console.log("✓ migration + cursor rule");

const passState = evaluateFeatureAgainstConstitution(
  "Care State Engine change detection and missing information layer",
);
assert(passState.verdict === "pass", "care state feature passes");

const rejectDash = evaluateFeatureAgainstConstitution(
  "Build a complex health dashboard for caregivers",
);
assert(rejectDash.verdict === "reject", "dashboard rejected");

const unclear = evaluateFeatureAgainstConstitution("Add a purple theme toggle");
assert(unclear.verdict === "unclear_rejected", "unclear rejected");

const rejectTask = evaluateFeatureAgainstConstitution(
  "Build a task manager reminder app for caregivers",
);
assert(rejectTask.verdict === "reject", "task manager rejected");

assert(
  !passesBuildFilter({
    feature_description: "AI companion personality chatbot",
    touches_event_pipeline: true,
    improves_care_record: true,
  }).allowed,
  "companion blocked",
);
console.log("✓ constitution feature gate");

// Source gates — caregiver capture is Living Care Record, not chat
{
  const capture = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx"),
    "utf8",
  );
  assert(!/What's on your mind/i.test(capture), "capture must not chat-prompt");
  assert(/What happened/i.test(capture), "capture is record-oriented");
  const brand = fs.readFileSync(
    path.join(root, "src/lib/brand/contract-constants.ts"),
    "utf8",
  );
  assert(
    brand.includes("Preserve continuity. Build trust. Reduce burden."),
    "brand motto matches constitution",
  );
  const boundary = fs.readFileSync(path.join(root, "docs/PRODUCT_BOUNDARY.md"), "utf8");
  assert(/Living Care Record/i.test(boundary), "product boundary names Living Care Record");
  assert(!/cognitive clarity engine/i.test(boundary), "product boundary not clarity-engine identity");
  console.log("✓ caregiver identity + capture copy");
}

const projected = projectCareRecordModel({
  care_recipient_id: "cr_test",
  events: [],
  unknowns: ["Need updated medication confirmation"],
  as_of: "2026-07-15T12:00:00.000Z",
});
assert(projected.unknowns.length === 1, "unknowns projected");
assert(projected.confidence_scores.length >= 1, "confidence scores");
assert(Array.isArray(projected.medications), "medications spine");
assert(
  !projected.person_profile.some((l) => /cr_test/.test(l)),
  "person_profile must not dump raw care_recipient_id",
);
assert(
  projected.person_profile.some((l) => /Living Care Record/i.test(l)),
  "person_profile names Living Care Record",
);
console.log("✓ CareRecord spine projection (state before UI)");

{
  const withGaps = projectCareRecordModel({
    care_recipient_id: "cr_gap",
    events: [],
    unknowns: ["Timing of last dose unclear"],
    as_of: "2026-07-15T12:00:00.000Z",
  });
  const daily = projectDailyCareConfidence({
    care_record: withGaps,
    recent_changes: [],
    needs_attention: [],
    what_is_stable: [],
    event_count: 0,
  });
  assert(
    !/requires immediate action/i.test(daily.nothing_urgent.join(" ")),
    "no false-certainty nothing-urgent claim",
  );
  assert(
    /still missing|so far/i.test(daily.nothing_urgent.join(" ")),
    "uncertainty-preserving nothing_urgent language",
  );
  console.log("✓ no false certainty in daily confidence");
}

resetAll();
const caregiverId = "cg_constitution";
seedVerifyConsent(caregiverId);

const result = await processSituationInput({
  raw_input:
    "Mom almost fell again and ate very little. Medication was changed last week after the hospital visit.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-12T10:00:00.000Z",
});

assert(result.product_constitution_layer?.active === true, "layer active");
assert(
  result.product_constitution_layer!.care_record.events.length > 0 ||
    result.care_state_engine_layer!.care_state.events.length > 0,
  "events in CareRecord/Care State",
);
assert(
  result.product_constitution_layer!.daily_care_confidence.understanding_level.length > 0,
  "daily confidence model",
);
assert(result.product_constitution_layer!.documents_are_inputs_only === true, "docs are inputs");
assert(result.product_constitution_layer!.start_with_state_not_ui === true, "state before UI");
assert(result.product_constitution_layer!.memory_is_not_diagnosis === true, "not diagnosis");
assert(
  result.product_constitution_layer!.care_record.medications.length > 0 ||
    /medication/i.test(
      result.product_constitution_layer!.care_record.events.join(" "),
    ),
  "medication signal lands on CareRecord spine",
);
assert(
  !/requires immediate action/i.test(
    result.product_constitution_layer!.daily_care_confidence.nothing_urgent.join(" "),
  ),
  "pipeline daily confidence has no false certainty",
);
assert(
  result.care_state_engine_layer!.care_state.confidence_scores.length > 0,
  "Care State confidence spine",
);
assert(
  Array.isArray(result.care_state_engine_layer!.care_state.medications),
  "Care State medications",
);
console.log("✓ pipeline wires Product Constitution + CareRecord spine");

console.log("\n=== Product Constitution: ALL CHECKS PASSED ===\n");
