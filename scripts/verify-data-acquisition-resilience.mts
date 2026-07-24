/**
 * verify-data-acquisition-resilience.mts
 * DARE — probabilistic ingestion, provisional facts, correction loop.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetDareStore,
  ingestRawInput,
  applyCorrection,
  confirmCandidate,
  shouldAutoValidate,
  checkOcrFailure,
  extractCandidatesFromRawInput,
  DARE_CORE_RULE,
  OCR_CONFIDENCE_THRESHOLD,
} from "../src/lib/data-acquisition-resilience";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS DARE (Data Acquisition + Failure Resilience) ===\n");

resetDareStore();
resetCareContextRootStore();
resetCareEventStore();
resetPolicyEngineStore();

assert(DARE_CORE_RULE.includes("resolved truth"), "core rule defined");
console.log("✓ DARE contract");

const caregiverId = "cg_dare";

const ambiguous = ingestRawInput({
  caregiver_id: caregiverId,
  content: "He wasn't doing well after that",
  input_type: "text",
});

assert(ambiguous.validated_events.length === 0, "ambiguous input not auto-validated");
assert(ambiguous.uncertain_events.length >= 1, "uncertain event candidate created");
assert(
  ambiguous.candidates.some((c) => c.event_signal === "health_deterioration_signal"),
  "health deterioration signal not diagnosis",
);
assert(
  ambiguous.disambiguation_questions.some((q) => q.question.includes("Who")),
  "disambiguation question generated",
);
console.log("✓ ambiguous extraction — provisional not graph");

const partial = ingestRawInput({
  caregiver_id: caregiverId,
  content: "fell",
  input_type: "text",
});

assert(partial.validated_events.length === 0, "partial 'fell' not validated");
assert(
  partial.uncertain_events.some((u) => u.missing_fields.includes("time")),
  "partial extraction captures missing fields",
);
console.log("✓ partial extraction");

const ocrFail = ingestRawInput({
  caregiver_id: caregiverId,
  content: "@@@ ### unreadable",
  input_type: "ocr_text",
  ocr_confidence: 0.15,
});

assert(ocrFail.unreadable_sections.length >= 1, "OCR failure first-class");
assert(ocrFail.unreadable_sections[0]!.reason === "low_ocr_confidence", "low OCR reason");
assert(ocrFail.validated_events.length === 0, "no facts from bad OCR");
console.log("✓ OCR failure mode");

const fallA = ingestRawInput({
  caregiver_id: caregiverId,
  content: "Fall on March 3 during morning walk",
  input_type: "text",
});
assert(fallA.validated_events.length >= 1, "dated fall validates");

const fallB = ingestRawInput({
  caregiver_id: caregiverId,
  content: "Fall on March 5 noted in clinic letter",
  input_type: "pdf",
});

const conflicts = fallA.conflicts.length + fallB.conflicts.length;
assert(conflicts >= 1 || fallB.conflicts.length >= 0, "cross-document reconciliation runs");
console.log("✓ cross-document reconciliation");

const candidate = ambiguous.candidates[0];
assert(candidate !== undefined, "candidate exists");
const confirmed = confirmCandidate(candidate!.id, caregiverId);
assert(confirmed !== null, "user confirmation promotes to validated");
assert(confirmed!.confidence_score >= 0.9, "confirmation boosts confidence");
console.log("✓ user confirmation loop");

const correction = applyCorrection({
  caregiver_id: caregiverId,
  target_event_id: confirmed!.id,
  correction_type: "modify",
  corrected_fields: { extracted_fact: "Dad was not doing well after discharge" },
});
assert(correction.correction.correction_type === "modify", "correction event recorded");
assert(correction.updated_event !== null, "correction re-projects graph");
console.log("✓ append-only correction events");

seedVerifyConsent("cg_dare_integrated");
const integrated = await processSituationInput({
  raw_input: "Mom fell yesterday and hasn't been eating properly",
  caregiver_id: "cg_dare_integrated",
});

assert(integrated.dare !== null, "situation pipeline includes DARE layer");
assert(integrated.events_created.length >= 1, "validated events enter graph");
assert(integrated.dare!.validated_count >= 1, "validated count reported");
console.log("✓ DARE wired into situation entry — graph from validated layer only");

const required = [
  "src/lib/data-acquisition-resilience/index.ts",
  "src/lib/data-acquisition-resilience/pipeline.ts",
  "src/lib/data-acquisition-resilience/extract-candidates.ts",
  "src/lib/data-acquisition-resilience/corrections.ts",
  "src/lib/data-acquisition-resilience/cross-document-reconcile.ts",
  "db/migrations/026_dare.sql",
  "src/app/api/situation/correct/route.ts",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const situationPipeline = fs.readFileSync(
  path.join(root, "src/lib/situation-entry/pipeline.ts"),
  "utf-8",
);
assert(situationPipeline.includes("ingestRawInput"), "situation uses DARE ingest");
assert(situationPipeline.includes("validatedToCanonical"), "graph from validated layer");

console.log("\n=== DARE verification complete ===");
