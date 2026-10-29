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
assert(claimPanel.includes("/assessment-impact"), "claim assessment panel must retrieve persisted evidence-change/reassessment impact");
assert(claimPanel.includes("Assessment impact could not be checked"), "failed assessment-impact reads must not imply that the assessment is current");
assert(claimPanel.includes("No deterministic review trigger found"), "assessment-impact UI must state the bounded nature of a no-trigger result");
assert(claimPanel.includes("does not prove truth or completeness"), "assessment-impact UI must disclose that deterministic triggers do not establish truth or completeness");
console.log("PASS: claim assessment impact is connected to the LCR with fail-safe error messaging and explicit interpretation limits.");
assert(claimPanel.includes("/uncertainty/claims/dependencies"), "claim dependency UI must persist relationships through the authenticated backend API");
assert(claimPanel.includes("/uncertainty/claims/"), "claim dependency UI must retrieve the persisted dependency graph");
assert(claimPanel.includes("not proof of truth"), "dependency links must not be presented as proof of claim truth");
assert(claimPanel.includes("Dependency persistence was not confirmed"), "failed dependency writes must not be shown as successful");
console.log("PASS: claim dependency graph is connected to the LCR with failure-safe persistence messaging.");

assert(panel.includes("/relationships"), "source-lineage UI must use the persisted relationship API");
assert(panel.includes("source_independence_status"), "source-lineage UI must display explicit source-independence state");
assert(panel.includes("shared_origin"), "source-lineage UI must preserve shared-origin/dependent-source state");
assert(panel.includes("not automatic proof"), "source-lineage UI must not equate a relationship with verified truth");
assert(panel.includes("The source relationship was not confirmed as saved"), "failed relationship writes must not be shown as successful");
console.log("PASS: source-lineage UI persists explicit relationship assessments without claiming they prove truth.");

const companion = fs.readFileSync(path.join(process.cwd(), "src/components/workflows/AICompanion.tsx"), "utf8");
assert(companion.includes("Evidence source lineage"), "Companion handoff preview must render source lineage, not only type it");
assert(companion.includes("scope_truncated"), "Companion must disclose bounded or truncated lineage retrieval");
assert(companion.includes("not proof") || companion.includes("not proof that sources are independent"), "Companion must not present missing lineage groups as proof of independence");
console.log("PASS: Companion handoff preview exposes source-lineage groups and truncation limits.");

const appointment = fs.readFileSync(path.join(process.cwd(), "src/components/workflows/AppointmentWorkspace.tsx"), "utf8");
assert(appointment.includes("Evidence source lineage"), "Appointment preparation must render source lineage");
assert(appointment.includes("scope_truncated"), "Appointment preparation must disclose bounded lineage retrieval");
assert(appointment.includes("not establish that the sources are independent"), "Appointment preparation must not infer independence from missing lineage");
console.log("PASS: appointment preparation exposes evidence lineage and bounded-scope limits.");

const evidenceReview = fs.readFileSync(path.join(process.cwd(), "src/components/EvidenceReviewPanel.tsx"), "utf8");
assert(evidenceReview.includes("/care-continuity/state-revisions/evidence/"), "Evidence review must call the persisted as-of reconstruction API");
assert(evidenceReview.includes("persisted_care_state_revision"), "Evidence review must validate the historical response source");
assert(evidenceReview.includes("This does not establish that the evidence did not exist"), "Historical lookup failure must not be displayed as evidence absence");
console.log("PASS: evidence review exposes persisted historical reconstruction with an explicit absence limitation.");

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
assert(panel.includes("expectedPersonId !== session.person.id"), "evidence review must reject a UI person scope that differs from the authenticated session");
assert(lcr.includes("<ClaimAssessmentPanel />"), "claim assessments must be reachable from the LCR workflow");
assert(lcr.includes("<CareContinuityIntegrityPanel personId={personId} />"), "care continuity integrity must be reachable from the LCR workflow");
assert(lcr.includes("near_duplicate_analysis"), "LCR evidence integrity must consume the backend near-duplicate analysis contract");
assert(lcr.includes("Possible near-duplicate"), "LCR must display near-duplicate candidates for review");
assert(lcr.includes("algorithm_version"), "LCR must show which deterministic candidate-generation version ran");
assert(lcr.includes("interpretation_limit"), "LCR must disclose the limitations of near-duplicate candidate analysis");

console.log("PASS: evidence, claim assessment, and care-integrity panels are mounted in the actual LCR workflow.");
const conflictPanel = fs.readFileSync(path.join(process.cwd(), "src/components/ConflictResolutionPanel.tsx"), "utf8");
assert(conflictPanel.includes("/uncertainty/contradictions/"), "conflict resolution UI must read persisted conflicts and transition history");
assert(conflictPanel.includes("resolution_scope"), "partial conflict resolution must capture and display exact scope");
assert(conflictPanel.includes("linked evidence"), "conflict resolution must expose linked evidence");
assert(conflictPanel.includes("A failed request is not an empty history"), "failed conflict-history reads must not look like an empty history");
assert(conflictPanel.includes("not automatically resolve a conflict"), "conflict UI must reject timestamp/majority-only resolution");
assert(lcr.includes("import ConflictResolutionPanel from \"@/components/ConflictResolutionPanel\""), "LCR must import the conflict resolution workflow");
assert(lcr.includes("<ConflictResolutionPanel personId={personId} />"), "conflict resolution workflow must be mounted in the actual LCR");
console.log("PASS: scoped conflict comparison and partial-resolution history are connected to the LCR.");
const clarificationPanel = fs.readFileSync(path.join(process.cwd(), "src/components/ClarificationWorkflowPanel.tsx"), "utf8");
assert(clarificationPanel.includes("/uncertainty/questions/"), "clarification workflow must persist questions and read answer history from the backend");
assert(clarificationPanel.includes("claim_clarification"), "clarification questions must retain a link to the selected source-attributed claim");
assert(clarificationPanel.includes("claim_id: selectedClaim.id"), "clarification questions must submit the normalized claim foreign key");
assert(clarificationPanel.includes("Legacy question without a normalized claim link"), "legacy questions without normalized links must be labelled honestly");
assert(clarificationPanel.includes("answer_provenance"), "answers must carry explicit provenance");
assert(clarificationPanel.includes("does not automatically verify or resolve the underlying claim"), "answer capture must not automatically resolve its linked claim");
assert(clarificationPanel.includes("intended_answerer_role"), "clarification must record who is best placed to answer when known");
assert(clarificationPanel.includes("necessity_rationale"), "necessary/optional clarification requires a recorded rationale");
assert(clarificationPanel.includes("Immutable answer history"), "clarification answer versions must be visible");
assert(clarificationPanel.includes("A failed request is not an empty history"), "failed answer-history reads must not be shown as empty history");
assert(lcr.includes("import ClarificationWorkflowPanel from \"@/components/ClarificationWorkflowPanel\""), "LCR must import the clarification workflow");
assert(lcr.includes("<ClarificationWorkflowPanel personId={personId} />"), "clarification workflow must be mounted in the actual LCR");
console.log("PASS: claim-linked clarification and immutable attributed answer history are connected to the LCR.");

for (const field of ["reported_at", "collection_method", "origin_device_ref", "transfer_source", "transfer_reference"]) {
  assert(panel.includes(field), `evidence review UI must expose acquisition provenance field ${field}`);
}
assert(panel.includes("Origin device label"), "device provenance must be a privacy-minimizing label, not a raw hardware identifier");
console.log("PASS: LCR evidence review exposes report time, collection method, optional device label, and transfer provenance.");

