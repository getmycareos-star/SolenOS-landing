import fs from "node:fs";

import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";
import {
  IDENTITY_CONTINUITY_FORBIDDEN,
  IDENTITY_CONTINUITY_ONE_LINE_TRUTH,
  IDENTITY_CONTINUITY_PURPOSE,
  LOGIN_PROMPT_MESSAGE,
  PERSISTENCE_TRIGGER_IDS,
  SIGNUP_PROMPT_MESSAGE,
  buildPersistenceSignals,
  evaluatePostAnalyzeContinuity,
  handleUserInteraction,
  requiresPersistence,
  resetAuthCredentialsForTests,
  resetCareStateStoreForTests,
  rehydrateCareState,
  shouldPromptLogin,
  shouldPromptSignup,
  upgradeEphemeralToPersistent,
  authenticatePersistentUser,
} from "../src/lib/identity-continuity";

console.log("=== SolenOS Identity Continuity — Contract ===\n");

if (!IDENTITY_CONTINUITY_PURPOSE.includes("continuity")) {
  throw new Error("purpose must reference continuity binding");
}
if (!IDENTITY_CONTINUITY_ONE_LINE_TRUTH.includes("immediately")) {
  throw new Error("one-line truth must enforce value-first flow");
}
if (IDENTITY_CONTINUITY_FORBIDDEN.length < 4) {
  throw new Error("forbidden uses must block auth gates");
}
if (PERSISTENCE_TRIGGER_IDS.length !== 6) {
  throw new Error("persistence trigger ids must match strict spec");
}
if (!SIGNUP_PROMPT_MESSAGE.includes("Save this care situation")) {
  throw new Error("signup prompt must preserve continuity framing");
}
if (!LOGIN_PROMPT_MESSAGE.includes("Continue")) {
  throw new Error("login prompt must frame state restoration");
}
console.log("✓ contract constants");

const analyzeRoute = fs.readFileSync("src/app/api/analyze/route.ts", "utf-8");
if (!analyzeRoute.includes("handleUserInteraction")) {
  throw new Error("analyze route must evaluate continuity after pipeline result");
}
if (!analyzeRoute.includes("continuity_layer")) {
  throw new Error("analyze route must attach continuity_layer metadata");
}
const pipelineIndex = analyzeRoute.indexOf("runAnalyzePipelineWithObservability");
const continuityIndex = analyzeRoute.indexOf("handleUserInteraction");
if (pipelineIndex === -1 || continuityIndex === -1 || continuityIndex < pipelineIndex) {
  throw new Error("continuity evaluation must run AFTER analyze pipeline");
}
console.log("✓ analyze route — value first, continuity metadata after");

resetCareStateStoreForTests();
resetAuthCredentialsForTests();

const ephemeralResult = evaluatePostAnalyzeContinuity({
  input: "Mom's discharge paperwork mentions two new medications and follow-up labs.",
  source_type: "text",
  care_context_state: "active_care",
  result: VERIFY_VALID_SOLENOS,
});

if (ephemeralResult.continuity_layer.continuity_prompt.action !== "prompt_signup") {
  throw new Error("ephemeral active care must prompt signup after value");
}
if (ephemeralResult.continuity_layer.persistence_triggers.length === 0) {
  throw new Error("persistence triggers must be reported when signup prompted");
}
console.log("✓ ephemeral → signup prompt after care value");

const noTriggerSignals = buildPersistenceSignals({
  input: "What is caregiving?",
  source_type: "text",
  care_context_state: "uncertain",
  result: VERIFY_VALID_SOLENOS,
  care_graph_node_count_before: 1,
  memory_node_count_before: 1,
});

if (requiresPersistence(noTriggerSignals, { mode: "ephemeral" })) {
  throw new Error("second interaction without triggers should not require persistence");
}
console.log("✓ requiresPersistence — strict trigger gating");

const sessionId = ephemeralResult.care_session_id;
const upgraded = await upgradeEphemeralToPersistent({
  care_session_id: sessionId,
  email: "caregiver@example.com",
  password: "securepass1",
});

if (upgraded.identity_state.mode !== "persistent") {
  throw new Error("upgrade must bind ephemeral session to persistent mode");
}

const rehydrated = rehydrateCareState(upgraded.user_id);
if (!rehydrated || rehydrated.care_graph.nodes.length === 0) {
  throw new Error("login rehydration must restore care graph without reset");
}

const auth = await authenticatePersistentUser({
  email: "caregiver@example.com",
  password: "securepass1",
});
if (!auth) {
  throw new Error("authenticatePersistentUser must validate upgraded credentials");
}

const returnSignals = buildPersistenceSignals({
  input: "What was I working on last time with mom's medications?",
  source_type: "text",
  care_context_state: "active_care",
  result: VERIFY_VALID_SOLENOS,
  care_graph_node_count_before: 1,
  memory_node_count_before: 1,
});

if (
  !shouldPromptLogin(
    {
      ...upgraded.identity_state,
      has_stored_care_graph: true,
      auth_enabled: true,
      mode: "persistent",
    },
    returnSignals,
  )
) {
  throw new Error("persistent user with return behavior must prompt login");
}

if (shouldPromptSignup(upgraded.identity_state, true)) {
  throw new Error("persistent users must never be prompted to signup");
}

resetCareStateStoreForTests();

const rememberHandled = handleUserInteraction({
  input: "Remember this medication schedule for mom.",
  source_type: "text",
  careResult: VERIFY_VALID_SOLENOS,
  care_context_state: "active_care",
  identityState: {
    care_session_id: crypto.randomUUID(),
    mode: "ephemeral",
    auth_enabled: false,
    has_stored_care_graph: false,
  },
});

if (rememberHandled.result.what_is_happening !== VERIFY_VALID_SOLENOS.what_is_happening) {
  throw new Error("handleUserInteraction must return care result unchanged");
}
if (rememberHandled.continuity_layer.continuity_prompt.action === "none") {
  throw new Error("remember request must trigger continuity prompt");
}
console.log("✓ state upgrade, rehydration, and handleUserInteraction");

console.log("\n=== Identity Continuity contract verified ===");
