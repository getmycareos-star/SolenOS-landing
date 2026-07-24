/**
 * verify-care-identity.mts
 * One durable care key; MVP upserts TrackedSituation; sidebar can read real ACS/CareContext.
 * Locked A: session ≠ care reality; pause does not clear ACS.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resolveDurableCareKey,
  careSessionIdForDurableKey,
  ensureClientDurableCareKey,
  ensureClientInteractionSessionId,
  isInteractionSessionId,
  mintDurableCareKey,
  mintInteractionSessionId,
  requireCareKeyFromRequest,
} from "../src/lib/care-identity";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import {
  listSituationsForSession,
  resetResolutionStoreForTests,
} from "../src/lib/resolution-engine/persistence";
import { hydrateTrackedSituationsFromCareContext } from "../src/lib/resolution-engine/care-context-sync";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import {
  clearActiveCareSituation,
  getActiveCareSituation,
  pauseActiveCareSituationSession,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Identity / Active Situations ===\n");

assert(
  resolveDurableCareKey({ caregiver_id: "cg_a", care_session_id: "other" }) === "cg_a",
  "caregiver_id wins as durable key",
);
assert(
  resolveDurableCareKey({ caregiver_id: null, care_session_id: "sess_abc" }) ===
    "default_caregiver",
  "interaction session is not a care key",
);
assert(
  ensureClientDurableCareKey("default_caregiver") === "default_caregiver",
  "Locked A: stored default_caregiver identity is preserved (not reminted/orphaned)",
);
assert(
  ensureClientDurableCareKey("care_stable") === "care_stable",
  "reuse durable care key",
);
assert(
  ensureClientDurableCareKey(null).startsWith("care_"),
  "client path mints when missing",
);
assert(mintDurableCareKey().startsWith("care_"), "mintDurableCareKey prefix");
assert(mintInteractionSessionId().startsWith("sess_"), "session mint prefix");
assert(
  isInteractionSessionId(ensureClientInteractionSessionId(null)),
  "interaction session id is sess_*",
);
assert(
  isInteractionSessionId(careSessionIdForDurableKey("cg_a")),
  "deprecated helper no longer aliases care key as session",
);
assert(
  requireCareKeyFromRequest({ caregiver_id: null, care_session_id: null }).ok === false,
  "API requires explicit care key",
);
assert(
  requireCareKeyFromRequest({ caregiver_id: "cg_a", care_session_id: null }).ok === true,
  "API accepts caregiver_id",
);
assert(
  requireCareKeyFromRequest({ caregiver_id: null, care_session_id: "sess_only" }).ok ===
    false,
  "API rejects sess_* as care key",
);
console.log("✓ durable care key + interaction session separation");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetNormalizationStore();
resetPolicyEngineStore();
resetResolutionStoreForTests();
resetActiveCareSituationStore();
seedVerifyConsent("default_caregiver");

const first = await processSituationInput({
  raw_input: "Mom fell yesterday. We went to urgent care.",
  caregiver_id: "default_caregiver",
  care_session_id: "sess_verify_1",
  timestamp: "2026-07-16T12:00:00.000Z",
});

assert(first.care_key === "default_caregiver", "response includes care_key");
const realityKey = first.context.care_recipient_id;
assert(
  listSituationsForSession(realityKey).some((s) => s.status === "ACTIVE"),
  "TrackedSituation ACTIVE after first write (keyed by Care Reality id)",
);

const second = await processSituationInput({
  raw_input: "She seemed unsteady walking after that.",
  caregiver_id: "default_caregiver",
  care_session_id: "sess_verify_2",
  timestamp: "2026-07-16T13:00:00.000Z",
});

assert(
  listSituationsForSession(realityKey).filter((s) => s.status === "ACTIVE").length === 1,
  "same TrackedSituation across sessions",
);
assert(
  getActiveCareSituation("default_caregiver")?.id === second.active_care_situation?.id,
  "same ACS across interaction sessions",
);
console.log("✓ subsequent write updates same TrackedSituation + server ACS");

const beforePause = getActiveCareSituation("default_caregiver");
assert(beforePause != null, "ACS present before pause");
const paused = pauseActiveCareSituationSession("default_caregiver");
assert(paused != null && paused.id === beforePause!.id, "Locked A: pause keeps ACS");
assert(Boolean(paused?.interaction_paused_at), "pause stamps interaction_paused_at");
assert(getActiveCareSituation("default_caregiver") != null, "pause does not clear ACS");
console.log("✓ ACS pause preserves durable Care Reality (Locked A)");

// Test teardown only — not product pause.
clearActiveCareSituation("default_caregiver");
assert(getActiveCareSituation("default_caregiver") === null, "test clear removes ACS");

resetResolutionStoreForTests();
const hydrated = hydrateTrackedSituationsFromCareContext({
  durableCareKey: realityKey,
  events: first.context.events.map((e) => ({
    id: e.id,
    raw_input: e.raw_input,
    document_id: e.document_id,
  })),
});
assert(hydrated.active.length >= 1, "hydrate from CareContext recreates TrackedSituation");
console.log("✓ hydrate from CareContext when TrackedSituation empty");

const route = fs.readFileSync(path.join(root, "src/app/api/situation/route.ts"), "utf8");
assert(route.includes("hydrateTrackedSituationsFromCareContext"), "GET hydrates TrackedSituation");
assert(route.includes("active_situations") || route.includes("situations"), "GET returns situations");
assert(route.includes("getActiveCareSituation"), "GET hydrates Active Care Situation");
assert(route.includes("pause_active_care_situation"), "POST can pause ACS");
assert(route.includes("resolveInteractionSessionId"), "API separates interaction session");

const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
assert(page.includes("onSituationComplete"), "page hydrates sidebar from situation complete");
assert(page.includes("/api/situation?"), "page fetches situation for sidebar");
assert(page.includes("ensureClientInteractionSessionId"), "Begin mints interaction session");
assert(page.includes("forceNew: freshEnter"), "Begin forceNew session only");
assert(!/freshEnter\s*\?\s*mintDurableCareKey/.test(page), "Begin never remints care key");

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf8",
);
assert(workspace.includes("caregiver_id"), "workspace sends caregiver_id");
assert(workspace.includes("care_session_id"), "workspace sends care_session_id");
assert(workspace.includes("onSituationComplete"), "workspace notifies parent");
assert(workspace.includes("pause_active_care_situation"), "Done for now pauses ACS via API");
assert(workspace.includes("active_care_situation"), "workspace hydrates ACS from GET");
assert(workspace.includes("offer_return_invite=0"), "mount hydrate does not burn soft invite");

console.log("✓ API + UI wiring");

console.log("\n=== Care identity checks passed ===\n");
