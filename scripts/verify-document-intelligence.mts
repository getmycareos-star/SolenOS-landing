import fs from "node:fs";
import path from "node:path";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { applyDocumentIntake } from "../src/lib/document-intake";
import {
  DOCUMENT_CONFIDENCE_THRESHOLD,
  DOCUMENT_INTELLIGENCE_LAYER_FORBIDDEN,
  DOCUMENT_INTELLIGENCE_LAYER_IDENTITY,
  DOCUMENT_INTELLIGENCE_LAYER_PIPELINE_POSITION,
  SOLENOS_DOCUMENT_TYPES,
  assertExtractionInferenceSeparation,
  assertNoMemoryAutoCommit,
  buildDocumentReasoningOutput,
  computeDocumentConfidence,
  extractRawFields,
  processDocumentIntelligenceLayer,
  separateInference,
  structureExtractedDocument,
  toDocumentIntelligenceLayerPayload,
  toMemoryInfluenceSignalProposals,
  validateDocumentIntelligenceLayerResult,
} from "../src/lib/document-intelligence";
import {
  assembleOutputLayer,
  detectTriggeredDomains,
  runFooterEngine,
} from "../src/lib/trust-disclaimer-footer";
import { withMeta } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS — Document Intelligence Layer ===\n");

if (!DOCUMENT_INTELLIGENCE_LAYER_IDENTITY.includes("inference-ready knowledge graph")) {
  throw new Error("document intelligence identity contract drift");
}
if (!DOCUMENT_INTELLIGENCE_LAYER_FORBIDDEN.some((r) => r.includes("merge extraction and inference"))) {
  throw new Error("must forbid merging extraction and inference");
}
if (!DOCUMENT_INTELLIGENCE_LAYER_FORBIDDEN.some((r) => r.includes("auto-write memory"))) {
  throw new Error("must forbid auto-write memory from documents");
}
if (!DOCUMENT_INTELLIGENCE_LAYER_PIPELINE_POSITION.includes("before Output Assembly")) {
  throw new Error("pipeline position must be before Output Assembly");
}
console.log("✓ document intelligence contract constants");

if (SOLENOS_DOCUMENT_TYPES.length !== 6) {
  throw new Error("must define exactly 6 SolenOSDocument types");
}
if (DOCUMENT_CONFIDENCE_THRESHOLD !== 0.7) {
  throw new Error("confidence threshold must be 0.7");
}
console.log("✓ SolenOSDocument types and confidence threshold");

const insuranceInput = stressNormalizeInput(
  "Uploaded insurance letter: Prior authorization required by March 15, 2026. Policy number ABC-12345. Coverage decision pending — may be covered if medically necessary.",
);
const intake = applyDocumentIntake(insuranceInput);
const layer = processDocumentIntelligenceLayer({
  rawInput: insuranceInput.raw_input,
  documentIntake: intake,
});

if (layer.skipped) throw new Error("insurance letter must not skip document intelligence");
if (layer.nodes.length === 0) throw new Error("must produce document nodes");
if (layer.nodes[0]?.type !== "insurance_document") {
  throw new Error("must classify as insurance_document");
}
console.log("✓ insurance document → graph node");

const node = layer.nodes[0]!;
if (node.extracted.obligations.length === 0) {
  throw new Error("must extract obligations without interpretation");
}
if (!node.inference.ambiguityFlags.some((f) => f.includes("ambiguous"))) {
  throw new Error("insurance must flag ambiguous coverage language");
}
if (!assertExtractionInferenceSeparation(node.extracted, node.inference)) {
  throw new Error("extraction and inference must remain separated");
}
console.log("✓ extraction/inference separation for insurance");

const medicalText =
  "Discharge summary: patient diagnosis listed as hypertension. Take lisinopril 10mg daily.";
const medicalExtracted = structureExtractedDocument(medicalText, "medical_document");
const medicalInference = separateInference(medicalExtracted, "medical_document");
if (medicalInference.inferredFields.diagnosisInferred !== false) {
  throw new Error("medical must never infer diagnosis");
}
if ("diagnosis" in medicalExtracted.extractedFields && medicalExtracted.extractedFields.diagnosis) {
  throw new Error("must not store interpreted diagnosis field");
}
console.log("✓ medical type-specific rules — extract only, no diagnosis");

const benefitsText =
  "Medi-Cal eligibility criteria: income limit $1,500/month. You may qualify if household size is 2.";
