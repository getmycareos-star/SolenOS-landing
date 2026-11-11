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
assert(panel.includes("A matching file check only shows that the saved copy has not changed"), "the UI must explain what the saved-copy comparison means");
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
assert(panel.includes("They do not prove that two reports are separate"), "source-lineage UI must not equate a relationship with verified truth");
assert(panel.includes("Links to other sources could not be loaded") && panel.includes("No list is assumed"), "failed relationship reads must not be presented as an empty lineage history");
console.log("PASS: source-lineage UI persists explicit relationship assessments without claiming they prove truth.");

const companion = fs.readFileSync(path.join(process.cwd(), "src/components/workflows/AICompanion.tsx"), "utf8");
assert(companion.includes("How the sources are connected"), "Companion handoff preview must render source lineage, not only type it");
assert(companion.includes("claim_provenance: response.claim_provenance"), "Companion must consume claim-level source references from the backend");
assert(companion.includes("Not matched to the wording in a saved record"), "Companion must visibly mark statements without a matching source");
assert(companion.includes("What this answer is based on"), "Companion must show source details beside the specific statement they support");
assert(companion.includes("Supporting note or document"), "Matched care entries must expose their linked original notes and documents");
assert(companion.includes("source_independence_status === 'shared_origin'"), "Companion must distinguish sources with a shared original");
assert(companion.includes("exact_wording_duplicate_count"), "Companion must disclose repeated wording without counting it as separate corroboration");
assert(companion.includes("matched_historical_only"), "Corrected or replaced source wording must remain visible as history, not current support");
assert(companion.includes("correction_rationale"), "Corrected source details must retain the reason for the correction");
assert(companion.includes("When it happened") && companion.includes("When it was added"), "Claim sources must show occurrence and recording times");
assert(!companion.includes("Inspect source record references"), "caregivers must not be shown a generic list of unrelated source IDs");
assert(companion.includes("scope_truncated"), "Companion must disclose bounded or truncated lineage retrieval");
assert(companion.includes("do not prove that a report is true or that two reports are separate"), "Companion must not present missing lineage groups as proof of independence");
console.log("PASS: Companion handoff preview exposes source-lineage groups and truncation limits.");

const appointment = fs.readFileSync(path.join(process.cwd(), "src/components/workflows/AppointmentWorkspace.tsx"), "utf8");
assert(appointment.includes("How the sources are connected"), "Appointment preparation must render source lineage");
assert(appointment.includes("scope_truncated"), "Appointment preparation must disclose bounded lineage retrieval");
assert(appointment.includes("This does not mean they are separate"), "Appointment preparation must not infer independence from missing lineage");
console.log("PASS: appointment preparation exposes evidence lineage and bounded-scope limits.");

const evidenceReview = fs.readFileSync(path.join(process.cwd(), "src/components/EvidenceReviewPanel.tsx"), "utf8");
assert(evidenceReview.includes("/care-continuity/state-revisions/evidence/"), "Evidence review must call the persisted as-of reconstruction API");
assert(evidenceReview.includes("persisted_care_state_revision"), "Evidence review must validate the historical response source");
assert(evidenceReview.includes("This does not establish that the evidence did not exist"), "Historical lookup failure must not be displayed as evidence absence");
console.log("PASS: evidence review exposes persisted historical reconstruction with an explicit absence limitation.");

assert(panel.includes("/observations"), "evidence UI must use the persisted source-grounded observation API");
assert(panel.includes("Each detail keeps the exact words from the original source"), "read-only observation history must retain the exact source passage");
assert(panel.includes("A report stays labelled as a report"), "observation UI must preserve report versus observation distinctions");
assert(panel.includes("reviewStatusLabel(item.epistemic_status)"), "read-only observation history must retain the recorded information status");
console.log("PASS: source-grounded observation UI preserves exact source spans and epistemic distinctions.");

assert(panel.includes("supersedes_observation_id"), "observation corrections must link to the prior version");
assert(panel.includes("item.correction_rationale"), "observation correction history must retain its recorded rationale");
console.log("PASS: observation correction history must be versioned and justified.");

const lcr = fs.readFileSync(path.join(process.cwd(), "src/components/mvp-workspace/LCRCurrentUnderstanding.tsx"), "utf8");
assert(lcr.includes('const EvidenceReviewPanel = dynamic(() => import("@/components/EvidenceReviewPanel")'), "the real LCR route must code-split import the evidence workflow");
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
assert(lcr.includes('const ConflictResolutionPanel = dynamic(() => import("@/components/ConflictResolutionPanel")'), "LCR must code-split import the conflict resolution workflow");
assert(lcr.includes("<ConflictResolutionPanel personId={personId} />"), "conflict resolution workflow must be mounted in the actual LCR");
console.log("PASS: scoped conflict comparison and partial-resolution history are connected to the LCR.");
const clarificationPanel = fs.readFileSync(path.join(process.cwd(), "src/components/ClarificationWorkflowPanel.tsx"), "utf8");
assert(clarificationPanel.includes("/uncertainty/questions/"), "clarification workflow must persist questions and read answer history from the backend");
assert(clarificationPanel.includes("claim_clarification"), "clarification questions must retain a link to the selected source-attributed claim");
assert(clarificationPanel.includes("claim_id: selectedClaim.id"), "clarification questions must submit the normalized claim foreign key");
assert(clarificationPanel.includes("Who may know the answer?") && clarificationPanel.includes("No saved source linked yet"), "caregivers must see plain-language question context without internal record identifiers");
assert(clarificationPanel.includes("evidenceSummary(item)") && !clarificationPanel.includes("source_text.slice"), "saved source details must be shown as plain text, never raw JSON");
assert(clarificationPanel.includes('window.addEventListener("careRecordUpdated"'), "clarification questions must refresh after a saved care update");
assert(clarificationPanel.includes("answer_provenance"), "answers must carry explicit provenance");
assert(clarificationPanel.includes("Save answer") && !clarificationPanel.includes("answerEvidenceIds"), "caregivers must be able to save an attributed answer without uploading a separate document");
assert(clarificationPanel.includes('updateQuestion("unresolved")'), "skipping an answer must leave the question visible as still unclear");
assert(clarificationPanel.includes("An answer will not be treated as confirmed until it has been reviewed"), "answer capture must not automatically confirm the care record");
assert(clarificationPanel.includes("intended_answerer_role"), "clarification must record who is best placed to answer when known");
assert(clarificationPanel.includes("necessity_rationale"), "necessary/optional clarification requires a recorded rationale");
assert(clarificationPanel.includes("Earlier answers"), "earlier clarification answers must remain visible");
assert(clarificationPanel.includes("Earlier answers could not be loaded. Please try again."), "failed answer-history reads must show a clear retry message");
assert(lcr.includes('const ClarificationWorkflowPanel = dynamic(() => import("@/components/ClarificationWorkflowPanel")'), "LCR must code-split import the clarification workflow");
assert(lcr.includes("<ClarificationWorkflowPanel personId={personId}"), "clarification workflow must be mounted in the actual LCR");
console.log("PASS: claim-linked clarification and immutable attributed answer history are connected to the LCR.");

