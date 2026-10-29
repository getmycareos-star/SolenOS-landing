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

const claimPanel = fs.readFileSync(path.join(process.cwd(), "src/components/ClaimAssessmentPanel.tsx"), "utf8");
for (const status of [
  "supported", "partially_supported", "contradicted", "unverified", "uncertain",
  "conflicting", "missing_evidence", "stale", "superseded", "withdrawn",
]) {
  assert(claimPanel.includes(`"${status}"`), `claim assessment UI must expose ${status}`);
}
assert(claimPanel.includes("/assessments"), "claim assessment UI must persist and retrieve assessment history");
assert(claimPanel.includes("Exact source passage"), "claim assessment UI must require a source passage workflow");
assert(claimPanel.includes("superseded_by_claim_id"), "superseded claims must record a specific replacement claim");
assert(claimPanel.includes("failed request is not an empty history"), "failed history reads must not be presented as empty history");
console.log("PASS: LCR claim assessment UI exposes explicit statuses, exact passages, and persisted history.");

assert(panel.includes("/relationships"), "source-lineage UI must use the persisted relationship API");
assert(panel.includes("source_independence_status"), "source-lineage UI must display explicit source-independence state");
assert(panel.includes("shared_origin"), "source-lineage UI must preserve shared-origin/dependent-source state");
assert(panel.includes("not automatic proof"), "source-lineage UI must not equate a relationship with verified truth");
assert(panel.includes("The source relationship was not confirmed as saved"), "failed relationship writes must not be shown as successful");
console.log("PASS: source-lineage UI persists explicit relationship assessments without claiming they prove truth.");

assert(panel.includes("/observations"), "evidence UI must use the persisted source-grounded observation API");
assert(panel.includes("exact passage copied from the original evidence"), "observation UI must require source-grounded text");
assert(panel.includes("A reported account remains reported"), "observation UI must preserve report versus observation distinctions");
assert(panel.includes("unknown/missing"), "observation UI must not fabricate values for unknown or missing data");
console.log("PASS: source-grounded observation UI preserves exact source spans and epistemic distinctions.");

assert(panel.includes("supersedes_observation_id"), "observation corrections must link to the prior version");
assert(panel.includes("Correction rationale"), "observation correction UI must require a rationale");
console.log("PASS: observation correction history must be versioned and justified.");

const lcr = fs.readFileSync(path.join(process.cwd(), "src/components/mvp-workspace/LCRCurrentUnderstanding.tsx"), "utf8");
assert(lcr.includes("import EvidenceReviewPanel from \"@/components/EvidenceReviewPanel\""), "the real LCR route must import the evidence workflow");
assert(lcr.includes("<EvidenceReviewPanel personId={personId} />"), "the evidence workflow must be mounted in the LCR, not left as an unused component");
assert(lcr.includes("<ClaimAssessmentPanel />"), "claim assessments must be reachable from the LCR workflow");
assert(lcr.includes("<CareContinuityIntegrityPanel personId={personId} />"), "care continuity integrity must be reachable from the LCR workflow");
console.log("PASS: evidence, claim assessment, and care-integrity panels are mounted in the actual LCR workflow.");
