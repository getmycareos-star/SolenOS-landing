import fs from "node:fs";
import path from "node:path";
import {
  MISSING_INFORMATION_QUEUE_LAYER_FORBIDDEN,
  MISSING_INFORMATION_QUEUE_LAYER_IDENTITY,
  MISSING_INFORMATION_QUEUE_LAYER_ONE_LINE_TRUTH,
  MISSING_INFORMATION_QUEUE_LAYER_PIPELINE_POSITION,
  CRITICAL_GAP_WARNING,
  classifyMissingInformationImportance,
  createMissingInformationItem,
  addMissingInformationItem,
  isKnowledgeGapQuestion,
  detectMissingFromUserInput,
  detectMissingFromReasoning,
  autoResolveMissingInformation,
  processMissingInformationQueueLayer,
  toMissingInformationQueueLayerPayload,
  resetMissingInformationQueueStore,
  createDefaultMissingInformationQueueState,
  computeMissingInformationInfluenceEnvelope,
  runMissingInformationQueueGuarantee,
} from "../src/lib/missing-information-queue";
import { createEmptyTrackedSituation } from "../src/lib/resolution-engine";

console.log("=== Missing Information Queue ===\n");

if (!MISSING_INFORMATION_QUEUE_LAYER_IDENTITY.includes("missing knowledge")) {
  throw new Error("identity must emphasize missing knowledge");
}
if (!MISSING_INFORMATION_QUEUE_LAYER_ONE_LINE_TRUTH.includes("assumptions")) {
  throw new Error("one-line truth must reference complementarity with assumptions");
}
if (!MISSING_INFORMATION_QUEUE_LAYER_PIPELINE_POSITION.includes("Assumption Registry")) {
  throw new Error("pipeline position must be after Assumption Registry");
}
if (!MISSING_INFORMATION_QUEUE_LAYER_PIPELINE_POSITION.includes("Priority Engine")) {
  throw new Error("pipeline position must be before Priority Engine");
}
if (!MISSING_INFORMATION_QUEUE_LAYER_FORBIDDEN.some((f) => /task manager/i.test(f))) {
  throw new Error("must forbid task manager behavior");
}
if (!CRITICAL_GAP_WARNING.includes("limiting recommendation quality")) {
  throw new Error("critical gap warning text drift");
}
console.log("✓ contract constants");

// Knowledge gaps only — never tasks
if (isKnowledgeGapQuestion("Call insurance company")) {
  throw new Error("task language must be rejected");
}
if (isKnowledgeGapQuestion("Schedule follow-up appointment")) {
  throw new Error("imperative tasks must be rejected");
}
if (!isKnowledgeGapQuestion("What is the discharge date?")) {
  throw new Error("knowledge questions must be accepted");
}
if (createMissingInformationItem({
  situationId: "sit-1",
  question: "Call the doctor",
  importance: "HIGH",
  source: "user_input",
})) {
  throw new Error("must not create task-shaped items");
}
console.log("✓ knowledge-gap guardrails (not a task list)");

// Importance heuristics
if (classifyMissingInformationImportance("What is the discharge date?") !== "HIGH") {
  throw new Error("discharge date must be HIGH");
}
if (classifyMissingInformationImportance("What is the insurance policy number?") !== "MEDIUM") {
  throw new Error("policy number must be MEDIUM");
}
if (classifyMissingInformationImportance("What is the preferred pharmacy?") !== "LOW") {
  throw new Error("preferred pharmacy must be LOW");
}
console.log("✓ importance classification");

// Generators from user input
const userSignals = detectMissingFromUserInput(
  "Mom was discharged recently but I do not know when",
);
if (!userSignals.some((s) => /discharge date/i.test(s.question))) {
  throw new Error("user input must detect missing discharge date");
}
if (!userSignals.every((s) => s.source === "user_input")) {
  throw new Error("user input signals must use user_input source");
}
console.log("✓ user_input generator");

const reasoningSignals = detectMissingFromReasoning({
  careContext: {
    timestamp: new Date().toISOString(),
    situationType: "uncertain_state",
    urgencyLevel: "HIGH",
    environmentSignals: { timePressure: "medium", interruptionRisk: "low" },
    activeConstraints: ["unresolved_information"],
    recentEvents: ["discharged recently"],
    unresolvedItems: ["discharge date unknown"],
    userIntentSignal: { confidence: 0.4 },
  },
  timeEngine: {
    signals: { missingTime: true },
  } as Parameters<typeof detectMissingFromReasoning>[0]["timeEngine"],
});
if (reasoningSignals.length === 0) {
  throw new Error("reasoning generator must produce signals when time/discharge missing");
}
console.log("✓ reasoning generator");

// Situation-scoped store + auto-resolution
resetMissingInformationQueueStore();
let state = createDefaultMissingInformationQueueState("verify-user");
const item = createMissingInformationItem({
  situationId: "sit-verify-1",
  question: "What is the discharge date?",
  importance: "HIGH",
  source: "user_input",
});
if (!item) throw new Error("expected valid item");
if (!item.situationId) throw new Error("situationId required");
state = addMissingInformationItem(state, item);

const resolved = autoResolveMissingInformation(state, {
  input: "Discharged on January 22",
});
if (resolved.events.length !== 1) {
  throw new Error("auto-resolve must close discharge date gap from evidence");
}
if (resolved.state.items.find((i) => i.id === item.id)?.status !== "resolved") {
  throw new Error("item status must become resolved");
}
console.log("✓ auto-resolution from evidence");

