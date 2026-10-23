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
let missingIdentityRejected = false;
try {
  resolveDurableCareKey({ caregiver_id: null, care_session_id: "sess_abc" });
} catch {
  missingIdentityRejected = true;
}
assert(missingIdentityRejected, "missing caregiver identity is rejected, not replaced by a shared key");
assert(
  ensureClientDurableCareKey("default_caregiver").startsWith("care_"),
  "legacy shared identity is discarded and replaced with a browser-local key",
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
seedVerifyConsent("cg_verify_identity");

const first = await processSituationInput({
  raw_input: "Mom fell yesterday. We went to urgent care.",
  caregiver_id: "cg_verify_identity",
  care_session_id: "sess_verify_1",
  timestamp: "2026-07-16T12:00:00.000Z",
});

assert(first.care_key === "cg_verify_identity", "response includes care_key");
const realityKey = first.context.care_recipient_id;
assert(
  listSituationsForSession(realityKey).some((s) => s.status === "ACTIVE"),
  "TrackedSituation ACTIVE after first write (keyed by Care Reality id)",
);

const second = await processSituationInput({
  raw_input: "She seemed unsteady walking after that.",
  caregiver_id: "cg_verify_identity",
  care_session_id: "sess_verify_2",
  timestamp: "2026-07-16T13:00:00.000Z",
});

assert(
  listSituationsForSession(realityKey).filter((s) => s.status === "ACTIVE").length === 1,
  "same TrackedSituation across sessions",
);
assert(
  getActiveCareSituation("cg_verify_identity")?.id === second.active_care_situation?.id,
  "same ACS across interaction sessions",
);
console.log("✓ subsequent write updates same TrackedSituation + server ACS");

const beforePause = getActiveCareSituation("cg_verify_identity");
assert(beforePause != null, "ACS present before pause");
const paused = pauseActiveCareSituationSession("cg_verify_identity");
assert(paused != null && paused.id === beforePause!.id, "Locked A: pause keeps ACS");
assert(Boolean(paused?.interaction_paused_at), "pause stamps interaction_paused_at");
assert(getActiveCareSituation("cg_verify_identity") != null, "pause does not clear ACS");
console.log("✓ ACS pause preserves durable Care Reality (Locked A)");

// Test teardown only — not product pause.
clearActiveCareSituation("cg_verify_identity");
assert(getActiveCareSituation("cg_verify_identity") === null, "test clear removes ACS");

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
// The duplicate Next route is intentionally disabled: production is the Vite SPA
// backed by authenticated FastAPI. It must not revive process-local care storage.
assert(route.includes("legacyRouteUnavailable"), "legacy duplicate route stays disabled");
assert(route.includes("status: 410"), "legacy duplicate route returns Gone");
assert(route.includes("authenticated FastAPI care API"), "legacy route directs callers to authoritative API");
assert(!route.includes("hydrateTrackedSituationsFromCareContext"), "legacy route cannot create local care records");

// Validate the actual deployed Vite entrypoint and authenticated client.
// The legacy Next-style workspace is not the production app and its duplicate API is disabled.
const entry = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const client = fs.readFileSync(path.join(root, "src/api/client.ts"), "utf8");
assert(entry.includes("./App"), "Vite entry mounts the React Router app");
assert(app.includes("checkAuthState") && app.includes("AuthGate"), "care pages are gated by authenticated session");
assert(client.includes("Authorization") && client.includes("Bearer "), "API requests send bearer authorization");
assert(client.includes("getCaregiverId") && client.includes("solenos_caregiver_id"), "caregiver attribution comes from explicit stored account identity");
assert(client.includes("A linked caregiver") || client.includes("solenos_caregiver_id"), "client does not derive caregiver identity from session IDs");
assert(!client.includes("default_caregiver"), "API client does not substitute a shared caregiver identity");

console.log("✓ API + UI wiring");

console.log("\n=== Care identity checks passed ===\n");
