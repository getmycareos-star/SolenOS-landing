import {
  stressNormalizeInput,
  StressNormalizedOutputSchema,
  verifyLosslessStressOutput,
} from "../src/lib/input-stress-normalizer";

console.log("=== Input Stress Normalizer — MVP EXECUTION CONTRACT ===\n");

const contradictionSample = stressNormalizeInput(
  "She is fine today.\nShe is not responding when I call her name.",
);

if (!verifyLosslessStressOutput(contradictionSample)) {
  throw new Error("segment reconstruction must be lossless");
}
console.log("✓ lossless structural segmentation");

if (!contradictionSample.metadata.has_contradictions) {
  throw new Error("contradictions must be flagged, not resolved");
}
if (!contradictionSample.detected_tags.includes("CONTRADICTORY_STATEMENTS")) {
  throw new Error("contradictory tag must be present");
}
console.log("✓ contradictions preserved and flagged");

const emotionalSample = stressNormalizeInput(
  "I'm completely overwhelmed and terrified about Mom's new medications.",
);
if (!emotionalSample.metadata.has_emotional_language) {
  throw new Error("emotional language must be detected structurally");
}
if (!emotionalSample.raw_input.includes("overwhelmed")) {
  throw new Error("emotional content must remain verbatim");
}
console.log("✓ emotional content preserved verbatim");

StressNormalizedOutputSchema.parse(contradictionSample);
const extraField = { ...contradictionSample, extra: true };
let rejected = false;
try {
  StressNormalizedOutputSchema.parse(extraField);
} catch {
  rejected = true;
}
if (!rejected) throw new Error("strict schema must reject extra fields");
console.log("✓ strict output schema enforced");

const longSample = stressNormalizeInput("word ".repeat(120));
if (!longSample.detected_tags.includes("LONG_UNSTRUCTURED_TEXT")) {
  throw new Error("long unstructured text tag missing");
}
console.log("✓ structural tagging only (format metadata)");

console.log("\n✓ Input Stress Normalizer ready for LangChain envelope");
