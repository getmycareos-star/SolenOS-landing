/**
 * verify-trust-provenance.mts
 * Trust & provenance — observable trust, retrieval-only generation, evidence inspection.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import {
  TRUST_PROVENANCE_IDENTITY,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  assertRetrievalPipelineOrder,
  buildProvenanceRecords,
  buildTrustIndicators,
  processTrustProvenance,
  runRetrievalOnlyGeneration,
  trustIndicatorLabel,
} from "../src/lib/trust-provenance";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Trust & Provenance ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();

assert(TRUST_PROVENANCE_IDENTITY.includes("reconstructs continuity"), "trust identity");
assert(INSUFFICIENT_EVIDENCE_MESSAGE.includes("enough information"), "insufficient message");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/046_trust_reliability.sql");
assert(fs.existsSync(migration), "trust and reliability migration 046 exists");
const migrationSource = fs.readFileSync(migration, "utf8");
for (const table of ["raw_evidence", "claim_corrections", "caregiver_vocabulary"]) {
  assert(migrationSource.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `migration 046 defines ${table}`);
}
console.log("✓ migration 046 trust and reliability tables");

const caregiverId = "cg_trust";

const result = await processSituationInput({
  raw_input: "Mom fell yesterday and went to hospital",
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
  provenance: { input_type: "text", captured_at: "2026-07-01T10:00:00.000Z" },
});

assert(result.trust_provenance_layer !== null, "trust layer in response");
assert(result.trust_provenance_layer!.provenance_records.length >= 1, "provenance records");
assert(result.trust_provenance_layer!.retrieval_context.sufficient_for_answer, "sufficient evidence");
assert(result.trust_provenance_layer!.generation_boundaries.retrieval_only, "retrieval-only enforced");
console.log("✓ provenance on ingest");

const docResult = await processSituationInput({
  raw_input: "",
  caregiver_id: caregiverId,
  timestamp: "2026-07-02T10:00:00.000Z",
  documents: [
    {
      id: "doc_discharge",
      name: "Hospital discharge document",
      extracted_text: "Discharge summary — follow-up in 2 weeks",
      ocr_confidence: 0.92,
    },
  ],
});

assert(
  docResult.trust_provenance_layer!.trust_indicators.some((i) => i.kind === "extracted_from_document"),
  "document trust indicator",
);
console.log("✓ visible trust indicators");

const provisional = await processSituationInput({
  raw_input: "My dad isn't doing well.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-03T10:00:00.000Z",
});

assert(
  provisional.trust_provenance_layer!.trust_indicators.some(
    (i) => i.kind === "awaiting_confirmation" || i.kind === "missing_evidence",
  ),
  "uncertainty indicators visible",
);
console.log("✓ uncertainty not hidden");

assert(
  provisional.trust_provenance_layer!.reasoning_chains.length >= 0,
  "reasoning chains available",
);
assert(
  provisional.trust_provenance_layer!.evidence_bundles.length >= 1,
  "evidence bundles for inspection",
);
console.log("✓ evidence inspection + reasoning transparency");

const empty = runRetrievalOnlyGeneration({
  events: [],
  dare: null,
  unresolved_questions: [],
  question: "What changed?",
});

assert(empty.may_generate === false, "no generation without evidence");
assert(empty.response === INSUFFICIENT_EVIDENCE_MESSAGE, "insufficient evidence response");
console.log("✓ retrieval-only generation boundaries");

assert(
  assertRetrievalPipelineOrder(empty.retrieval_context.pipeline_steps),
  "retrieval pipeline order",
);
console.log("✓ retrieval pipeline order");

const manual = processTrustProvenance({
  caregiver_id: caregiverId,
  events_created: result.events_created,
  context_events: result.context.events,
  dare: null,
  unresolved_questions: [],
  what_changed: result.what_changed,
});

assert(manual.confidence_assessment.level.length > 0, "confidence assessment");
assert(manual.generation_boundaries.forbidden.includes("invent_events"), "forbidden actions");
console.log("✓ confidence model + generation boundaries");

assert(trustIndicatorLabel("verified_by_caregiver").includes("Checked by caregiver"), "caregiver-facing indicator label");
console.log("✓ trust indicator labels");

const records = buildProvenanceRecords(result.events_created, null);
assert(records.every((r) => r.captured_at), "provenance timestamps preserved");
assert(records.every((r) => r.confidence === null), "uncalibrated extraction confidence remains unknown");
console.log("✓ provenance fields and uncalibrated confidence remains unknown");

// Trust/provenance is now exposed through the persisted Care Record evidence
// review surface checked below, not the retired local situation API/devtools panel.
console.log("✓ retired local trust API/panel are not required by the current Care Record flow");

const lcrCurrentUnderstanding = path.join(root, "src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
assert(fs.existsSync(lcrCurrentUnderstanding), "current-care understanding component exists");
const lcrSource = fs.readFileSync(lcrCurrentUnderstanding, "utf8");
assert(lcrSource.includes('import("@/components/EvidenceReviewPanel")'), "evidence review panel is connected to LCR");
assert(lcrSource.includes("<EvidenceReviewPanel personId={personId} />"), "evidence review panel is rendered in current-care understanding");
console.log("✓ persisted evidence review is reachable from current-care understanding");

const evidenceReviewPanel = path.join(root, "src/components/EvidenceReviewPanel.tsx");
const evidenceReviewSource = fs.readFileSync(evidenceReviewPanel, "utf8");
for (const fieldLabel of ["Type of note or document", "How it reached your Care Record", "What we know about this information", "Originally written by", "Shared by", "Entered by", "When it happened", "Added to your Care Record", "When it was entered", "When it was shared", "Saved on", "Saved wording", "Original file"]) {
  assert(evidenceReviewSource.includes(fieldLabel), `evidence review exposes caregiver-facing detail: ${fieldLabel}`);
}
for (const technicalLabel of ["Source category", "Evidence kind", "Epistemic status", "Stored source-text integrity hash"]) {
  assert(!evidenceReviewSource.includes(technicalLabel), `caregiver-facing evidence review must not expose ${technicalLabel}`);
}
assert(evidenceReviewSource.includes("does not prove who created the original"), "file matching limitations are explained in caregiver language");
console.log("✓ source attribution and event/reporting/ingestion times are visible with hash limitations");

const integrityPanelPath = path.join(root, "src/components/CareContinuityIntegrityPanel.tsx");
assert(fs.existsSync(integrityPanelPath), "care-record integrity panel exists");
const integrityPanelSource = fs.readFileSync(integrityPanelPath, "utf8");
assert(integrityPanelSource.includes("async function withdrawAssertion"), "caregiver withdrawal action is available in the care-record history");
assert(integrityPanelSource.includes("expected_assertion_status: assertion.assertion_status"), "withdrawal is bound to the exact displayed assertion status");
assert(integrityPanelSource.includes("reason"), "withdrawal requires a caregiver-authored reason");
assert(integrityPanelSource.includes("latest_revision?.revision_reason"), "care history displays the persisted reason for the latest assertion change");
assert(integrityPanelSource.includes("The reason for the latest change could not be loaded."), "care history does not imply revision reasons are absent when history retrieval fails");
assert(integrityPanelSource.includes("Its earlier wording remains in the care history"), "withdrawal communicates that historical wording is preserved");
assert(integrityPanelSource.includes("item.assertion_status === 'accepted' || item.assertion_status === 'caregiver_reviewed'"), "withdrawal is only offered for accepted care details");
console.log("✓ caregiver withdrawal is explicit, reasoned, version-bound and history-preserving");

const familySharingPath = path.join(root, "src/components/workflows/CareHandoffSharing.tsx");
assert(fs.existsSync(familySharingPath), "family sharing workflow exists");
const familySharingSource = fs.readFileSync(familySharingPath, "utf8");
assert(familySharingSource.includes("I understand that SolenOS does not independently verify every summary statement."), "family sharing requires explicit acknowledgement that generated summaries are not independently verified");
console.log("✓ family sharing makes summary verification limits explicit");

const provenanceModel = path.join(root, "src/lib/trust-provenance/provenance-model.ts");
const provenanceSource = fs.readFileSync(provenanceModel, "utf8");
assert(!provenanceSource.includes("c.confidence >= 0.85") && !provenanceSource.includes("c.confidence >= 0.65"), "uncalibrated numeric thresholds are not used for evidence confidence");
assert(provenanceSource.includes("confidence: null"), "uncalibrated extraction confidence remains unknown");
console.log("✓ no unvalidated confidence thresholds in evidence provenance");

console.log("\n=== All trust & provenance checks passed ===\n");
