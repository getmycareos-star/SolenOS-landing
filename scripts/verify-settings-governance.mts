import fs from "node:fs";

import path from "node:path";

import {

  GOVERNANCE_LAYER_IDENTITY,

  GOVERNANCE_LAYER_FORBIDDEN,

  GOVERNANCE_LAYER_PIPELINE_POSITION,

  ALLOWED_GOVERNANCE_CONSTRAINTS,

  DEFAULT_SOLENOS_SETTINGS,

  DEFAULT_MEMORY_CONTROL_WEIGHTS,

  applySettingsGovernance,

  computeModuleActivation,

  computeModuleWeights,

  computeGovernanceRouting,

  runSystemBehaviorGuarantee,

  parseSolenOSSettings,

  mergeWithDefaultSettings,

  normalizeSettingsInput,

  deriveMemoryVisibility,

  resetGovernanceSettingsStore,

  setUserGovernanceSettings,

  getUserGovernanceSettings,

} from "../src/lib/settings-governance";



import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";



console.log("=== System Settings Layer (settings-governance) ===\n");



if (!GOVERNANCE_LAYER_IDENTITY.includes("post-reasoning")) {

  throw new Error("governance layer identity must be post-reasoning");

}

console.log("✓ system settings layer identity contract");



if (!GOVERNANCE_LAYER_FORBIDDEN.some((rule) => rule.includes("influence reasoning"))) {

  throw new Error("governance layer must forbid influencing reasoning");

}

console.log("✓ system settings forbidden actions defined");



if (!GOVERNANCE_LAYER_PIPELINE_POSITION.includes("before output assembly")) {

  throw new Error("governance layer must run before output assembly");

}

console.log("✓ system settings pipeline position contract");



const parsedDefaults = parseSolenOSSettings(DEFAULT_SOLENOS_SETTINGS);

if (parsedDefaults.systemMode !== "NORMAL") {

  throw new Error("default system mode must be NORMAL");

}

if (parsedDefaults.safetyControl.medicalMode !== "advisory_only") {

  throw new Error("default medical mode must be advisory_only");

}

if (parsedDefaults.safetyControl.noCertaintyMode !== false) {

  throw new Error("default noCertaintyMode must be false");

}

if (parsedDefaults.safetyControl.riskTolerance !== "LOW") {

  throw new Error("default riskTolerance must be LOW");

}

if (parsedDefaults.memoryControl.allowMemoryRead !== true) {

  throw new Error("default allowMemoryRead must be true");

}

if (parsedDefaults.memoryControl.allowMemoryWrite !== true) {

  throw new Error("default allowMemoryWrite must be true");

}

console.log("✓ default settings schema valid (MemoryControl + SafetyControl)");



const partial = mergeWithDefaultSettings({ systemMode: "CONSERVATIVE" });

if (partial.systemMode !== "CONSERVATIVE") {

  throw new Error("partial merge must override systemMode");

}

if (partial.safetyControl.medicalMode !== "advisory_only") {

  throw new Error("partial merge must preserve unset nested defaults");

}

console.log("✓ partial settings merge");



const legacyNormalized = mergeWithDefaultSettings(

  normalizeSettingsInput({

    memoryGovernance: {

      identityMemory: true,

      longTermPatternMemory: false,

      operationalMemory: true,

      emotionalMemory: false,

      inferenceFromBehavior: true,

    },

    timeEngine: {

      timezoneDetection: false,

      coarseLocationEnabled: true,

      strictHorizonMode: true,

      timeHorizonModel: DEFAULT_SOLENOS_SETTINGS.timeControl.timeHorizonModel,

    },

    emotionalModel: DEFAULT_SOLENOS_SETTINGS.emotionalControl,

    aiTransparency: DEFAULT_SOLENOS_SETTINGS.transparencyControl,

    notificationControl: {

      ...DEFAULT_SOLENOS_SETTINGS.notificationControl,

      quietHours: true,

    },

    privacyControl: {

      ...DEFAULT_SOLENOS_SETTINGS.privacyControl,

      allowBehaviorBasedInference: true,

    },

  }) as Partial<typeof DEFAULT_SOLENOS_SETTINGS>,

);

if (legacyNormalized.memoryControl.identityMemoryWeight !== 0.25) {

  throw new Error("legacy memoryGovernance must migrate identity weight");

}

if (legacyNormalized.memoryControl.operationalMemoryWeight !== 0.3) {

  throw new Error("legacy memoryGovernance must migrate operational weight");

}

if (legacyNormalized.timeControl.strictTimeHorizonMode !== true) {

  throw new Error("legacy timeEngine.strictHorizonMode must migrate to strictTimeHorizonMode");

}

if (legacyNormalized.notificationControl.quietHoursEnabled !== true) {

  throw new Error("legacy quietHours must migrate to quietHoursEnabled");

}

if (legacyNormalized.privacyControl.allowBehaviorInference !== true) {

  throw new Error("legacy allowBehaviorBasedInference must migrate to allowBehaviorInference");

}

console.log("✓ legacy field name migration");



const activation = computeModuleActivation(DEFAULT_SOLENOS_SETTINGS);

const weights = computeModuleWeights(DEFAULT_SOLENOS_SETTINGS, activation);

const routing = computeGovernanceRouting(DEFAULT_SOLENOS_SETTINGS, weights);

if (routing.inferenceDepth !== "standard" && routing.inferenceDepth !== "shallow") {

  throw new Error("NORMAL mode routing must be standard or shallow");

}

if (deriveMemoryVisibility(DEFAULT_SOLENOS_SETTINGS.memoryControl) !== "summary") {

  throw new Error("default memory weights must derive summary visibility");

}

console.log("✓ module activation and weighting from MemoryControl");



