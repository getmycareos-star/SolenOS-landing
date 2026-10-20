import fs from "node:fs";
import path from "node:path";
import {
  SAFETY_ENFORCEMENT_LAYER_IDENTITY,
  SAFETY_ENFORCEMENT_LAYER_FORBIDDEN,
  SAFETY_ENFORCEMENT_LAYER_PIPELINE_POSITION,
  ALLOWED_SAFETY_CONSTRAINTS,
  DEFAULT_SAFETY_CONTROL,
  enforceSafetyConstraints,
  runSafetySystemGuarantee,
  buildEscalationContext,
  toSolenOSSafetyControl,
} from "../src/lib/safety-enforcement";
import { DEFAULT_SOLENOS_SETTINGS } from "../src/lib/settings-governance";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Safety Enforcement Layer ===\n");

if (!SAFETY_ENFORCEMENT_LAYER_IDENTITY.includes("post-governance")) {
  throw new Error("safety layer identity must be post-governance");
}
console.log("✓ safety layer identity contract");

if (!SAFETY_ENFORCEMENT_LAYER_FORBIDDEN.some((rule) => rule.includes("influence reasoning"))) {
  throw new Error("safety layer must forbid influencing reasoning");
}
console.log("✓ safety layer forbidden actions defined");

if (!SAFETY_ENFORCEMENT_LAYER_PIPELINE_POSITION.includes("before trust")) {
  throw new Error("safety layer must run before trust/disclaimer output assembly");
}
console.log("✓ safety pipeline position contract");

const bridged = toSolenOSSafetyControl(DEFAULT_SOLENOS_SETTINGS.safetyControl);
if (bridged.medicalMode !== "advisory_only" || bridged.riskTolerance !== "LOW") {
  throw new Error("bridge from settings-governance must preserve safety defaults");
}
console.log("✓ settings-governance bridge");

const advisory = enforceSafetyConstraints(VERIFY_VALID_SOLENOS, {
  control: { ...DEFAULT_SAFETY_CONTROL, medicalMode: "advisory_only" },
});
if (!advisory.response.what_to_ask_next.includes("advisory guidance only")) {
  throw new Error("advisory_only must append advisory suffix");
}
if (!advisory.guarantee.ok) {
  throw new Error(`advisory guarantee failed: ${advisory.guarantee.violations.join("; ")}`);
}
console.log("✓ medical mode advisory_only filtering");

const restricted = enforceSafetyConstraints(
  { ...VERIFY_VALID_SOLENOS, risk_level: "high" },
  { control: { ...DEFAULT_SAFETY_CONTROL, medicalMode: "restricted" } },
);
if (restricted.response.risk_level !== "medium") {
  throw new Error("restricted medical mode must cap risk at medium");
}
console.log("✓ medical mode restricted scope");

const externalBlocked = enforceSafetyConstraints(
  {
    ...VERIFY_VALID_SOLENOS,
    what_matters_now: "Call 911 immediately and go to the ER now.",
    what_to_ask_next: "[ ] Did she take the evening dose?",
  },
  { control: { ...DEFAULT_SAFETY_CONTROL, externalEscalationEnabled: false } },
);
if (/\b911\b/i.test(externalBlocked.response.what_matters_now)) {
  throw new Error("externalEscalationEnabled=false must strip 911 guidance");
}
console.log("✓ external escalation gating");

const uncertainty = enforceSafetyConstraints(VERIFY_VALID_SOLENOS, {
  control: { ...DEFAULT_SAFETY_CONTROL, alwaysShowUncertainty: true, noCertaintyMode: true },
});
if (!uncertainty.response.what_is_happening.includes("Uncertainty")) {
  throw new Error("alwaysShowUncertainty must inject uncertainty marker");
}
console.log("✓ uncertainty controls");

const lowTolerance = enforceSafetyConstraints(VERIFY_VALID_SOLENOS, {
  control: { ...DEFAULT_SAFETY_CONTROL, riskTolerance: "LOW" },
});
if (!lowTolerance.response.what_matters_now.includes("[Safety caution]")) {
  throw new Error("LOW risk tolerance must add conservative warning");
}
console.log("✓ risk tolerance LOW shaping");

const escalation = buildEscalationContext({
  responseRiskLevel: "low",
  careContextUrgency: "CRITICAL",
  emergencySituation: true,
  memoryCompositeInfluence: 0.1,
  emergencySensitivity: "high",
});
if (escalation.escalationAction !== "emergency_override") {
  throw new Error("CRITICAL context with emergency must trigger emergency_override");
}
if (escalation.effectiveRiskLevel === "low") {
  throw new Error("conflict resolution must elevate effective risk above memory low signal");
}
console.log("✓ escalation matrix and conflict resolution");

const conflict = enforceSafetyConstraints(
  { ...VERIFY_VALID_SOLENOS, risk_level: "low" },
  {
    control: DEFAULT_SAFETY_CONTROL,
    careContextUrgency: "CRITICAL",
    emergencySituation: true,
    memoryCompositeInfluence: 0.1,
  },
);
if (!conflict.appliedConstraints.some((c) => c.kind === "conflict_resolution")) {
  throw new Error("memory low vs context emergency must record conflict_resolution");
}
console.log("✓ conflict resolution constraint recorded");

for (const kind of advisory.appliedConstraints.map((c) => c.kind)) {
  if (!ALLOWED_SAFETY_CONSTRAINTS.includes(kind)) {
    throw new Error(`unlisted safety constraint kind: ${kind}`);
  }
}
console.log("✓ all applied constraints are allowed kinds");

const badResult = {
  ...advisory,
  appliedConstraints: [{ kind: "invalid_kind" as never, detail: "test" }],
};
const badGuarantee = runSafetySystemGuarantee(badResult);
if (badGuarantee.ok) {
  throw new Error("guarantee must reject unauthorized constraint kinds");
}
console.log("✓ system guarantee rejects unauthorized constraints");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);

const governanceIdx = pipelineSource.indexOf("applySettingsGovernance(");
const safetyIdx = pipelineSource.indexOf("enforceSafetyConstraints(");
const trustLayerIdx = pipelineSource.indexOf("const trustLayer = assembleTrustLayer(");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(governanceIdx > 0 && safetyIdx > governanceIdx && trustLayerIdx > safetyIdx)) {
  throw new Error("safety must run after governance and before trust layer assembly");
}
if (safetyIdx < geminiIdx) {
  throw new Error("safety must not run before LLM generation");
}
if (!pipelineSource.includes("safety_layer")) {
  throw new Error("pipeline must expose safety_layer payload");
}
console.log("✓ safety wired post-governance in analyze pipeline");

console.log("\n✓ Safety Enforcement Layer enforced");
