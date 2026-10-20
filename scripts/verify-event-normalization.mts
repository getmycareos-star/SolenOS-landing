/**
 * verify-event-normalization.mts
 * Event Normalization — atomicity, split, merge, confidence tiers.
 */

import fs from "node:fs";
import path from "node:path";

import {
  normalizeEvents,
  splitCompositeInput,
  deduplicateEvents,
  isNoiseFragment,
  classifyConfidenceTier,
  resetNormalizationStore,
  CONFIDENCE_AUTO_COMMIT,
  CONFIDENCE_NEEDS_REVIEW,
  createNormalizedEventId,
} from "../src/lib/event-normalization";
import { withNormalizedDualTime } from "../src/lib/event-normalization/dual-time";
import { extractCandidatesFromRawInput } from "../src/lib/data-acquisition-resilience";
import { resetDareStore, ingestRawInput } from "../src/lib/data-acquisition-resilience";
import { processSituationInput, resetCareContextRootStore } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Event Normalization ===\n");

resetNormalizationStore();
resetDareStore();
resetCareContextRootStore();
resetCareEventStore();

assert(CONFIDENCE_AUTO_COMMIT === 0.85, "auto-commit threshold 0.85");
assert(CONFIDENCE_NEEDS_REVIEW === 0.65, "needs-review threshold 0.65");
console.log("✓ confidence tier constants");

const composite = splitCompositeInput("Mom fell, went to hospital, and got medication changed");
assert(composite.length >= 3, "composite split into atomic events");
assert(composite.some((e) => e.atomic_type === "incident_occurred"), "fall event");
assert(composite.some((e) => e.atomic_type === "appointment_occurred"), "hospital event");
assert(composite.some((e) => e.atomic_type === "medication_changed"), "medication event");
console.log("✓ composite event splitting");

const noise = isNoiseFragment("feels tired");
assert(noise.noise === true, "noise fragment detected");
assert(noise.attach_to === "symptom_observed", "noise attaches to symptom");
console.log("✓ atomicity — noise not standalone");

assert(classifyConfidenceTier(0.9) === "auto_commit", "high confidence auto-commit");
assert(classifyConfidenceTier(0.7) === "needs_review", "mid confidence needs review");
assert(classifyConfidenceTier(0.4) === "quarantine", "low confidence quarantine");
console.log("✓ confidence tiers");

const caregiverId = "cg_norm";
const dualA = withNormalizedDualTime("doctor visit Monday", new Date().toISOString());
const dualB = withNormalizedDualTime("appointment with doctor Monday", new Date().toISOString());

const { toCommit, merged } = deduplicateEvents(
  [
    {
      id: createNormalizedEventId(),
      atomic_type: "appointment_occurred",
      label: "doctor visit Monday",
      source_text: "doctor visit Monday",
      confidence: 0.88,
      confidence_tier: "auto_commit",
      status: "committed",
      entities: [],
      attributes: {},
      uncertainty: [],
      attached_fragments: [],
      merged_from_ids: [],
      updated_event_id: null,
      raw_input_id: "ri_a",
      candidate_id: null,
      timestamp: dualA.timestamp,
      event_time: dualA.event_time,
      ingestion_time: dualA.ingestion_time,
      needs_review: false,
    },
  ],
  [
    {
      id: createNormalizedEventId(),
      atomic_type: "appointment_occurred",
      label: "appointment with doctor Monday",
      source_text: "appointment with doctor Monday",
      confidence: 0.86,
      confidence_tier: "auto_commit",
      status: "committed",
      entities: [],
      attributes: {},
      uncertainty: [],
      attached_fragments: [],
      merged_from_ids: [],
      updated_event_id: null,
      raw_input_id: "ri_b",
      candidate_id: null,
      timestamp: dualB.timestamp,
      event_time: dualB.event_time,
      ingestion_time: dualB.ingestion_time,
      needs_review: false,
    },
  ],
);

assert(merged.length >= 1 || toCommit.length === 0, "deduplication merges similar events");
console.log("✓ deduplication within 48h window");

const ocrFail = ingestRawInput({
  caregiver_id: caregiverId,
  content: "",
  input_type: "pdf",
  ocr_confidence: 0.1,
});

assert(ocrFail.normalization?.could_not_process === true, "OCR failure creates unprocessed");
assert(
  ocrFail.normalization?.unprocessed[0]?.atomic_type === "unprocessed_input",
  "unprocessed_input type",
);
console.log("✓ OCR failure → unprocessed_input quarantine");

const integrated = await processSituationInput({
  raw_input: "Mom fell, went to hospital, and got medication changed",
  caregiver_id: "cg_norm_integrated",
});

assert(integrated.what_merged_or_split.length >= 1, "merged/split reported in output");
assert(
  integrated.what_merged_or_split.some((s) => s.includes("Split")) ||
    integrated.events_created.length >= 1,
  "composite split or events committed",
);
console.log("✓ normalization wired into situation pipeline");

const required = [
  "src/lib/event-normalization/index.ts",
  "src/lib/event-normalization/event-normalizer.ts",
  "src/lib/event-normalization/split-composite.ts",
  "src/lib/event-normalization/deduplicate.ts",
  "src/lib/event-normalization/atomicity-rules.ts",
  "src/lib/event-normalization/confidence-tiers.ts",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const darePipeline = fs.readFileSync(
  path.join(root, "src/lib/data-acquisition-resilience/pipeline.ts"),
  "utf-8",
);
assert(darePipeline.includes("normalizeEvents"), "DARE calls EventNormalizer");

console.log("\n=== Event Normalization verification complete ===");
