import fs from "node:fs";
import path from "node:path";
import {
  CARE_PROFILE_LAYER_IDENTITY,
  CARE_PROFILE_LAYER_FORBIDDEN,
  CARE_PROFILE_LAYER_PIPELINE_POSITION,
  CARE_PROFILE_UPDATE_MODES,
  DEFAULT_CARE_PROFILE,
  applyCareProfileBehaviorWeighting,
  applyCareProfileGovernanceWeighting,
  computeCareProfileWeightEnvelope,
  createDefaultCareProfileState,
  detectInferenceSignals,
  mergeCareProfileWithModuleWeights,
  processCareProfileLayer,
  processInputForProfileUpdate,
  resetCareProfileStore,
  rollbackToVersion,
  runCareProfileSystemGuarantee,
  seedProfileFromSettingsCareContext,
  syncSettingsCareContextFromProfile,
  toCareContextProfile,
} from "../src/lib/care-profile";
import { DEFAULT_SOLENOS_SETTINGS, applySettingsGovernance } from "../src/lib/settings-governance";
import { selectBehaviorProfile } from "../src/lib/input-classification";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Care Profile Layer ===\n");

if (!CARE_PROFILE_LAYER_IDENTITY.includes("inference identity graph")) {
  throw new Error("care profile identity contract drift");
}
if (!CARE_PROFILE_LAYER_FORBIDDEN.some((rule) => rule.includes("LLM prompt"))) {
  throw new Error("care profile must forbid LLM prompt decoration");
}
if (!CARE_PROFILE_LAYER_PIPELINE_POSITION.includes("after memory")) {
  throw new Error("care profile pipeline position must be after memory/context");
}
console.log("✓ care profile contract constants");

if (CARE_PROFILE_UPDATE_MODES.length !== 3) {
  throw new Error("care profile must define exactly 3 update modes");
}
console.log("✓ update modes defined");

const userConfirmedSignals = detectInferenceSignals("I am caring for my mom now");
if (!userConfirmedSignals.some((s) => s.kind === "user_confirmed_dependent")) {
  throw new Error("must detect user confirmed dependent language");
}
const medicationSignals = detectInferenceSignals("Mom missed her medication dose again");
if (!medicationSignals.some((s) => s.kind === "medication_pattern")) {
  throw new Error("must detect medication pattern signals");
}
const dependencySignals = detectInferenceSignals("I am caring for my elderly parent");
if (!dependencySignals.some((s) => s.kind === "dependency_language")) {
  throw new Error("must detect dependency language signals");
}
console.log("✓ inference signal detection");

resetCareProfileStore();
const userId = "00000000-0000-4000-8000-000000000002";
let state = createDefaultCareProfileState(userId);

const confirmed = processInputForProfileUpdate(state, "I am the primary caregiver", {
  inferenceAllowed: true,
});
if (confirmed.state.profile.roleInCareGraph !== "primary_caregiver") {
  throw new Error("USER_CONFIRMED must update role immediately");
}
if (confirmed.appliedVersion?.updateMode !== "USER_CONFIRMED") {
  throw new Error("explicit role statement must use USER_CONFIRMED mode");
}
console.log("✓ USER_CONFIRMED update mode");

state = confirmed.state;
const inferredOnce = processInputForProfileUpdate(state, "Mom missed her medication dose", {
  inferenceAllowed: true,
});
if (inferredOnce.appliedVersion) {
  throw new Error("single INFERRED signal must not apply without repeat threshold");
}
const inferredTwice = processInputForProfileUpdate(inferredOnce.state, "Mom missed her medication dose", {
  inferenceAllowed: true,
});
if (!inferredTwice.state.profile.conditionSignals.medicationReminders) {
  throw new Error("repeated INFERRED signals must update conditionSignals");
}
if (inferredTwice.appliedVersion?.updateMode !== "INFERRED") {
  throw new Error("repeated signals must use INFERRED mode");
}
console.log("✓ INFERRED update mode with confidence threshold");

const conflictSeed = createDefaultCareProfileState("conflict-user");
conflictSeed.profile.roleInCareGraph = "primary_caregiver";
conflictSeed.currentVersion = 2;
conflictSeed.history.push({
  version: 2,
  profile: conflictSeed.profile,
  updatedAt: new Date().toISOString(),
  updateMode: "USER_CONFIRMED",
  confidence: 1,
  reason: "seed",
});

let conflictState = conflictSeed;
for (let i = 0; i < 2; i++) {
  const result = processInputForProfileUpdate(
    conflictState,
    "we split caregiving responsibilities with my sister",
    { inferenceAllowed: true },
  );
  conflictState = result.state;
}
if (conflictState.pendingConflicts.length === 0) {
  throw new Error("CONFLICT_RESOLUTION must flag role mismatch");
}
if (conflictState.profile.roleInCareGraph !== "primary_caregiver") {
  throw new Error("CONFLICT_RESOLUTION must not silently overwrite stored profile");
}
console.log("✓ CONFLICT_RESOLUTION update mode");

const rolled = rollbackToVersion(conflictState, 1);
if (rolled.currentVersion <= conflictState.currentVersion) {
  throw new Error("rollback must create new version entry");
}
console.log("✓ version history and rollback");

