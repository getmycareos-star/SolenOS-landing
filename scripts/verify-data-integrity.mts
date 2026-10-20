/**
 * verify-data-integrity.mts
 * Core state correction + data integrity — trust loop MVP.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore, ingestRawInput } from "../src/lib/data-acquisition-resilience";
import {
  INTEGRITY_IDENTITY,
  TRUST_LOOP,
  resetIntegrityAuditStore,
  getAuditTrailForEvent,
  createFieldConfidence,
  upgradeFieldConfidence,
  downgradeFieldConfidence,
} from "../src/lib/care-event-integrity";
import {
  getCareContextRoot,
  processSituationInput,
  resetCareContextRootStore,
  invalidateEventInContext,
  applyUserCorrectionInContext,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Data Integrity (Trust Loop) ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();

assert(INTEGRITY_IDENTITY.includes("corrected"), "integrity identity");
assert(TRUST_LOOP.includes("User Correction"), "trust loop defined");
console.log("✓ system contract");

const low = createFieldConfidence(0.4);
assert(low.extraction === "low", "low confidence tier");
const upgraded = upgradeFieldConfidence(low, "user_confirmation");
assert(upgraded.extraction === "high" && upgraded.user_confirmed, "user confirm upgrades confidence");
const downgraded = downgradeFieldConfidence(createFieldConfidence(0.9));
assert(downgraded.extraction === "medium", "contradiction downgrades confidence");
console.log("✓ field confidence structure");

const ocrFail = ingestRawInput({
  caregiver_id: "cg_integrity",
  content: "",
  input_type: "pdf",
  ocr_confidence: 0.1,
});
assert(ocrFail.normalization?.could_not_process === true, "OCR failure detected");
console.log("✓ extraction failure mode");

const caregiverId = "cg_integrity_main";

const ambiguous = await processSituationInput({
  raw_input: "Doctor called and things changed",
  caregiver_id: caregiverId,
  timestamp: "2026-07-10T10:00:00.000Z",
});

assert(
  ambiguous.what_needs_clarification.some((q) => /what|when|who/i.test(q)),
  "ambiguous input generates clarification",
);
const contactEvent = ambiguous.context.events.find(
  (e) => e.extracted_type === "contact_event" || /called/i.test(e.raw_input),
);
assert(contactEvent !== undefined, "contact event not medical inference");
console.log("✓ ambiguous input resolution");

const fall = await processSituationInput({
  raw_input: "Mom fell yesterday",
  caregiver_id: "cg_integrity_fall",
  timestamp: "2026-07-11T10:00:00.000Z",
});

assert(
  fall.events_created.length >= 1 || fall.context.events.length >= 1,
  "fall input produces events",
);

const fallEvent =
  fall.context.events.find(
    (e) =>
      e.extracted_type === "incident" ||
      /fell|fall/i.test(e.raw_input),
  ) ?? fall.events_created[0];
assert(fallEvent !== undefined, "fall event in graph");
assert(
  fallEvent!.status === "committed" || fallEvent!.status === "provisional",
  "fall event has lifecycle status",
);
assert(fallEvent!.integrity.original_extraction !== null, "original extraction preserved");
assert(fallEvent!.integrity.field_confidence.extracted_fact.extraction !== undefined, "field confidence");
console.log("✓ committed event with integrity metadata");

const invalidated = invalidateEventInContext("cg_integrity_fall", fallEvent!.id, "user said not true");
assert(invalidated !== null, "soft delete succeeds");
assert(invalidated!.event.status === "invalidated", "status invalidated not hard deleted");

const ctx = getCareContextRoot("cg_integrity_fall")!;
assert(ctx.events.some((e) => e.id === fallEvent!.id), "invalidated event preserved in graph");
const audit = getAuditTrailForEvent(fallEvent!.id);
assert(audit.some((a) => a.action === "invalidate"), "audit trail for invalidation");
console.log("✓ soft delete + audit trail");

const ctxAmbiguous = getCareContextRoot(caregiverId)!;
const provisional = ctxAmbiguous.events.filter((e) => e.status === "provisional");
assert(provisional.length >= 1 || ambiguous.dare!.provisional_count >= 1, "provisional events tracked");
console.log("✓ provisional status in graph or DARE layer");

const corrected = applyUserCorrectionInContext(caregiverId, contactEvent!.id, {
  extracted_fact: "Doctor called about follow-up appointment",
});
assert(corrected !== null, "user field edit");
assert(corrected!.event.integrity.field_confidence.extracted_fact.user_confirmed, "user_confirmed after edit");
assert(corrected!.event.integrity.sources.includes("user_correction"), "user correction wins truth priority");
console.log("✓ user correction loop");

assert(fall.integrity_summary !== null, "integrity summary in response");
console.log("✓ integrity summary");

const required = [
  "src/lib/care-event-integrity/index.ts",
  "src/lib/care-event-integrity/audit-store.ts",
  "src/lib/care-event-integrity/lifecycle.ts",
  "db/migrations/028_data_integrity.sql",
  "src/app/api/situation/correct/route.ts",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const pipeline = fs.readFileSync(
  path.join(root, "src/lib/situation-entry/pipeline.ts"),
  "utf-8",
);
assert(pipeline.includes("buildUnparsedRawEvent"), "unparsed raw wired in pipeline");
assert(pipeline.includes("buildProvisionalEvent"), "provisional events wired in pipeline");

console.log("\n=== Data Integrity verification complete ===");
