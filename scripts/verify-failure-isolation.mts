import fs from "node:fs";
import path from "node:path";
import { ANALYZE_FAILURE, isAnalyzeFailure } from "../src/lib/analyze-pipeline/constants";
import {
  FAILURE_PRIORITY_ORDER,
  MVP_VALIDATION_CRITERIA,
  VALID_CHANGE_TARGETS,
  classifyInputFailure,
  classifyModelFailure,
  detectPromptFailure,
  detectUxFailure,
} from "../src/lib/failure-isolation";

const TRACE = {
  signals_used: ["caregiver input"],
  risk_factors: ["context pending"],
  prioritization_logic: ["single primary action"],
  confidence_drivers: ["structured input"],
};

const isolationSource = fs
  .readdirSync(path.join(process.cwd(), "src/lib/failure-isolation"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => fs.readFileSync(path.join(process.cwd(), "src/lib/failure-isolation", f), "utf-8"))
  .join("\n");

const forbiddenPatterns = [
  /from\s+["']@\/lib\/store/,
  /executeTurn/,
  /AgentExecutor/,
  /dashboard/i,
  /analytics/i,
  /persist/i,
  /createSession/,
];

console.log("=== failure-isolation — MVP EXECUTION SPEC ===\n");

if (FAILURE_PRIORITY_ORDER.join(",") !== "model,prompt,ux,input") {
  throw new Error("failure priority order must be model → prompt → ux → input");
}
console.log("✓ engineering priority order enforced");

const syntaxFailure = classifyModelFailure("{ bad", new SyntaxError("JSON"));
if (syntaxFailure.category !== "model" || syntaxFailure.severity !== "critical") {
  throw new Error("model failure classification incorrect");
}
console.log("✓ 3.1 model failure: structural invalidity");

const inputFailure = classifyInputFailure("empty after OCR");
if (inputFailure.category !== "input" || inputFailure.severity !== "low") {
  throw new Error("input failure classification incorrect");
}
console.log("✓ 3.4 input failure: acceptable noise");

const promptIssue = detectPromptFailure({
  what_is_happening: "Situation summary.",
  what_matters_now: "You could also call the doctor or wait.",
  what_to_ask_next: "What changed?",
  risk_level: "medium",
  what_can_wait: "Scheduling.",
  follow_up_items: [],
  decision_trace: TRACE,
});
if (!promptIssue || promptIssue.category !== "prompt") {
  throw new Error("prompt failure detection failed");
}
console.log("✓ 3.2 prompt failure: intent violation detection");

const verbose = "word ".repeat(80);
const uxIssue = detectUxFailure({
  what_is_happening: verbose,
  what_matters_now: "Confirm medication.",
  what_to_ask_next: "Was the dose taken?",
  risk_level: "low",
  what_can_wait: "Planning.",
  follow_up_items: [],
  decision_trace: TRACE,
});
if (!uxIssue || uxIssue.category !== "ux") {
  throw new Error("ux failure detection failed");
}
console.log("✓ 3.3 ux failure: clarity heuristics (UI layer)");

if (!isAnalyzeFailure(ANALYZE_FAILURE)) {
  throw new Error("analyze failure envelope must match MVP spec");
}
console.log("✓ model failure envelope matches MVP spec at API boundary");

for (const pattern of forbiddenPatterns) {
  if (pattern.test(isolationSource)) {
    throw new Error(`forbidden pattern in failure-isolation module: ${pattern}`);
  }
}
console.log("✓ no persistence, dashboards, agents, or store coupling");

if (MVP_VALIDATION_CRITERIA.comprehension_seconds !== 10) {
  throw new Error("MVP comprehension threshold must be 10 seconds");
}
console.log("✓ MVP validation criteria documented");

if (VALID_CHANGE_TARGETS.length !== 4) {
  throw new Error("valid change targets must match spec");
}
console.log("✓ changes must improve correctness, clarity, load, or validation stability");

console.log("\n✓ failure-isolation prototype aligned — single pipeline, four categories, no drift");