const benefitsExtracted = structureExtractedDocument(benefitsText, "benefits_document");
const benefitsInference = separateInference(benefitsExtracted, "benefits_document");
if (benefitsInference.inferredFields.eligibilityDetermined !== false) {
  throw new Error("benefits must not determine eligibility");
}
console.log("✓ benefits type-specific rules — criteria only");

const legalText =
  "Legal notice: You must respond within 30 days. Notwithstanding the above, payment is prohibited unless authorized.";
const legalExtracted = structureExtractedDocument(legalText, "legal_document");
const legalInference = separateInference(legalExtracted, "legal_document");
if (legalExtracted.obligations.length === 0 || legalExtracted.constraints.length === 0) {
  throw new Error("legal must extract obligations and constraints");
}
if (legalInference.inferredFields.legalOutcomeInterpreted !== false) {
  throw new Error("legal must not interpret outcome");
}
console.log("✓ legal type-specific rules");

const raw = extractRawFields(insuranceInput.raw_input, "insurance_document");
if (raw.dates.length === 0) throw new Error("must extract raw dates");
console.log("✓ step 1 raw field extraction");

const confidence = computeDocumentConfidence(
  node.extracted,
  node.inference,
  true,
);
if (confidence.extraction === undefined || confidence.structure === undefined) {
  throw new Error("confidence model must include extraction and structure scores");
}
console.log("✓ confidence model");

if (!layer.memoryLinks.pendingWrites.every((p) => p.status === "pending")) {
  throw new Error("memory proposals must remain pending");
}
if (!assertNoMemoryAutoCommit(layer.memoryLinks.pendingWrites)) {
  throw new Error("must not auto-commit memory");
}
const signalProposals = toMemoryInfluenceSignalProposals(layer.memoryLinks);
if (signalProposals.some((s) => s.userConfirmed)) {
  throw new Error("document memory bridge must not mark proposals as user-confirmed");
}
console.log("✓ memory link proposals (pending only)");

const guarantee = validateDocumentIntelligenceLayerResult(layer);
if (!guarantee.ok) {
  throw new Error(`system guarantee failed: ${guarantee.violations.join("; ")}`);
}
console.log("✓ system guarantee validation");

const reasoningOutput = buildDocumentReasoningOutput(layer);
if (reasoningOutput.extractionSection.length === 0) {
  throw new Error("reasoning output must include extraction section");
}
if (reasoningOutput.inferenceSection.length === 0) {
  throw new Error("reasoning output must include inference section");
}
console.log("✓ document reasoning output sections");

const payload = toDocumentIntelligenceLayerPayload(layer);
const domains = detectTriggeredDomains(insuranceInput.raw_input, intake, payload);
if (!domains.includes("INSURANCE")) {
  throw new Error("document intelligence must trigger INSURANCE disclaimer domain");
}
const assembled = assembleOutputLayer(withMeta(VERIFY_VALID_SOLENOS), {
  rawInput: insuranceInput.raw_input,
  documentIntake: intake,
  documentIntelligence: payload,
});
if (assembled.assembled.disclaimers.every((d) => d.domain !== "INSURANCE")) {
  throw new Error("output assembly must include insurance disclaimer");
}
console.log("✓ trust layer integration for insurance disclaimers");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const geminiCallIdx = pipelineSource.indexOf("const raw = await invokeGeminiExecution({");
const docIntelCallIdx = pipelineSource.indexOf(
  "const documentIntelligence = processDocumentIntelligenceLayer({",
);
const trustCallIdx = pipelineSource.indexOf("documentIntelligencePayload,");
if (!(geminiCallIdx > 0 && docIntelCallIdx > geminiCallIdx && trustCallIdx > docIntelCallIdx)) {
  throw new Error("document intelligence must run after LLM generation and before trust layer");
}
if (pipelineSource.slice(geminiCallIdx, geminiCallIdx + 800).includes("documentIntelligence")) {
  throw new Error("document intelligence must NOT be passed to LLM invocation");
}
console.log("✓ pipeline wiring: post-generation, pre-output-assembly, not in LLM");

const nonDoc = processDocumentIntelligenceLayer({
  rawInput: "Mom missed her medication dose today.",
  documentIntake: applyDocumentIntake(stressNormalizeInput("Mom missed her medication dose today.")),
});
if (!nonDoc.skipped || nonDoc.nodes.length > 0) {
  throw new Error("non-document input must skip document intelligence");
}
console.log("✓ non-document input skipped");

console.log("\n✓ document intelligence layer enforced");
