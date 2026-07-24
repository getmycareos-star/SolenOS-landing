import fs from "node:fs";
import path from "node:path";
import {
  SYSTEM_HEALTH_LAYER_FORBIDDEN,
  SYSTEM_HEALTH_LAYER_IDENTITY,
  SYSTEM_HEALTH_LAYER_ONE_LINE_TRUTH,
  SYSTEM_HEALTH_LAYER_PIPELINE_POSITION,
  SYSTEM_HEALTH_WEIGHTS,
  SYSTEM_HEALTH_BANDS,
  SITUATION_LOAD_HIGH_THRESHOLD,
  SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD,
  CLARIFICATION_REQUEST_PREFIX,
  applySystemHealthGovernanceWeighting,
  buildSystemHealth,
  collectContextHealth,
  collectContradictionHealth,
  collectDocumentHealth,
  collectMemoryHealth,
  computeOverallHealthScore,
  generateHealthAlerts,
  labelHealthBand,
  processSystemHealthLayer,
  runSystemHealthGuarantee,
  scoreContradictionHealth,
  toSystemHealthLayerPayload,
  toSystemHealthSidebarView,
} from "../src/lib/system-health";
import { createDefaultMemoryInfluenceState } from "../src/lib/memory-influence";
import { computeCareContext } from "../src/lib/care-context/situational";
import {
  DEFAULT_SOLENOS_SETTINGS,
  applySettingsGovernance,
  ALLOWED_GOVERNANCE_CONSTRAINTS,
} from "../src/lib/settings-governance";
import { classifyInputSurface } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== System Health Module ===\n");

if (!SYSTEM_HEALTH_LAYER_IDENTITY.includes("decision-readiness")) {
  throw new Error("system health identity contract drift");
}
if (!SYSTEM_HEALTH_LAYER_ONE_LINE_TRUTH.includes("readiness")) {
  throw new Error("system health one-line truth must emphasize readiness");
}
if (!SYSTEM_HEALTH_LAYER_FORBIDDEN.some((r) => /CPU|API|DB|infrastructure/i.test(r))) {
  throw new Error("system health must forbid infrastructure metrics");
}
if (!SYSTEM_HEALTH_LAYER_PIPELINE_POSITION.includes("governance/safety")) {
  throw new Error("system health pipeline position must reference governance/safety");
}
console.log("✓ system health contract constants");

const weightSum =
  SYSTEM_HEALTH_WEIGHTS.contextQuality +
  SYSTEM_HEALTH_WEIGHTS.memoryQuality +
  SYSTEM_HEALTH_WEIGHTS.situationCoverage +
  SYSTEM_HEALTH_WEIGHTS.contradictionHealth +
  SYSTEM_HEALTH_WEIGHTS.documentHealth +
  SYSTEM_HEALTH_WEIGHTS.decisionHealth;
if (Math.abs(weightSum - 1) > 1e-9) {
  throw new Error(`weights must sum to 1, got ${weightSum}`);
}
if (SYSTEM_HEALTH_WEIGHTS.contextQuality !== 0.25) {
  throw new Error("context quality weight must be 25%");
}
if (SYSTEM_HEALTH_WEIGHTS.memoryQuality !== 0.2) {
  throw new Error("memory quality weight must be 20%");
}
if (SYSTEM_HEALTH_WEIGHTS.situationCoverage !== 0.2) {
  throw new Error("situation coverage weight must be 20%");
}
if (SYSTEM_HEALTH_WEIGHTS.contradictionHealth !== 0.15) {
  throw new Error("contradiction weight must be 15%");
}
if (SYSTEM_HEALTH_WEIGHTS.documentHealth !== 0.1) {
  throw new Error("document health weight must be 10%");
}
if (SYSTEM_HEALTH_WEIGHTS.decisionHealth !== 0.1) {
  throw new Error("decision health weight must be 10%");
}
console.log("✓ weighting formula");

