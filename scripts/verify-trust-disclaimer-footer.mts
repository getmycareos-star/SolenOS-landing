import fs from "node:fs";
import path from "node:path";
import {
  TRUST_LAYER_IDENTITY,
  TRUST_LAYER_FORBIDDEN,
  FOOTER_STRICT_ORDER,
  detectTriggeredDomains,
  runDisclaimerEngine,
  runFooterEngine,
  assembleOutputLayer,
  runSystemGuaranteeCheck,
} from "../src/lib/trust-disclaimer-footer";
import { withMeta } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";
import { applyDocumentIntake } from "../src/lib/document-intake";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";

console.log("=== Trust, Disclaimer & Footer Execution Layer ===\n");

if (!TRUST_LAYER_IDENTITY.includes("post-reasoning")) {
  throw new Error("trust layer identity must be post-reasoning");
}
console.log("✓ trust layer identity contract");

if (!TRUST_LAYER_FORBIDDEN.some((rule) => rule.includes("influence reasoning"))) {
  throw new Error("trust layer must forbid influencing reasoning");
}
console.log("✓ trust layer forbidden actions defined");

const medicalInput = "Mom has new symptoms and I need help with her medication schedule.";
const medicalDomains = detectTriggeredDomains(medicalInput);
if (!medicalDomains.includes("MEDICAL")) {
  throw new Error("medical input must trigger MEDICAL domain");
}
console.log("✓ MEDICAL domain trigger");

const benefitsInput = "Need help applying for IHSS and Medi-Cal long term care benefits.";
const benefitsDomains = detectTriggeredDomains(benefitsInput);
if (!benefitsDomains.includes("BENEFITS")) {
  throw new Error("benefits input must trigger BENEFITS domain");
}
console.log("✓ BENEFITS domain trigger");

const insuranceInput = "Insurance claim denied for billing coverage on hospice care.";
const insuranceDomains = detectTriggeredDomains(insuranceInput);
if (!insuranceDomains.includes("INSURANCE")) {
  throw new Error("insurance input must trigger INSURANCE domain");
}
console.log("✓ INSURANCE domain trigger");

const documentInput = stressNormalizeInput("Uploaded PDF scan of discharge summary page 1 of 3");
const documentIntake = applyDocumentIntake(documentInput);
const documentDomains = detectTriggeredDomains(documentInput.raw_input, documentIntake);
if (!documentDomains.includes("DOCUMENT")) {
  throw new Error("document input must trigger DOCUMENT domain");
}
console.log("✓ DOCUMENT domain trigger");

const response = withMeta(VERIFY_VALID_SOLENOS);
const disclaimers = runDisclaimerEngine({
  rawInput: medicalInput,
});
if (disclaimers.length === 0 || disclaimers[0]?.domain !== "MEDICAL") {
  throw new Error("disclaimer engine must emit MEDICAL disclaimer");
}
console.log("✓ disclaimer engine emits domain text");

const footers = runFooterEngine(response, disclaimers);
const footerKinds = footers.map((f) => f.kind);
if (!footerKinds.includes("MEDICAL_SAFETY")) {
  throw new Error("medical disclaimer must produce MEDICAL_SAFETY footer");
}
if (footerKinds[footerKinds.length - 1] !== "UNCERTAINTY") {
  throw new Error("UNCERTAINTY footer must be last");
}
for (const required of ["SYSTEM_LIMIT", "ASSUMPTIONS", "CONFIDENCE", "UNCERTAINTY"] as const) {
  if (!footerKinds.includes(required)) {
    throw new Error(`required footer missing: ${required}`);
  }
}
let lastIdx = -1;
for (const kind of footerKinds) {
  const orderIdx = FOOTER_STRICT_ORDER.indexOf(kind);
  if (orderIdx < lastIdx) {
    throw new Error(`footer order violation at kind ${kind}`);
  }
  lastIdx = orderIdx;
}
console.log("✓ footer engine strict ordering");

const { assembled, guarantee } = assembleOutputLayer(response, { rawInput: medicalInput });
if (!guarantee.ok) {
  throw new Error(`system guarantee failed: ${guarantee.violations.join("; ")}`);
}
if (assembled.response.what_is_happening !== response.what_is_happening) {
  throw new Error("output assembly must not modify SolenOS response fields");
}
console.log("✓ system guarantee check passes");

const contaminated = {
  ...assembled,
  response: { ...assembled.response, what_is_happening: "modified" },
};
const badGuarantee = runSystemGuaranteeCheck(contaminated, response);
if (badGuarantee.ok) {
  throw new Error("guarantee must fail when response fields are modified");
}
console.log("✓ reasoning contamination detected");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const styleIdx = pipelineSource.indexOf("if (!isNonAssistantOutputValid(epistemicOutput))");
const assembleIdx = pipelineSource.indexOf("const trustLayer = assembleTrustLayer(");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(styleIdx > 0 && assembleIdx > styleIdx)) {
  throw new Error("trust layer assembly must run after non-assistant output validation");
}
if (assembleIdx < geminiIdx) {
  throw new Error("trust layer assembly must not run before LLM generation");
}
if (!pipelineSource.includes("assembleOutputLayer")) {
  throw new Error("pipeline must import assembleOutputLayer");
}
console.log("✓ trust layer wired post-reasoning in analyze pipeline");

const clarityIdx = pipelineSource.indexOf("processInputClarityGate(");
if (!(clarityIdx > 0 && clarityIdx < geminiIdx)) {
  throw new Error("clarity gate must remain pre-reasoning");
}
console.log("✓ clarity gate remains pre-reasoning");

console.log("\n✓ Trust, Disclaimer & Footer Execution Layer enforced");
