import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureAnonymousSession, getBlob, getJSON, postFormData, postJSON, setCareIdentity, setPersonId } from "../src/api/client";

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
const identityEvents: string[] = [];
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: store,
    dispatchEvent: (event: Event) => { identityEvents.push(event.type); return true; },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  },
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

const originalSetTimeout = globalThis.setTimeout;
const observedTimeouts: number[] = [];
globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  observedTimeouts.push(Number(timeout ?? 0));
  return originalSetTimeout(handler, timeout, ...args);
}) as typeof setTimeout;

const apiClientSource = readFileSync(
  new URL("../src/api/client.ts", import.meta.url),
  "utf8",
);
assert.match(apiClientSource, /event\.key === ANONYMOUS_PERSON_KEY[\s\S]*?event\.key === ANONYMOUS_CAREGIVER_KEY[\s\S]*?dispatchEvent\(new Event\("personIdChanged"\)\)/,
  "other tabs must clear caregiver-scoped views when the active backend identity changes");
assert.match(apiClientSource, /setItem\(ANONYMOUS_EXPIRY_KEY, refreshed\.expires_at\)[\s\S]*?completeExplicitSessionBootstrap\(revocationMarkerAtStart\)[\s\S]*?setCareIdentity\(refreshed\.person_id, refreshed\.caregiver_id\)/,
  "refreshed session credentials and expiry must be persisted before notifying care-scope subscribers");
assert.match(apiClientSource, /setItem\(ANONYMOUS_EXPIRY_KEY, created\.expires_at\)[\s\S]*?completeExplicitSessionBootstrap\(revocationMarkerAtStart\)[\s\S]*?setCareIdentity\(created\.person\.id, created\.caregiver\.id\)/,
  "new session credentials and expiry must be persisted before notifying care-scope subscribers");

async function main() {
  setPersonId("person-server-1");
  assert.deepEqual(
    identityEvents,
    ["personIdChanged"],
    "a genuine care-recipient identity change must notify identity subscribers once",
  );
  identityEvents.length = 0;
  setCareIdentity("person-server-1", "caregiver-server-2");
  assert.deepEqual(identityEvents, ["personIdChanged"],
    "a caregiver-only identity change must notify every care-scoped subscriber once");
  identityEvents.length = 0;
  setCareIdentity("person-server-1", "caregiver-server-2");
  assert.deepEqual(identityEvents, [],
    "reusing the same person and caregiver identity must not trigger another scope reset");
  setCareIdentity("person-server-1", "caregiver-server-1");
  identityEvents.length = 0;
  await ensureAnonymousSession();
  await ensureAnonymousSession();
  assert.deepEqual(
    identityEvents,
    [],
    "reusing the same authenticated person must not recursively notify identity subscribers",
  );

  const photoCaptureSource = readFileSync(
    new URL("../src/components/workflows/DailyCarePhotoCapture.tsx", import.meta.url),
    "utf8",
  );
  assert.match(photoCaptureSource, /form\.append\("ingestion_key", retryKey\)/);
  assert.match(photoCaptureSource, /const retryKey = ingestionKey \?\? crypto\.randomUUID\(\)/);
  assert.match(photoCaptureSource, /setIngestionKey\(null\)/, "photo retry key must be cleared only when the selected source changes or the upload succeeds");
  const naturalLanguageUpdateSource = readFileSync(
    new URL("../src/components/workflows/NaturalLanguageDailyUpdate.tsx", import.meta.url),
    "utf8",
  );
  assert.match(naturalLanguageUpdateSource, /identityRetryCount < 20[\s\S]*?setTimeout\(sync, 250\)/,
    "durable writes must retry briefly when session identity has not hydrated at component mount");
  assert.match(naturalLanguageUpdateSource, /handleIdentityChange[\s\S]*?personIdChanged/,
    "durable-write sync must restart when the authenticated care-record identity changes");
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

  let idempotencyHeader = "";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    idempotencyHeader = headers.get("X-Request-ID") ?? "";
    return response({ id: "handoff-1" }, 201);
  }) as typeof fetch;
  await postJSON("/handoffs", { draft_id: "draft-1" }, { "X-Request-ID": "stable-handoff-request-1" });
  assert.equal(idempotencyHeader, "stable-handoff-request-1", "mutations must preserve caller-supplied idempotency keys");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    return response({ reply: "synthetic response" });
  }) as typeof fetch;
  await postJSON("/conversation/message", { text: "synthetic question" });
  assert.ok(observedTimeouts.includes(210_000), "Companion must not be cancelled by the generic 15-second client deadline");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    assert.ok(init?.body instanceof FormData);
    return response({ evidence_id: "evidence-1", persisted: true }, 201);
  }) as typeof fetch;
  await postFormData("/upload", new FormData());
  assert.ok(observedTimeouts.includes(120_000), "document upload must use its bounded file-transfer deadline");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    return response({ analysis_id: "analysis-1" }, 201);
  }) as typeof fetch;
  await postJSON("/documents/evidence-1/extract", {});
  assert.ok(observedTimeouts.includes(180_000), "server-side document extraction must have a bounded OCR processing deadline");
  await postJSON("/documents/evidence-1/intelligence", {});
  assert.ok(observedTimeouts.includes(210_000), "document intelligence must have a bounded model-processing deadline");

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    blob: async () => new Blob(["synthetic document"]),
  }) as unknown as Response) as typeof fetch;
  await getBlob("/upload/evidence-1");
  assert.ok(observedTimeouts.filter(value => value === 120_000).length >= 2, "document downloads must use the extended file-transfer deadline");

  globalThis.setTimeout = originalSetTimeout;
  console.log("API reliability checks passed: safe GET retry, no mutation replay, request idempotency, photo-upload retry identity, and Companion/document-specific deadlines.");
}
void main();
