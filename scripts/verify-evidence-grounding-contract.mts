import fs from "node:fs";
import path from "node:path";
import {
  buildEvidenceObject,
  buildEvidencedConclusion,
  collectEvidenceFromInterpretation,
  ratifyPriorityWithEvidence,
} from "../src/lib/evidence-preservation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const collected = collectEvidenceFromInterpretation({} as never);
assert(collected.event_ids.length === 0, "interpretation must not create a synthetic care-event ID");
assert(collected.timeline_references.length === 0, "interpretation wording must not be mislabeled as source timeline evidence");
assert(collected.confidence_score == null, "interpretation must not receive a fabricated confidence score");
assert(collected.source_reliability_score == null, "interpretation must not receive a fabricated source-reliability score");

const evidence = buildEvidenceObject({
  event_ids: [],
  timeline_labels: [],
  confidence_score: 0.99,
  source_reliability_score: 0.98,
  age_days: 0,
  reasoning_summary: "Test of uncalibrated inputs.",
});
assert(evidence.confidence_score === null, "caller-supplied confidence must not be emitted as calibrated");
assert(evidence.source_reliability_score === null, "caller-supplied reliability must not be emitted as validated");
assert(evidence.recency_weight === null, "universal recency decay must not be invented");
assert(evidence.linkage_status === "no_linked_event_references", "empty evidence links must remain explicit");

const conclusion = buildEvidencedConclusion({
  recommendation: "Candidate conclusion",
  evidence,
});
assert(conclusion.layers.grounding_status === "no_linked_event_references", "unlinked conclusion must remain visibly ungrounded");
assert(/not calibrated/i.test(conclusion.layers.confidence), "unvalidated confidence must be disclosed");

const countOnly = ratifyPriorityWithEvidence("priority", 3);
assert(countOnly.confidence === null, "item count must not become a numeric confidence");
assert(/independence.*quality.*conflict/i.test(countOnly.conclusion), "item count must not imply independent corroboration or sufficiency");

console.log("PASS: evidence builder emits no synthetic event IDs, confidence, source-reliability or recency scores.");

const panel = fs.readFileSync(path.join(process.cwd(), "src/components/EvidenceReviewPanel.tsx"), "utf8");
assert(panel.includes("/integrity"), "evidence review UI must call the persisted source-integrity endpoint");
assert(panel.includes("source_text_integrity_status"), "evidence review UI must display the server-computed integrity status");
assert(panel.includes("Original file authenticity"), "the UI must disclose that a text hash does not authenticate the uploaded original");
console.log("PASS: evidence review UI displays server-computed integrity without claiming original-file authenticity.");

