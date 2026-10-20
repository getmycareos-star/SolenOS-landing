import fs from "node:fs";
import path from "node:path";
import {
  AMBIGUITY_VALIDATION_IDENTITY,
  ANTI_STRUCTURE_HALLUCINATION_RULES,
  CARE_DECOMPRESSION_BYPASS_RULE,
  CLARITY_CONSTRAINT_PREFIX,
  analyzeClarity,
  processInputClarityGate,
  buildStructuredClarificationResponse,
} from "../src/lib/ambiguity-structure-validation";
import { validateAIResponse } from "../src/lib/response-validator";

console.log("=== Ambiguity & Structure Validation Layer ===\n");

if (!AMBIGUITY_VALIDATION_IDENTITY.includes("pre-reasoning")) {
  throw new Error("ambiguity validation identity drift");
}
console.log("✓ ambiguity validation identity contract");

if (!ANTI_STRUCTURE_HALLUCINATION_RULES.some((rule) => rule.includes("NO STRUCTURE WITHOUT USER CONFIRMATION"))) {
  throw new Error("anti-structure-hallucination constants missing NO STRUCTURE WITHOUT USER CONFIRMATION");
}
if (!ANTI_STRUCTURE_HALLUCINATION_RULES.some((rule) => rule.includes("inferredIntent"))) {
  throw new Error("anti-structure-hallucination must forbid inferredIntent");
}
console.log("✓ anti-structure-hallucination constants present");

if (!CARE_DECOMPRESSION_BYPASS_RULE.includes("PARTIAL")) {
  throw new Error("care decompression bypass rule drift");
}
console.log("✓ SolenOS care decompression bypass rule");

const momForgot = analyzeClarity("Mom forgot things twice", "emotional_narrative");
if (momForgot.clarityLevel === "AMBIGUOUS") {
  throw new Error('"Mom forgot things twice" must not be AMBIGUOUS');
}
if ("inferredIntent" in momForgot && (momForgot as { inferredIntent?: string }).inferredIntent !== undefined) {
  throw new Error("inferredIntent must never be populated");
}
const momGate = processInputClarityGate("Mom forgot things twice", "emotional_narrative");
if (momGate.action === "BLOCK") {
  throw new Error('"Mom forgot things twice" must PASS or PARTIAL, not BLOCK');
}
console.log('✓ caregiver dump "Mom forgot things twice" → PASS or PARTIAL, not BLOCK');

const emptyClarity = analyzeClarity("   ");
if (emptyClarity.clarityLevel !== "AMBIGUOUS") {
  throw new Error("empty input must be AMBIGUOUS");
}
const emptyGate = processInputClarityGate("   ");
if (emptyGate.action !== "BLOCK") {
  throw new Error("empty input must BLOCK");
}
const clarification = buildStructuredClarificationResponse(emptyGate.clarity);
validateAIResponse(clarification);
if (clarification.risk_level !== "low") {
  throw new Error("clarification response must use lowercase risk_level low");
}
if (!clarification.what_is_happening.includes("uncertain") && !clarification.what_is_happening.includes("structure")) {
  throw new Error("clarification what_is_happening must express uncertainty");
}
if (!clarification.what_to_ask_next.includes("?")) {
  throw new Error("clarification what_to_ask_next must contain questions");
}
console.log("✓ empty input → BLOCK with 5-field clarification response");

const gibberishGate = processInputClarityGate("asdf");
if (gibberishGate.action !== "BLOCK") {
  throw new Error("gibberish input must BLOCK");
}
console.log("✓ gibberish input → BLOCK");

const partialGate = processInputClarityGate(
  "Need help with insurance paperwork deadline next week",
  "administrative_legal",
);
if (partialGate.action === "BLOCK") {
  throw new Error("administrative input with some structure must not BLOCK");
}
if (partialGate.action === "PARTIAL") {
  if (!partialGate.constraintLine?.startsWith(CLARITY_CONSTRAINT_PREFIX)) {
    throw new Error("PARTIAL gate must include CLARITY_CONSTRAINT line");
  }
  if (!partialGate.constraintLine.includes("PARTIAL")) {
    throw new Error("constraint line must include PARTIAL level");
  }
}
console.log("✓ PARTIAL gate emits CLARITY_CONSTRAINT line");

const clearGate = processInputClarityGate(
  "Mom missed her evening medication today and I need to know if I should call her doctor at the clinic.",
  "emotional_narrative",
);
if (clearGate.action !== "PASS" && clearGate.action !== "PARTIAL") {
  throw new Error("structured caregiver input should PASS or PARTIAL");
}
console.log("✓ structured caregiver input not blocked");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const classifyIdx = pipelineSource.indexOf("classifyInputSurface(structuredInput.raw_input)");
const clarityIdx = pipelineSource.indexOf("processInputClarityGate(");
const urgencyIdx = pipelineSource.indexOf("detectUrgencyLevel(");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(classifyIdx > 0 && classifyIdx < clarityIdx && clarityIdx < urgencyIdx && urgencyIdx < geminiIdx)) {
  throw new Error("clarity gate must run after classification and before urgency/LLM");
}
if (!pipelineSource.includes("buildStructuredClarificationResponse")) {
  throw new Error("pipeline must return structured clarification on BLOCK");
}
if (!pipelineSource.includes("classifyClarityGateBlockFailure")) {
  throw new Error("pipeline must log CLARITY_GATE_BLOCK telemetry on BLOCK");
}
console.log("✓ clarity gate wired before invokeGeminiExecution in pipeline");

console.log("\n✓ Ambiguity & Structure Validation Layer enforced");
