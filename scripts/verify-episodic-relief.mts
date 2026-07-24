import fs from "node:fs";
import path from "node:path";
import {
  EPISODIC_RELIEF_DESIGN_PRINCIPLE,
  EPISODIC_RELIEF_FAILURE_MODEL,
  EPISODIC_RELIEF_ONE_LINE_TRUTH,
  EPISODIC_RELIEF_SUCCESS,
  isEpisodicReliefValid,
} from "../src/lib/episodic-relief";
import { withMeta } from "../src/lib/response-validator";
import {
  classifyEpisodicReliefFailure,
  FailureLogEntrySchema,
} from "../src/lib/failure-observability";
import {
  MVP_EPISODIC_FORBIDDEN_SURFACE,
  MVP_FORBIDDEN_IN_ANALYZE,
  MVP_TELEMETRY_FORBIDDEN_SURFACE,
} from "../src/lib/mvp-architecture";
import { SOLENOS_SYSTEM_PROMPT, SYSTEM_PROMPT_SPEC_MARKERS } from "../src/lib/solenos-langchain-adapter/system-prompt";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Episodic Cognitive Relief Engine ===\n");

for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error(`system prompt missing episodic relief marker: ${marker}`);
  }
}
console.log("✓ episodic relief system prompt markers");

const safe = withMeta(VERIFY_VALID_SOLENOS);
if (!isEpisodicReliefValid(safe)) {
  throw new Error("valid fixture must pass episodic relief gate");
}
console.log("✓ valid relief output passes episodic gate");

const retention = withMeta({
  ...VERIFY_VALID_SOLENOS,
  what_can_wait: "Check in regularly and come back to the app tomorrow to track your progress.",
});
if (isEpisodicReliefValid(retention)) {
  throw new Error("retention/engagement language must fail");
}
console.log("✓ blocks retention and engagement language");

const platform = withMeta({
  ...VERIFY_VALID_SOLENOS,
  follow_up_items: ["Open your dashboard to complete onboarding and manage your tasks here."],
});
if (isEpisodicReliefValid(platform)) {
  throw new Error("platform/onboarding behavior must fail");
}
console.log("✓ blocks platform and onboarding prompts");

const analyzeSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/analyze/route.ts"),
  "utf-8",
);
for (const forbidden of MVP_FORBIDDEN_IN_ANALYZE) {
  if (analyzeSource.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`/api/analyze contains episodic-forbidden pattern: ${forbidden}`);
  }
}
console.log("✓ /api/analyze remains stateless (no session/store orchestration)");

const pageSource = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf-8");
for (const forbidden of MVP_EPISODIC_FORBIDDEN_SURFACE) {
  if (pageSource.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`MVP page contains forbidden episodic surface: ${forbidden}`);
  }
}
for (const forbidden of MVP_TELEMETRY_FORBIDDEN_SURFACE) {
  if (pageSource.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`MVP page contains forbidden telemetry product surface: ${forbidden}`);
  }
}
console.log("✓ MVP UI has no retention/dashboard/telemetry history surface");

FailureLogEntrySchema.parse({
  timestamp: new Date().toISOString(),
  stage: "postprocess",
  failure_type: classifyEpisodicReliefFailure().failure_type,
  retry_count: 0,
});
console.log("✓ EPISODIC_RELIEF_FAILURE logged via observability");

console.log(`\n✓ ${EPISODIC_RELIEF_DESIGN_PRINCIPLE}`);
console.log(`✓ Success metric: "${EPISODIC_RELIEF_SUCCESS}"`);
console.log(`✓ ${EPISODIC_RELIEF_FAILURE_MODEL}`);
console.log(`✓ ${EPISODIC_RELIEF_ONE_LINE_TRUTH}`);