const highRiskResponse = {

  ...VERIFY_VALID_SOLENOS,

  risk_level: "critical" as const,

};

const conservative = applySettingsGovernance(highRiskResponse, {

  ...DEFAULT_SOLENOS_SETTINGS,

  systemMode: "CONSERVATIVE",

});

if (conservative.response.risk_level !== "medium") {

  throw new Error("CONSERVATIVE mode must cap critical risk to medium");

}

if (!conservative.guarantee.ok) {

  throw new Error(`conservative guarantee failed: ${conservative.guarantee.violations.join("; ")}`);

}

console.log("✓ CONSERVATIVE risk cap constraint");



const crisis = applySettingsGovernance(

  { ...VERIFY_VALID_SOLENOS, risk_level: "low" },

  { ...DEFAULT_SOLENOS_SETTINGS, systemMode: "CRISIS" },

);

if (crisis.response.risk_level !== "medium") {

  throw new Error("CRISIS mode must floor low risk to medium");

}

if (crisis.routing.decisionAutonomy !== "LOW") {

  throw new Error("CRISIS mode must enforce LOW decision autonomy");

}

console.log("✓ CRISIS mode constraints");



const privacyBlocked = applySettingsGovernance(VERIFY_VALID_SOLENOS, {

  ...DEFAULT_SOLENOS_SETTINGS,

  privacyControl: {

    ...DEFAULT_SOLENOS_SETTINGS.privacyControl,

    disableInferenceEngine: true,

  },

});

if (privacyBlocked.moduleWeights.memory !== 0) {

  throw new Error("disableInferenceEngine must zero memory weight");

}

console.log("✓ privacy inference block");



const memoryReadBlocked = applySettingsGovernance(VERIFY_VALID_SOLENOS, {

  ...DEFAULT_SOLENOS_SETTINGS,

  memoryControl: {

    ...DEFAULT_SOLENOS_SETTINGS.memoryControl,

    allowMemoryRead: false,

  },

});

if (memoryReadBlocked.moduleActivation.memory) {

  throw new Error("allowMemoryRead=false must deactivate memory module");

}

console.log("✓ MemoryControl allowMemoryRead gate");



const customWeights = applySettingsGovernance(VERIFY_VALID_SOLENOS, {

  ...DEFAULT_SOLENOS_SETTINGS,

  memoryControl: {

    ...DEFAULT_MEMORY_CONTROL_WEIGHTS,

    identityMemoryWeight: 0.5,

    patternMemoryWeight: 0,

    operationalMemoryWeight: 0.5,

    emotionalMemoryWeight: 0,

    inferenceFromBehavior: false,

    allowMemoryRead: true,

    allowMemoryWrite: true,

  },

});

if (customWeights.moduleWeights.memory <= weights.memory) {

  throw new Error("custom MemoryControl weights must affect module weighting");

}

console.log("✓ MemoryControl weight fields drive module weights");



const confirmHighRisk = applySettingsGovernance(highRiskResponse, DEFAULT_SOLENOS_SETTINGS);

if (!confirmHighRisk.response.what_to_ask_next.startsWith("[Confirm before acting]")) {

  throw new Error("high risk must require confirmation prefix");

}

console.log("✓ decision authority confirmation");



for (const kind of conservative.appliedConstraints.map((c) => c.kind)) {

  if (!ALLOWED_GOVERNANCE_CONSTRAINTS.includes(kind)) {

    throw new Error(`unlisted constraint kind: ${kind}`);

  }

}

console.log("✓ all applied constraints are allowed kinds");



const badResult = {

  ...conservative,

  appliedConstraints: [{ kind: "invalid_kind" as never, detail: "test" }],

};

const badGuarantee = runSystemBehaviorGuarantee(badResult);

if (badGuarantee.ok) {

  throw new Error("guarantee must reject unauthorized constraint kinds");

}

console.log("✓ system behavior guarantee rejects unauthorized constraints");



resetGovernanceSettingsStore();

const userId = "00000000-0000-4000-8000-000000000001";

setUserGovernanceSettings(userId, { ...DEFAULT_SOLENOS_SETTINGS, systemMode: "AUTONOMOUS" });

const stored = getUserGovernanceSettings(userId);

if (stored.systemMode !== "AUTONOMOUS") {

  throw new Error("in-memory persistence must round-trip settings");

}

console.log("✓ in-memory settings persistence");



const pipelineSource = fs.readFileSync(

  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),

  "utf-8",

);



const nonAssistantIdx = pipelineSource.indexOf("if (!isNonAssistantOutputValid(epistemicOutput))");

const governanceIdx = pipelineSource.indexOf("applySettingsGovernance(");

const safetyIdx = pipelineSource.indexOf("enforceSafetyConstraints(");

const trustLayerIdx = pipelineSource.indexOf("const trustLayer = assembleTrustLayer(");

const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");



if (!(nonAssistantIdx > 0 && governanceIdx > nonAssistantIdx && trustLayerIdx > governanceIdx)) {

  throw new Error("governance must run after validation and before trust layer assembly");

}

if (!(safetyIdx > governanceIdx && trustLayerIdx > safetyIdx)) {

  throw new Error("pipeline order must be governance → safety-enforcement → trust output assembly");

}

if (governanceIdx < geminiIdx) {

  throw new Error("governance must not run before LLM generation");

}

if (!pipelineSource.includes("governanceSettings")) {

  throw new Error("pipeline must accept governanceSettings param");

}

console.log("✓ pipeline order: governance → safety → trust");



const migration = fs.readFileSync("db/migrations/011_settings_governance.sql", "utf-8");

if (!migration.includes("governance_settings")) {

  throw new Error("migration 011 must add governance_settings column");

}

console.log("✓ postgres migration 011 present");



console.log("\n✓ System Settings Layer enforced");


