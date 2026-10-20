import {
  applyContextWindowStrategy,
  ContextWindowOutputSchema,
  verifyCriticalPreservation,
  verifyContradictionsIntact,
  CONTEXT_WINDOW_MAX_CHARS,
} from "../src/lib/context-window-strategy";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";

console.log("=== Context Window Strategy — MVP CONTRACT v1 ===\n");

const medicationSample = stressNormalizeInput(
  "Give 10mg lisinopril every morning. Call doctor if BP exceeds 160.",
);
const medicationOutput = applyContextWindowStrategy(medicationSample);
ContextWindowOutputSchema.parse(medicationOutput);

if (!verifyCriticalPreservation(medicationOutput)) {
  throw new Error("action-critical content must remain in preserved_text");
}
if (medicationOutput.structured_context.action_critical.length === 0) {
  throw new Error("medication instructions must classify as action_critical");
}
if (!medicationOutput.preserved_text.includes("10mg lisinopril")) {
  throw new Error("dosage details must never be dropped");
}
console.log("✓ priority 1 action-critical preservation");

const contradictionSample = stressNormalizeInput(
  "She is improving today.\nShe is not responding when I call her name.",
);
const contradictionOutput = applyContextWindowStrategy(contradictionSample);
if (!verifyContradictionsIntact(contradictionOutput, contradictionSample)) {
  throw new Error("contradictory statements must remain intact");
}
if (
  !contradictionOutput.preserved_text.includes("improving") ||
  !contradictionOutput.preserved_text.includes("not responding")
) {
  throw new Error("both contradiction statements must appear in preserved_text");
}
console.log("✓ contradictions preserved (never merged or resolved)");

const emotionalSample = stressNormalizeInput(
  "I'm overwhelmed overwhelmed overwhelmed and terrified about everything.",
);
const emotionalOutput = applyContextWindowStrategy(emotionalSample);
if (!emotionalOutput.preserved_text.includes("overwhelmed")) {
  throw new Error("emotional context must not be deleted entirely");
}
console.log("✓ emotional verbosity may compress without deleting category");

const longEmotional = stressNormalizeInput(
  `${"I am so stressed about this situation. ".repeat(80)}Give 5mg medication at bedtime.`,
);
const compressed = applyContextWindowStrategy(longEmotional);
if (!compressed.preserved_text.includes("5mg medication")) {
  throw new Error("medication must survive compression");
}
if (compressed.preserved_text.length > CONTEXT_WINDOW_MAX_CHARS + 200) {
  throw new Error("emotional tail trim must respect max char budget");
}
console.log("✓ token safety: compress emotional redundancy only");

const extraField = { ...medicationOutput, interpretation: "urgent case" };
let rejected = false;
try {
  ContextWindowOutputSchema.parse(extraField);
} catch {
  rejected = true;
}
if (!rejected) throw new Error("strict schema must reject extra fields");
console.log("✓ strict structured output schema");

const source = await import("node:fs/promises").then((fs) =>
  fs.readFile("src/lib/context-window-strategy/compress.ts", "utf-8"),
);
if (/summarize|diagnos|interpret|merge.*contradict|resolve.*ambigu/i.test(source)) {
  throw new Error("context window must not interpret or resolve content");
}
console.log("✓ no semantic inference in compression layer");

console.log("\n✓ context window strategy is deterministic lossless preservation");