// Layer process + influence
resetMissingInformationQueueStore();
const situation = createEmptyTrackedSituation({
  title: "Discharge follow-up",
  careSessionId: "sess-1",
  userId: "verify-user",
});
const layer = processMissingInformationQueueLayer({
  telemetry_user_id: "verify-user",
  input: "Mom was discharged recently",
  trackedSituations: [situation],
  careContext: {
    timestamp: new Date().toISOString(),
    situationType: "follow_up",
    urgencyLevel: "MEDIUM",
    environmentSignals: { timePressure: "low", interruptionRisk: "low" },
    activeConstraints: [],
    recentEvents: [],
    unresolvedItems: [],
    userIntentSignal: { confidence: 0.6 },
  },
});
if (!layer.guarantee.ok) {
  throw new Error(`guarantee failed: ${layer.guarantee.violations.join("; ")}`);
}
if (layer.envelope.highPriorityOpenCount < 1) {
  throw new Error("expected high-priority open gap from discharge without date");
}
if (layer.envelope.confidencePenalty <= 0 || layer.envelope.uncertaintyBoost <= 0) {
  throw new Error("high-priority gaps must influence confidence/uncertainty");
}
if (layer.envelope.needsNext.length === 0) {
  throw new Error("needsNext must surface for Decision Card");
}
const payload = toMissingInformationQueueLayerPayload(layer);
if (payload.health.openItems < 1) {
  throw new Error("payload health must report open items");
}
console.log("✓ process layer + influence envelope");

const emptyState = createDefaultMissingInformationQueueState("empty");
const emptyEnvelope = computeMissingInformationInfluenceEnvelope(emptyState);
const emptyGuarantee = runMissingInformationQueueGuarantee({
  state: emptyState,
  envelope: emptyEnvelope,
});
if (!emptyGuarantee.ok) throw new Error("empty state must pass guarantee");
console.log("✓ empty-state guarantee");

// Reject global items without situation in guarantee
const badState = createDefaultMissingInformationQueueState("bad");
badState.items.push({
  id: "bad-1",
  situationId: "",
  question: "What is unknown?",
  importance: "LOW",
  source: "reasoning",
  status: "open",
  createdAt: new Date().toISOString(),
});
const badEnvelope = computeMissingInformationInfluenceEnvelope(badState);
const badGuarantee = runMissingInformationQueueGuarantee({
  state: badState,
  envelope: badEnvelope,
});
if (badGuarantee.ok) {
  throw new Error("items without situationId must fail guarantee");
}
console.log("✓ situation-scoped guarantee");

// Pipeline wiring
const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const assumptionIdx = pipelineSource.indexOf("processAssumptionRegistryLayer(");
const missingIdx = pipelineSource.indexOf("processMissingInformationQueueLayer(");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer(");
if (!(assumptionIdx > 0 && missingIdx > assumptionIdx && priorityIdx > missingIdx)) {
  throw new Error(
    "pipeline order must be Assumption Registry → Missing Information Queue → Priority Engine",
  );
}
if (!pipelineSource.includes("missingInformationEnvelope")) {
  throw new Error("priority engine must receive missingInformationEnvelope");
}
if (!pipelineSource.includes("missing_information_queue_layer")) {
  throw new Error("pipeline must expose missing_information_queue_layer");
}
console.log("✓ analyze-pipeline wiring");

// No dedicated sidebar section
const sidebarConstants = fs.readFileSync(
  path.join(process.cwd(), "src/lib/ui-runtime/contract-constants.ts"),
  "utf-8",
);
const sidebarSectionBlock = sidebarConstants.match(
  /export const SIDEBAR_SECTION_IDS = \[([\s\S]*?)\] as const/,
)?.[1] ?? "";
if (/missing_information|information_needed|information needed/i.test(sidebarSectionBlock)) {
  throw new Error("must not add dedicated sidebar section for missing information");
}
const decisionCard = fs.readFileSync(
  path.join(process.cwd(), "src/components/ui-runtime/DecisionCardView.tsx"),
  "utf-8",
);
if (!decisionCard.includes("What SolenOS Needs Next")) {
  throw new Error("Decision Card must surface What SolenOS Needs Next");
}
const sidebarUi = fs.readFileSync(
  path.join(process.cwd(), "src/components/ui-runtime/Sidebar.tsx"),
  "utf-8",
);
if (!sidebarUi.includes("Information Needed")) {
  throw new Error("Situation/Care Context view must include Information Needed");
}
if (!sidebarUi.includes("Reasoning Quality Impact")) {
  throw new Error("System Health must include Reasoning Quality Impact");
}
console.log("✓ UI placement (no dedicated sidebar section)");

// Module sources must not implement task managers
const moduleDir = path.join(process.cwd(), "src/lib/missing-information-queue");
for (const file of fs.readdirSync(moduleDir)) {
  if (!file.endsWith(".ts")) continue;
  const src = fs.readFileSync(path.join(moduleDir, file), "utf-8");
  if (/\btodoList\b|\btaskManager\b|\bonboardingChecklist\b/i.test(src)) {
    throw new Error(`${file} must not implement task/todo/onboarding systems`);
  }
}
console.log("✓ no task/todo systems in module sources");

console.log("\n✓ Missing Information Queue verified");
