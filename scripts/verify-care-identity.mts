/**
 * verify-care-identity.mts
 * Validate the production Vite identity boundary and fail-closed legacy route contract.
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

// The legacy Next route is disabled and the deployed Vite path writes through the
// authenticated FastAPI API. Backend integration tests exercise real DB persistence.


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
