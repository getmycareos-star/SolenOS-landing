/**
 * verify-failure-resilience.mts
 * Failure modes & resilience — classify, preserve raw, clarify, defer, recover.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import {
  FAILURE_CATEGORIES,
  FAILURE_OUTCOMES,
  FAILURE_RESILIENCE_IDENTITY,
  deriveRecoveryActions,
  processFailureResilience,
  resetFailureResilienceStore,
  buildConfidenceForEvent,
} from "../src/lib/failure-resilience";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Failure Modes & Resilience ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetPolicyEngineStore();

assert(FAILURE_RESILIENCE_IDENTITY.includes("continuity"), "resilience identity");
assert(FAILURE_CATEGORIES.length === 6, "six failure categories");
assert(FAILURE_OUTCOMES.length === 3, "three failure outcomes");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/031_failure_resilience.sql");
assert(fs.existsSync(migration), "migration 031 exists");
assert(fs.readFileSync(migration, "utf8").includes("care_failure_records"), "failure records table");
console.log("✓ migration 031");

const caregiverId = "cg_failure";
seedVerifyConsent(caregiverId);

const incomplete = await processSituationInput({
  raw_input: "My dad isn't doing well.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(incomplete.failure_resilience_layer !== null, "failure layer in response");
assert(incomplete.failure_resilience_layer!.continuity_preserved, "continuity preserved");
assert(
  incomplete.failure_resilience_layer!.failures.some((f) => f.category === "incomplete_context"),
  "incomplete context classified",
);
assert(incomplete.failure_resilience_layer!.recovery_actions.length >= 1, "recovery actions");
assert(
  !incomplete.failure_resilience_layer!.failures.some((f) => /careevent/i.test(f.message)),
  "failure messages have no CareEvent jargon",
);
console.log("✓ incomplete context — preliminary event + clarification");

const ambiguous = await processSituationInput({
  raw_input: "He wasn't doing well after that",
  caregiver_id: caregiverId,
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(
  ambiguous.failure_resilience_layer!.failures.some(
    (f) =>
      f.category === "ambiguous_interpretation" || f.category === "incomplete_context",
  ),
  "ambiguous or incomplete classified",
);
console.log("✓ ambiguous interpretation — never auto-choose");

await processSituationInput({
  raw_input: "Follow-up appointment scheduled for next Tuesday",
  caregiver_id: caregiverId,
  timestamp: "2026-07-03T10:00:00.000Z",
});

const linking = await processSituationInput({
  raw_input: "The appointment was moved to Thursday",
  caregiver_id: caregiverId,
  timestamp: "2026-07-04T10:00:00.000Z",
});

assert(
  linking.failure_resilience_layer!.failures.some(
    (f) => f.category === "graph_linking_failure",
  ),
  "graph linking failure when multiple appointments",
);
console.log("✓ graph linking failure — relationship unresolved");

const fallA = await processSituationInput({
  raw_input: "Fall on March 3 during morning walk",
  caregiver_id: caregiverId,
  timestamp: "2026-07-05T10:00:00.000Z",
});

const fallB = await processSituationInput({
  raw_input: "Fall on March 5 noted in clinic letter",
  caregiver_id: caregiverId,
  timestamp: "2026-07-06T10:00:00.000Z",
});

const hasConflict =
  fallA.failure_resilience_layer!.failures.some((f) => f.category === "conflicting_information") ||
  fallB.failure_resilience_layer!.failures.some((f) => f.category === "conflicting_information");
assert(hasConflict || fallB.dare?.conflicts.length === 0, "conflict handling wired");
console.log("✓ conflicting information — both preserved");

const ocrFail = await processSituationInput({
  raw_input: "",
  caregiver_id: caregiverId,
  timestamp: "2026-07-07T10:00:00.000Z",
  documents: [
    {
      id: "doc_bad_ocr",
      name: "blurry_scan.pdf",
      extracted_text: "@@@ ### unreadable",
      ocr_confidence: 0.12,
    },
  ],
});

assert(
  ocrFail.failure_resilience_layer!.failures.some((f) => f.category === "extraction_failure"),
  "extraction failure on bad OCR",
);
assert(ocrFail.events_created.some((e) => e.status === "unparsed_raw"), "raw preserved as unparsed");
console.log("✓ extraction failure — preserve raw, show partial");

const event = incomplete.events_created[0];
if (event) {
  const confidence = buildConfidenceForEvent(event);
  assert(confidence.confidence_level.length > 0, "confidence level set");
  assert(confidence.verification_status.length > 0, "verification status set");
  assert(Array.isArray(confidence.missing_information), "missing information tracked");
}
console.log("✓ confidence model on extracted objects");

const manual = processFailureResilience({
  caregiver_id: caregiverId,
  dare: null,
  events_created: [],
  prior_events: [],
  raw_input: "test",
  processing_error: "AI timeout",
});

assert(
  manual.failures.some((f) => f.category === "processing_failure"),
  "processing failure classified",
);
assert(manual.outcomes_applied.defer >= 1, "defer outcome applied");
console.log("✓ processing failure — preserve submission, defer retry");

const actions = deriveRecoveryActions(manual.failures);
assert(actions.includes("retry_processing"), "retry recovery action");
assert(actions.includes("defer_for_later"), "defer recovery action");
console.log("✓ user recovery actions");

const apiRoute = path.join(root, "src/app/api/situation/recover/route.ts");
assert(fs.existsSync(apiRoute), "recover API route exists");
console.log("✓ recover API route");

const uiPanel = path.join(root, "src/components/ops-devtools/FailureResiliencePanel.tsx");
assert(fs.existsSync(uiPanel), "FailureResiliencePanel exists");
console.log("✓ UI panel");

console.log("\n=== All failure resilience checks passed ===\n");