for (const field of ["reported_at", "collection_method", "origin_device_ref", "transfer_source", "transfer_reference"]) {
  assert(panel.includes(field), `evidence review UI must expose acquisition provenance field ${field}`);
}
assert(panel.includes("Device used"), "device provenance must be a privacy-minimizing label, not a raw hardware identifier");
assert(panel.includes("These links show how sources are connected"), "source relationships must be explained in caregiver language");
assert(panel.includes("Check whether the saved wording has changed"), "source integrity must use plain English");
assert(!panel.includes("SHA-256") && !panel.includes("JSON.stringify"), "technical hashes and raw data snapshots must not be shown in the caregiver UI");
assert(!panel.includes("source_text_sha256 ||"), "internal source fingerprints must not be displayed to caregivers");
console.log("PASS: LCR evidence review exposes report time, collection method, optional device label, and transfer provenance.");



const evidenceReviewPanel = fs.readFileSync(path.join(process.cwd(), "src/components/EvidenceReviewPanel.tsx"), "utf8");
assert(evidenceReviewPanel.includes("/care-continuity/record-snapshots/as-of"), "evidence UI must load a saved full-record snapshot for the selected date");
assert(evidenceReviewPanel.includes("saved_snapshot_only"), "historical snapshot UI must identify the exact saved-copy coverage limit");
assert(evidenceReviewPanel.includes("No verified saved copy of the full care record is available"), "missing snapshots must not be presented as an empty care record");
assert(evidenceReviewPanel.includes("/care-continuity/state-revisions/evidence/"), "evidence UI must retain the separate source-specific revision lookup");


const freshnessPanel = fs.readFileSync(path.join(process.cwd(), "src/components/EvidenceReviewPanel.tsx"), "utf8");
for (const route of [
  "/care-continuity/evidence-freshness/policies",
  "/care-continuity/evidence-freshness/assessments",
  "/care-continuity/evidence-freshness/assessments/",
]) {
  assert(freshnessPanel.includes(route), `LCR freshness UI must connect to persisted route ${route}`);
}
assert(!freshnessPanel.includes("Save new policy version"), "freshness policies are selected from persisted immutable versions rather than authored in the LCR review panel");
assert(freshnessPanel.includes("Choose a saved review rule") && freshnessPanel.includes("Review this information"), "LCR must retain assessment against an existing saved freshness policy");
assert(freshnessPanel.includes("There is no single time limit for every kind of information"), "freshness UI must reject an invented universal threshold");
assert(freshnessPanel.toLowerCase().includes("a failed read is not an empty history"), "freshness history failure must not be displayed as an empty history");
assert(freshnessPanel.includes("A review does not prove that information is true or still applies today"), "freshness assessments must not be presented as truth verification");
assert(freshnessPanel.includes("source_time_kind"), "freshness UI must show which timestamp dimension drove the assessment");
console.log("PASS: saved freshness policy assessment and history are connected to the LCR with explicit limits.");


const companionPanel = fs.readFileSync(path.join(process.cwd(), "src/components/workflows/AICompanion.tsx"), "utf8");
assert(companionPanel.includes("source_freshness_assessment_ids"), "Companion must expose freshness assessment provenance");
assert(companionPanel.includes("source_record_refs"), "Companion must carry typed source record references");
assert(companionPanel.includes("claim.source_references.map") && companionPanel.includes("source.source_excerpt") && companionPanel.includes("source.label"), "Companion must display source labels and exact supporting excerpts beside matched claims");
assert(companionPanel.includes("freshness assessments"), "Companion must distinguish freshness assessments from evidence truth");
const appointmentWorkspace = fs.readFileSync(path.join(process.cwd(), "src/components/workflows/AppointmentWorkspace.tsx"), "utf8");
assert(appointmentWorkspace.includes("Evidence freshness assessments"), "Appointment preparation must show freshness assessments");
assert(appointmentWorkspace.includes("This is not proof that evidence is current"), "Appointment preparation must not treat absent freshness assessment as currentness");
assert(appointmentWorkspace.includes("Freshness assessment storage is unavailable in this database schema"), "Appointment preparation must distinguish unavailable freshness schema from an empty result");
assert(companionPanel.includes("Freshness assessment storage is unavailable in this schema"), "Companion must expose freshness schema unavailability explicitly");

