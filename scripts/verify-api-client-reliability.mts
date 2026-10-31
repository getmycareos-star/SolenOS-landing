import assert from "node:assert/strict";
import { getJSON, postJSON, startTokenRefresh, stopTokenRefresh } from "../src/api/client";
import fs from "node:fs";

const clientSource = fs.readFileSync(new URL("../src/api/client.ts", import.meta.url), "utf8");
assert.match(clientSource, /\/api\/v1\/sessions\/refresh/, "session refresh must use the backend rotation endpoint");
assert.match(clientSource, /scheduleSessionRefresh/, "session rotation must be scheduled proactively");
assert.match(clientSource, /notifyAuthStateChanged/, "account/session changes must notify auth subscribers");
assert.match(clientSource, /stopTokenRefresh\(\)[\s\S]*?removeItem\(ANONYMOUS_TOKEN_KEY\)/, "revocation must cancel scheduled refresh before clearing credentials");
assert.match(clientSource, /MAX_TIMER_DELAY_MS = 2_147_000_000/, "long-lived sessions must not overflow browser timer limits");
assert.match(clientSource, /extraHeaders: Record<string, string> = \{\}/, "POST requests must support explicit idempotency headers without weakening session authorization");
assert.doesNotMatch(clientSource, /No backend-issued token exists to refresh/, "token refresh must not remain a no-op");
const appShell = fs.readFileSync(new URL("../src/components/app-shell/AppShell.tsx", import.meta.url), "utf8");
for (const key of [
  "solenos_entered_care_record",
  "solenos_durable_care_key",
  "solenos_share_history",
  "solenos_research_preview_ack_v1",
  "solenos_activation_dismissed_prompts",
  "solenos_activation_prior_follow_up_count",
  "solenos_activation_last_input_snippet",
]) {
  assert.match(appShell, new RegExp('"'+key+'"'), "device deletion must clear "+key);
}
assert.match(appShell, /await revokeAnonymousSession\(\)/, "device deletion must revoke the server-issued session before clearing local state");
assert.match(appShell, /Local workspace data was not cleared/, "failed server revocation must not be reported as a successful deletion");

const accountSettings = fs.readFileSync(new URL("../src/app/workspace/settings/page.tsx", import.meta.url), "utf8");
assert.match(accountSettings, /signInToAccount\(email, password\)/, "settings must authenticate existing caregiver accounts against the backend");
assert.match(accountSettings, /revokeAnonymousSession\(\)/, "device sign-out must revoke the current server-issued session");
assert.match(accountSettings, /does not merge the anonymous care record currently open on this device/, "account sign-in must disclose the record-switch boundary");

const values = new Map<string, string>([
  ["solenos_anonymous_access_token", "server-issued-token"],
  ["solenos_backend_person_id", "person-server-1"],
  ["solenos_backend_caregiver_id", "caregiver-server-1"],
  ["solenos_anonymous_session_expires_at", new Date(Date.now() + 60 * 60 * 1000).toISOString()],
]);
const store = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, String(value)),
  removeItem: (key: string) => values.delete(key),
};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: store, dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined },
});
function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json" : null },
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as unknown as Response;
}

async function main() {
  let reads = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    reads += 1;
    assert.equal(String(input), "/api/v1/events/person-server-1");
    assert.equal(init?.method ?? "GET", "GET");
    assert.ok(init?.signal instanceof AbortSignal, "read requests must have a timeout signal");
    return reads === 1 ? response({ detail: "temporary unavailable" }, 503) : response({ events: [] });
  }) as typeof fetch;
  const result = await getJSON("/events/person-server-1");
  assert.deepEqual(result, { events: [] });
  assert.equal(reads, 2, "safe GET must retry one transient 503 exactly once");

  let writes = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    writes += 1;
    assert.equal(init?.method, "POST");
    assert.ok(init?.signal instanceof AbortSignal, "write requests must have a timeout signal");
    return response({ detail: "temporary unavailable" }, 503);
  }) as typeof fetch;
  await assert.rejects(postJSON("/daily/log", { note: "write once" }), /temporary unavailable/);
  assert.equal(writes, 1, "mutations must never be retried automatically");

  // A minimal non-browser test window must not crash when the app initializes
  // refresh controls. In browsers, long-lived expiry values must be capped so
  // the 32-bit timer does not overflow and fire immediately.
  let scheduledDelay = -1;
  const fakeWindow = (globalThis as { window?: Record<string, unknown> }).window!;
  fakeWindow.setTimeout = ((_callback: () => void, delay: number) => { scheduledDelay = delay; return 7; }) as typeof window.setTimeout;
  fakeWindow.clearTimeout = (() => undefined) as typeof window.clearTimeout;
  values.set("solenos_anonymous_session_expires_at", new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());
  startTokenRefresh();
  assert.ok(scheduledDelay > 0 && scheduledDelay <= 2_147_000_000, "long-lived session refresh timer must remain within the browser's signed 32-bit delay");
  stopTokenRefresh();
  console.log("API reliability checks passed: timeout signal, one safe GET retry, no mutation replay, bounded refresh timer.");
}
void main();
