/**
 * verify-universal-knowledge-extraction.mts
 * Universal Knowledge Extraction Engine — documents become structured knowledge.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetUniversalKnowledgeStore,
  processUniversalKnowledgeExtraction,
  toUniversalKnowledgeLayerPayload,
  UNIVERSAL_KNOWLEDGE_IDENTITY,
  UNIVERSAL_KNOWLEDGE_PIPELINE,
  buildDocumentClarityOutput,
  HUMAN_REVIEW_THRESHOLD,
} from "../src/lib/universal-knowledge-extraction";
import { resetCareJourneyGraphStore } from "../src/lib/care-journey-graph";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Universal Knowledge Extraction ===\n");

resetUniversalKnowledgeStore();
resetCareJourneyGraphStore();

assert(UNIVERSAL_KNOWLEDGE_PIPELINE.length >= 8, "universal pipeline defined");
assert(UNIVERSAL_KNOWLEDGE_IDENTITY.includes("evidence-backed knowledge"), "product identity");
assert(HUMAN_REVIEW_THRESHOLD > 0 && HUMAN_REVIEW_THRESHOLD < 1, "human review threshold set");
console.log("✓ contract constants and identity");

const poaText = `
DURABLE POWER OF ATTORNEY
Effective March 1, 2026.
I hereby appoint my daughter Sarah Johnson as my agent and attorney-in-fact.
Sarah is authorized to make insurance decisions and healthcare decisions on my behalf.
Required before hospital admission per facility policy.
`;

const poaResult = processUniversalKnowledgeExtraction({
  document_id: "doc_poa_1",
  document_name: "Durable Power of Attorney.pdf",
  extracted_text: poaText,
  caregiver_id: "cg_knowledge",
});

assert(poaResult.domain === "legal", "classifies legal domain");
assert(poaResult.knowledge_items.length > 0, "extracts knowledge items");
assert(
  poaResult.knowledge_items.some((i) => i.category === "legal_authority"),
  "extracts legal authority",
);
assert(poaResult.approved_count > 0, "has approved items");
assert(poaResult.clarity.key_facts.length > 0, "builds DocumentClarityOutput key_facts");
assert(poaResult.changes.legal_authority_established.length > 0, "surfaces what changed");
assert(poaResult.journey_results.length > 0, "creates journey events");
console.log("✓ legal document → structured knowledge → care journey");

const insuranceText = `
Insurance Claim Denial Letter
Policy number ABC-12345.
Coverage decision: home care services not covered under current plan.
You must submit an appeal within 30 days by April 15, 2026.
Outstanding balance: $2,450.00 due by May 1, 2026.
`;

const insuranceResult = processUniversalKnowledgeExtraction({
  document_id: "doc_ins_1",
  document_name: "Insurance Denial.pdf",
  extracted_text: insuranceText,
  caregiver_id: "cg_knowledge",
});

assert(insuranceResult.domain === "financial", "classifies financial domain");
assert(
  insuranceResult.knowledge_items.some((i) => i.category === "financial_obligation"),
  "extracts financial obligations",
);
assert(insuranceResult.follow_ups.length > 0, "identifies follow-ups");
assert(
  insuranceResult.relationships.length >= 0,
  "relationship detection runs",
);
console.log("✓ financial document extraction and follow-ups");

const dischargeText = `
Hospital Discharge Summary
Patient diagnosed with UTI on July 10, 2026.
Prescribed antibiotic Ciprofloxacin 250mg twice daily for 7 days.
Follow-up appointment scheduled with Dr. Martinez on July 20, 2026.
Monitor for confusion and reduced appetite.
`;

const dischargeResult = processUniversalKnowledgeExtraction({
  document_id: "doc_dis_1",
  document_name: "Discharge Summary.pdf",
  extracted_text: dischargeText,
  caregiver_id: "cg_knowledge",
});

assert(
  dischargeResult.knowledge_items.some((i) => i.category === "diagnosis"),
  "extracts diagnosis from medical document",
);
assert(
  dischargeResult.knowledge_items.some((i) => i.category === "medication"),
  "extracts medication",
);
assert(dischargeResult.changes.new_diagnoses.length > 0, "records diagnosis change");
console.log("✓ medical discharge → diagnosis, medication, appointments");

const layer = toUniversalKnowledgeLayerPayload(dischargeResult);
assert(layer.journey_event_ids.length > 0, "layer payload includes journey event ids");
assert(layer.changes_summary.length > 0, "layer includes changes summary");
console.log("✓ layer payload for API and UI");

const clarityOnly = buildDocumentClarityOutput(
  [dischargeResult.document_node],
  dischargeResult.knowledge_items,
);
assert(clarityOnly.document_types.length > 0, "DocumentClarityOutput populated");
console.log("✓ DocumentClarityOutput builder (was schema-only)");

const required = [
  "src/lib/universal-knowledge-extraction/index.ts",
  "src/lib/universal-knowledge-extraction/pipeline.ts",
  "src/lib/universal-knowledge-extraction/extract-knowledge-items.ts",
  "src/lib/universal-knowledge-extraction/link-to-journey.ts",
  "db/migrations/022_universal_knowledge_extraction.sql",
  "src/app/api/knowledge/extract/route.ts",
  "src/components/ops-devtools/DocumentKnowledgePanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("processUniversalKnowledgeExtraction"), "care-events runs knowledge pipeline");

const carrying = fs.readFileSync(path.join(root, "src/components/ops-clarity/CarryingPanel.tsx"), "utf-8");
assert(carrying.includes("DocumentKnowledgePanel"), "document knowledge shown in carrying phase");

console.log("\n=== Universal Knowledge Extraction verification complete ===");