const highEnvelope = computeCareProfileWeightEnvelope({
  ...DEFAULT_CARE_PROFILE,
  roleInCareGraph: "primary_caregiver",
  workloadIntensity: "HIGH",
});
const lowEnvelope = computeCareProfileWeightEnvelope({
  ...DEFAULT_CARE_PROFILE,
  roleInCareGraph: "observer",
  workloadIntensity: "LOW",
});
if (highEnvelope.urgencyPrioritization <= lowEnvelope.urgencyPrioritization) {
  throw new Error("HIGH workload must increase urgency prioritization vs LOW observer");
}
if (highEnvelope.compressionFactor >= lowEnvelope.compressionFactor) {
  throw new Error("HIGH workload must compress output more than LOW");
}
if (lowEnvelope.suggestionExpansion <= highEnvelope.suggestionExpansion) {
  throw new Error("LOW workload must allow more suggestion expansion");
}
console.log("✓ profile weighting envelope");

const behavior = selectBehaviorProfile({ mode: "emotional_narrative" });
const weightedBehavior = applyCareProfileBehaviorWeighting(behavior, {
  state: createDefaultCareProfileState("weight-user"),
  envelope: highEnvelope,
  appliedUpdates: [],
  guarantee: { ok: true, violations: [] },
});
if (weightedBehavior.verbosity_factor >= behavior.verbosity_factor) {
  throw new Error("HIGH workload envelope must reduce verbosity factor");
}
console.log("✓ behavior profile weighting");

const governance = applySettingsGovernance(VERIFY_VALID_SOLENOS, DEFAULT_SOLENOS_SETTINGS);
const merged = applyCareProfileGovernanceWeighting(governance, {
  state: createDefaultCareProfileState("gov-user"),
  envelope: highEnvelope,
  appliedUpdates: [],
  guarantee: { ok: true, violations: [] },
});
if (merged.moduleWeights.priority <= governance.moduleWeights.priority) {
  throw new Error("care profile must increase priority module weight for HIGH workload");
}
const mergedWeights = mergeCareProfileWithModuleWeights(governance.moduleWeights, highEnvelope);
if (mergedWeights.priority <= governance.moduleWeights.priority) {
  throw new Error("mergeCareProfileWithModuleWeights must boost priority");
}
console.log("✓ governance weighting integration");

const mirrored = toCareContextProfile(DEFAULT_CARE_PROFILE);
if (mirrored.roleInCareGraph !== DEFAULT_CARE_PROFILE.roleInCareGraph) {
  throw new Error("toCareContextProfile must mirror role");
}
const synced = syncSettingsCareContextFromProfile(DEFAULT_SOLENOS_SETTINGS, {
  ...DEFAULT_CARE_PROFILE,
  workloadIntensity: "HIGH",
});
if (synced.careContext.workloadIntensity !== "HIGH") {
  throw new Error("syncSettingsCareContextFromProfile must mirror workload");
}
const seeded = seedProfileFromSettingsCareContext(createDefaultCareProfileState("seed-user"), {
  ...DEFAULT_SOLENOS_SETTINGS.careContext,
  roleInCareGraph: "secondary_caregiver",
});
if (seeded.profile.roleInCareGraph !== "secondary_caregiver") {
  throw new Error("seedProfileFromSettingsCareContext must bootstrap from settings");
}
console.log("✓ settings-governance CareContextProfile bridge");

resetCareProfileStore();
const layer = processCareProfileLayer({
  telemetry_user_id: userId,
  input: "I am caring for my mom now",
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
});
if (!layer.guarantee.ok) {
  throw new Error(`care profile guarantee failed: ${layer.guarantee.violations.join("; ")}`);
}
const guaranteeFail = runCareProfileSystemGuarantee({
  state: layer.state,
  envelope: { ...layer.envelope, roleWeight: 0 },
  conflictsResolvedOrFlagged: true,
});
if (guaranteeFail.ok) {
  throw new Error("guarantee must reject zero role weight");
}
console.log("✓ system guarantee validation");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);

const groundingIdx = pipelineSource.indexOf("await runPreReasoningGrounding({");
const careProfileIdx = pipelineSource.indexOf("processCareProfileLayer({");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
const governanceIdx = pipelineSource.indexOf("applyCareProfileGovernanceWeighting(");

if (!(groundingIdx > 0 && careProfileIdx > groundingIdx && geminiIdx > careProfileIdx)) {
  throw new Error("care profile layer must run after grounding and before LLM");
}
if (!pipelineSource.includes("applyCareProfileBehaviorWeighting(behaviorProfile, careProfileLayer)")) {
  throw new Error("care profile must apply behavior weighting before LLM");
}
if (!(governanceIdx > geminiIdx)) {
  throw new Error("care profile governance weighting must run post-reasoning");
}
if (pipelineSource.includes("careProfileLayer") && pipelineSource.includes("observationTags:")) {
  const obsIdx = pipelineSource.indexOf("observationTags:");
  if (obsIdx > careProfileIdx && obsIdx < geminiIdx) {
    const obsBlock = pipelineSource.slice(obsIdx, obsIdx + 400);
    if (obsBlock.includes("careProfile")) {
      throw new Error("care profile must not be passed as LLM observation tag");
    }
  }
}
console.log("✓ care profile wired in analyze pipeline");

const migration = fs.readFileSync("db/migrations/012_care_profile.sql", "utf-8");
if (!migration.includes("care_profile_state")) {
  throw new Error("migration 012 must add care_profile_state column");
}
console.log("✓ postgres migration 012 present");

console.log("\n✓ Care Profile Layer enforced");
