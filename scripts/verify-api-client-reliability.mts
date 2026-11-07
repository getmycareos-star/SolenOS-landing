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

  const originalSetTimeout = globalThis.setTimeout;
  const observedTimeouts: number[] = [];
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    observedTimeouts.push(Number(timeout));
    return originalSetTimeout(handler, timeout, ...args);
  }) as typeof setTimeout;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    assert.ok(init?.signal instanceof AbortSignal);
    return response({ reply: "A grounded response." });
  }) as typeof fetch;
  await postJSON("/conversation/message", {
    person_id: "person-server-1",
    text: "What changed?",
    client_turn_id: "stable-turn-identifier",
  }, { timeoutMs: 210_000 });
  assert.ok(observedTimeouts.includes(210_000), "Companion deadline must exceed the backend's 180-second inference ceiling");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    assert.ok(init?.body instanceof FormData);
    return response({ evidence_id: "evidence-1", persisted: true });
  }) as typeof fetch;
  await postFormData("/upload", new FormData());
  assert.ok(observedTimeouts.includes(120_000), "original document uploads must use the extended upload deadline");

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    blob: async () => new Blob(["original document"]),
  }) as unknown as Response) as typeof fetch;
  await getBlob("/upload/evidence-1");
  assert.ok(observedTimeouts.filter(value => value === 120_000).length >= 2, "original document downloads must use the extended file-transfer deadline");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    assert.ok(init?.signal instanceof AbortSignal);
    return response({ analysis_id: "analysis-1", extraction_status: "available" }, 201);
  }) as typeof fetch;
  await postJSON("/documents/evidence-1/extract", {}, {}, { timeoutMs: 180_000 });
  assert.ok(observedTimeouts.includes(180_000), "persisted document extraction must be allowed its bounded OCR/extraction window");
  globalThis.setTimeout = originalSetTimeout;

  console.log("API reliability checks passed: safe GET retry, no mutation replay, extended Companion and document transfer deadlines.");
}
void main();