if (labelHealthBand(95) !== "Strong") throw new Error("90-100 → Strong");
if (labelHealthBand(84) !== "Stable") throw new Error("75-89 → Stable");
if (labelHealthBand(60) !== "Degraded") throw new Error("50-74 → Degraded");
if (labelHealthBand(20) !== "Unreliable") throw new Error("0-49 → Unreliable");
if (SYSTEM_HEALTH_BANDS.Stable.min !== 75) throw new Error("Stable band min drift");
console.log("✓ band labeling");

const healthyParts = {
  contextQuality: {
    missingCriticalInformation: 0,
    unresolvedQuestions: 0,
    staleContextItems: 0,
  },
  memoryQuality: {
    outdatedMemoryCount: 0,
    correctedMemoryCount: 0,
    conflictingMemoryCount: 0,
  },
  situationCoverage: {
    activeSituations: 1,
    blockedSituations: 0,
    unresolvedSituations: 0,
  },
  contradictionHealth: {
    contradictionsDetected: 0,
    unresolvedContradictions: 0,
  },
  documentHealth: {
    staleDocuments: 0,
    unreadDocuments: 0,
    lowConfidenceExtractions: 0,
    unreadCriticalDocuments: 0,
  },
  decisionHealth: {
    acceptedRecommendations: 0,
    rejectedRecommendations: 0,
    overriddenRecommendations: 0,
  },
  assumptionQuality: {
    activeAssumptions: 0,
    expiredAssumptions: 0,
    invalidatedAssumptions: 0,
    staleAssumptions: 0,
  },
  missingInformationQuality: {
    openItems: 0,
    highPriorityItems: 0,
    resolvedItems: 0,
  },
};
const healthy = buildSystemHealth(healthyParts);
if (healthy.health.overallHealthScore !== 100) {
  throw new Error(`healthy baseline should be 100, got ${healthy.health.overallHealthScore}`);
}
if (healthy.band !== "Strong") throw new Error("healthy baseline must be Strong");
console.log("✓ healthy baseline score");

const withContradiction = buildSystemHealth({
  ...healthyParts,
  contradictionHealth: {
    contradictionsDetected: 2,
    unresolvedContradictions: 2,
  },
});
const contradictionOnly = scoreContradictionHealth({
  contradictionsDetected: 2,
  unresolvedContradictions: 2,
});
if (contradictionOnly >= 100) {
  throw new Error("contradictions MUST reduce health score");
}
if (withContradiction.health.overallHealthScore >= healthy.health.overallHealthScore) {
  throw new Error("overall score must drop when contradictions present");
}
console.log("✓ contradictions reduce health");

const withUnreadCritical = buildSystemHealth({
  ...healthyParts,
  documentHealth: {
    staleDocuments: 0,
    unreadDocuments: 1,
    lowConfidenceExtractions: 0,
    unreadCriticalDocuments: 1,
  },
});
if (withUnreadCritical.health.overallHealthScore >= healthy.health.overallHealthScore) {
  throw new Error("unread critical documents must heavily impact health");
}
console.log("✓ unread critical documents impact score");

const highLoad = processSystemHealthLayer({
  situations: {
    activeSituations: SITUATION_LOAD_HIGH_THRESHOLD,
    blockedSituations: 0,
    unresolvedSituations: 2,
  },
});
if (!highLoad.alerts.some((a) => a.title === "Situation Load High")) {
  throw new Error('high situation load must flag "Situation Load High"');
}
console.log("✓ Situation Load High alert");

const rejectionDrift = processSystemHealthLayer({
  decisionFeedback: {
    acceptedRecommendations: 1,
    rejectedRecommendations: 4,
    overriddenRecommendations: 1,
  },
});
if (!rejectionDrift.alerts.some((a) => /rejection/i.test(a.title))) {
  throw new Error("repeated rejection must alert model drift / context gaps");
}
console.log("✓ rejection drift alert");

