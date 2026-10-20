/**
 * verify-activation-system.mts
 * SolenOS Activation System — habit formation without gamification.
 */

import fs from "node:fs";
import path from "node:path";

import {
  ACTIVATION_ACKNOWLEDGEMENT,
  ACTIVATION_EVENT_TYPES,
  ACTIVATION_FORBIDDEN,
  FORBIDDEN_REENGAGEMENT_COPY,
  REENGAGEMENT_INACTIVE_DAYS,
  computeTrustStage,
  computeHabitHour,
  selectContextualPrompt,
  recordActivationEvent,
  computeUserMetrics,
  computeDashboardMetrics,
  resetActivationStoreForTests,
  buildActivationSessionContext,
  createDefaultUserState,
} from "../src/lib/activation-system";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Activation System ===\n");

resetActivationStoreForTests();

assert(ACTIVATION_EVENT_TYPES.length === 8, "eight activation event types");
console.log("✓ instrumentation event types");

assert(computeTrustStage(0) === "early", "early stage for new users");
assert(computeTrustStage(4) === "early", "early until 5 entries");
assert(computeTrustStage(5) === "building", "building at 5 entries");
assert(computeTrustStage(20) === "established", "established at 20 entries");
console.log("✓ trust progression engine");

const userId = "cg_activation";
for (let i = 0; i < 5; i++) {
  recordActivationEvent({ user_id: userId, event_type: "ENTRY_CREATED" });
}
const buildingState = buildActivationSessionContext({
  user_id: userId,
  state: recordActivationEvent({ user_id: userId, event_type: "ENTRY_CREATED" }).state,
  last_input_snippet: "doctor appointment today went okay",
});
assert(buildingState.trust_stage === "building", "building stage after entries");
assert(buildingState.show_optional_context === true, "optional context in building");
console.log("✓ trust stage gates optional context");

const habitHour = computeHabitHour([20, 20, 21, 20, 8]);
assert(habitHour === 20, "habit hour detected from recurring evening entries");

const habitPrompt = selectContextualPrompt({
  user_id: userId,
  state: {
    ...createDefaultUserState(userId),
    trust_stage: "building",
    total_entries: 6,
    habit_hour: 20,
    last_entry_at: new Date().toISOString(),
  },
  now: new Date("2026-07-15T20:30:00"),
});
assert(habitPrompt?.type === "habit_window", "habit window prompt at recurring time");
console.log("✓ contextual prompt system");

const reengageState = {
  ...createDefaultUserState(userId),
  trust_stage: "building" as const,
  total_entries: 10,
  last_entry_at: new Date(Date.now() - REENGAGEMENT_INACTIVE_DAYS * 86400000 - 1000).toISOString(),
};
const reengage = selectContextualPrompt({
  user_id: userId,
  state: reengageState,
});
assert(reengage?.type === "reengagement", "14-day reengagement prompt");
for (const forbidden of FORBIDDEN_REENGAGEMENT_COPY) {
  assert(!reengage!.message.toLowerCase().includes(forbidden.toLowerCase()), `no forbidden copy: ${forbidden}`);
}
console.log("✓ reengagement without guilt copy");

resetActivationStoreForTests();
recordActivationEvent({ user_id: userId, event_type: "VOICE_ENTRY_CREATED" });
recordActivationEvent({ user_id: userId, event_type: "ENTRY_CREATED" });
recordActivationEvent({ user_id: userId, event_type: "DOCUMENT_UPLOADED" });
recordActivationEvent({ user_id: userId, event_type: "RESPONSE_GENERATED" });
recordActivationEvent({ user_id: userId, event_type: "RETURN_SESSION" });

const metrics = computeUserMetrics(userId);
assert(metrics.voice_usage_rate > 0, "voice usage rate tracked");
assert(metrics.document_usage_rate > 0, "document usage rate tracked");
assert(metrics.trust_stage === "early", "trust stage in user metrics");

const dashboard = computeDashboardMetrics();
assert(dashboard.total_events >= 5, "dashboard aggregates events");
console.log("✓ instrumentation metrics");

assert(ACTIVATION_ACKNOWLEDGEMENT.includes("organizing"), "instant feedback acknowledgement");
assert(ACTIVATION_FORBIDDEN.includes("streaks"), "forbidden gamification listed");
console.log("✓ instant feedback + forbidden mechanics");

const required = [
  "src/lib/activation-system/index.ts",
  "src/lib/activation-system/store.ts",
  "src/lib/activation-system/prompts.ts",
  "src/lib/activation-system/trust-progression.ts",
  "db/migrations/018_activation_system.sql",
  "src/app/api/activation/session/route.ts",
  "src/app/api/activation/events/route.ts",
  "src/app/api/activation/metrics/route.ts",
  "src/components/ops-devtools/RealMomentPanel.tsx",
  "src/components/mvp-workspace/CognitiveWorkspace.tsx",
  "src/components/mvp-workspace/ActivationOutputPanel.tsx",
  "src/components/ops-devtools/ActivationPromptBanner.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("input-channel-bar"), "equal hierarchy input channels");
assert(realMoment.includes("Type") && realMoment.includes("Speak"), "text and voice tabs visible");
assert(realMoment.includes('accept="image/*,application/pdf"'), "document input spec");
assert(realMoment.includes('capture="environment"'), "camera capture");

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf-8",
);
assert(workspace.includes("ActivationOutputPanel"), "instant feedback output panel");
assert(workspace.includes("ENTRY_CREATED"), "entry instrumentation on submit");
assert(workspace.includes("RESPONSE_GENERATED"), "response instrumentation");

const analyzePipeline = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(!analyzePipeline.includes("activation-system"), "reasoning pipeline unchanged");

console.log("\n=== Activation System verification complete ===");
