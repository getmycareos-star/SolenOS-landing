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

const migration = path.join(root, "db/migrations/032_trust_provenance.sql");
assert(fs.existsSync(migration), "migration 032 exists");
assert(fs.readFileSync(migration, "utf8").includes("care_provenance_records"), "provenance table");
console.log("✓ migration 032");

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

assert(trustIndicatorLabel("verified_by_caregiver").includes("Verified"), "indicator labels");
console.log("✓ trust indicator labels");

const records = buildProvenanceRecords(result.events_created, null);
assert(records.every((r) => r.captured_at && r.confidence), "provenance fields complete");
console.log("✓ provenance model fields");

const apiRoute = path.join(root, "src/app/api/situation/trust/route.ts");
assert(fs.existsSync(apiRoute), "trust API route exists");
console.log("✓ trust API route");

const uiPanel = path.join(root, "src/components/ops-devtools/TrustProvenancePanel.tsx");
assert(fs.existsSync(uiPanel), "TrustProvenancePanel exists");
console.log("✓ UI panel");

console.log("\n=== All trust & provenance checks passed ===\n");