const mode = classifyInputSurface("Mom missed medication and insurance paperwork is unread");
const urgency = detectUrgencyLevel(
  "Mom missed medication and I still have not read the insurance letter",
  mode.mode,
);
const care = computeCareContext({
  input: "Mom missed medication schedule and insurance document still unread; two open care tasks unresolved",
  inputMode: mode.mode,
  urgencyDetection: urgency,
});
const stress = stressNormalizeInput(
  "She is fine today but not okay tonight — contradictory. Unresolved: refill and transport.",
);
const memory = {
  state: createDefaultMemoryInfluenceState("00000000-0000-4000-8000-000000000099"),
  envelope: {
    identityBias: 0,
    patternBias: 0,
    operationalBias: 0,
    emotionalBias: 0,
    compositeInfluence: 0,
    interpretationHints: [] as const,
  },
  appliedUpdates: [] as const,
  guarantee: { ok: true, violations: [] as string[] },
};
memory.state.memory.operationalMemory.entries.push({
  id: "m1",
  key: "med_schedule",
  influenceLabel: "medication schedule preference",
  influenceWeight: 0.8,
  confidence: 0.9,
  occurrenceCount: 2,
  tags: { outdated: true, incorrect: false, sensitive: false },
  source: "USER_CONFIRMED",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const integrated = processSystemHealthLayer({
  careContextLayer: care,
  memoryInfluenceLayer: memory,
  stressNormalized: stress,
  situations: {
    activeSituations: 2,
    blockedSituations: 0,
    unresolvedSituations: 2,
  },
  currentAutonomy: "HIGH",
});

if (!integrated.guarantee.checked.context || !integrated.guarantee.checked.memory) {
  throw new Error("guarantee must record context/memory checks");
}
if (!integrated.userFacingSummary.includes("System Health:")) {
  throw new Error("user-facing summary must include System Health header");
}
if (!integrated.userFacingSummary.includes("Issues Requiring Attention")) {
  throw new Error("user-facing summary must list issues");
}
console.log("✓ collectors + user-facing summary");

if (SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD !== 0.7) {
  throw new Error("document confidence threshold must be 0.7");
}
const emptyDocs = collectDocumentHealth(undefined);
if (emptyDocs.unreadDocuments !== 0) throw new Error("skipped docs should be empty");
console.log("✓ document collector defaults");

const ctx = collectContextHealth({ careContext: care.context });
if (typeof ctx.unresolvedQuestions !== "number") {
  throw new Error("context health must expose unresolvedQuestions");
}
const mem = collectMemoryHealth(memory.state);
if (mem.outdatedMemoryCount < 1) throw new Error("must count outdated memory");
const contradictions = collectContradictionHealth({
  stressNormalized: stress,
  memoryHealth: mem,
});
if (contradictions.contradictionsDetected < 1) {
  throw new Error("stress contradictions must register");
}
console.log("✓ signal adapters");

const degraded = processSystemHealthLayer({
  careContextLayer: care,
  memoryInfluenceLayer: memory,
  stressNormalized: stress,
  situations: {
    activeSituations: 5,
    blockedSituations: 2,
    unresolvedSituations: 3,
  },
  decisionFeedback: {
    acceptedRecommendations: 0,
    rejectedRecommendations: 5,
    overriddenRecommendations: 2,
  },
  currentAutonomy: "HIGH",
});
if (degraded.band !== "Degraded" && degraded.band !== "Unreliable") {
  throw new Error(`expected Degraded/Unreliable, got ${degraded.band} (${degraded.health.overallHealthScore})`);
}
if (!degraded.gate.constrainAutonomy || !degraded.gate.boostUncertainty) {
  throw new Error("degraded health must constrain autonomy and boost uncertainty");
}
if (degraded.gate.autonomyLevel !== "LOW" && degraded.gate.autonomyLevel !== "MEDIUM") {
  throw new Error("autonomy must be reduced from HIGH");
}
if (!degraded.gate.requestClarification) {
  throw new Error("degraded health must request clarification");
}
console.log("✓ pre-recommendation gate on degraded health");

const governance = applySettingsGovernance(
  VERIFY_VALID_SOLENOS,
  DEFAULT_SOLENOS_SETTINGS,
  { validatedRiskLevel: VERIFY_VALID_SOLENOS.risk_level },
);
const constrained = applySystemHealthGovernanceWeighting(governance, degraded);
if (
  !constrained.appliedConstraints.some((c) => c.kind === "system_health_gate")
) {
  throw new Error("governance must apply system_health_gate constraint");
}
if (!ALLOWED_GOVERNANCE_CONSTRAINTS.includes("system_health_gate")) {
  throw new Error("system_health_gate must be an allowed governance constraint");
}
if (!constrained.response.what_to_ask_next.startsWith(CLARIFICATION_REQUEST_PREFIX)) {
  throw new Error("clarification prefix must be applied");
}
if (!constrained.response.what_matters_now.includes("Uncertainty elevated")) {
  throw new Error("uncertainty marker must be applied");
}
if (constrained.routing.decisionAutonomy === "HIGH") {
  throw new Error("decision autonomy must be reduced");
}
console.log("✓ governance weighting + autonomy reduction");

const guarantee = runSystemHealthGuarantee({
  health: degraded.health,
  contextChecked: true,
  memoryChecked: true,
  contradictionsChecked: true,
  criticalDocumentsChecked: true,
  band: degraded.band,
});
if (!guarantee.ok) {
  throw new Error(`guarantee should pass when checked: ${guarantee.violations.join(", ")}`);
}
const unchecked = runSystemHealthGuarantee({
  health: degraded.health,
  contextChecked: false,
  memoryChecked: true,
  contradictionsChecked: true,
  criticalDocumentsChecked: true,
  band: degraded.band,
});
if (unchecked.ok) throw new Error("unchecked context must fail guarantee");
console.log("✓ system health guarantee");

const payload = toSystemHealthLayerPayload(degraded);
const sidebar = toSystemHealthSidebarView(payload);
if (!sidebar.summaryLine.includes(payload.band)) {
  throw new Error("sidebar view must expose band");
}
if (sidebar.gateActive !== true) {
  throw new Error("sidebar must mark gate active when degraded");
}
console.log("✓ payload + sidebar view-model");

const alerts = generateHealthAlerts(degraded.health, degraded.band);
if (alerts.length === 0) throw new Error("degraded health should generate alerts");
const overall = computeOverallHealthScore(degraded.dimensionScores);
if (overall !== degraded.health.overallHealthScore) {
  throw new Error("overall score must match dimension-weighted computation");
}
console.log("✓ alerts + weighted overall");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (!pipelineSource.includes("processSystemHealthLayer(")) {
  throw new Error("analyze pipeline must call processSystemHealthLayer");
}
if (!pipelineSource.includes("applySystemHealthGovernanceWeighting(")) {
  throw new Error("analyze pipeline must apply system health governance weighting");
}
if (!pipelineSource.includes("system_health_layer")) {
  throw new Error("analyze pipeline run must expose system_health_layer");
}
const healthIdx = pipelineSource.indexOf("processSystemHealthLayer(");
const safetyIdx = pipelineSource.indexOf("enforceSafetyConstraints(governance.response");
if (!(healthIdx > 0 && safetyIdx > healthIdx)) {
  throw new Error("system health must run before safety enforcement");
}
if (/cpuUsage|apiUptime|dbLatency|infra/.test(pipelineSource.slice(healthIdx, healthIdx + 800))) {
  throw new Error("system health wiring must not include infrastructure metrics");
}
console.log("✓ analyze pipeline wiring");

console.log("\n✓ System Health Module verified");
