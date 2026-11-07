import assert from "node:assert/strict";
import { getBlob, getJSON, postFormData, postJSON } from "../src/api/client";

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
  const originalSetTimeout = globalThis.setTimeout;
  const observedTimeouts: number[] = [];
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof timeout === "number") observedTimeouts.push(timeout);
    return originalSetTimeout(handler, timeout, ...args);
  }) as typeof setTimeout;
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
    assert.ok(init?.body instanceof FormData);
    return response({ evidence_id: "evidence-1", persisted: true }, 201);
  }) as typeof fetch;
  await postFormData("/upload", new FormData());
  assert.ok(observedTimeouts.includes(120_000), "document uploads must use a 120-second transfer deadline");

  globalThis.fetch = (async () => ({ ok: true, status: 200, blob: async () => new Blob(["original document"]) }) as unknown as Response) as typeof fetch;
  await getBlob("/upload/evidence-1");
  assert.ok(observedTimeouts.filter(value => value === 120_000).length >= 2, "original document downloads must use a 120-second transfer deadline");

  globalThis.fetch = (async () => response({ analysis_id: "analysis-1", extraction_status: "available" }, 201)) as typeof fetch;
  await postJSON("/documents/evidence-1/extract", {}, {}, { timeoutMs: 180_000 });
  assert.ok(observedTimeouts.includes(180_000), "document extraction must use a bounded 180-second processing deadline");

  await postJSON("/conversation/message", { text: "What was recorded?" }, {}, { timeoutMs: 210_000 });
  assert.ok(observedTimeouts.includes(210_000), "Companion inference must be allowed the backend model ceiling plus response overhead");

  globalThis.setTimeout = originalSetTimeout;
  console.log("API reliability checks passed: safe GET retry, no mutation replay, idempotency, and bounded Companion/document deadlines.");
}
void main();
