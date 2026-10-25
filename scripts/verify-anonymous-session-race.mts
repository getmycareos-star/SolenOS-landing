import assert from "node:assert/strict";
import {
  getJSON,
  getPersonId,
} from "../src/api/client";

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};
function makeStore(): Store {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
function jsonResponse(value: unknown, status = 200): Response {
  const body = JSON.stringify(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json" : null },
    text: async () => body,
    blob: async () => new Blob([body]),
  } as unknown as Response;
}
function installBrowser(store: Store): void {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: store,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  });
}
function session(expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()) {
  return {
    session_id: "session-real-1",
    person: { id: "person-server-1", name: "Care recipient", date_of_birth: null },
    caregiver: { id: "caregiver-server-1", name: "Caregiver", relationship: "Family" },
    access_token: "server-issued-token",
    token_type: "Bearer" as const,
    expires_at: expiresAt,
    expires_in_seconds: Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  };
}

async function main() {
  // Concurrent first-use API calls must create one scoped session and both use its bearer.
  {
    const store = makeStore();
    installBrowser(store);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let sessionCreates = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "/api/v1/sessions/anonymous") {
        sessionCreates += 1;
        await Promise.resolve();
        return jsonResponse(session());
      }
      return jsonResponse({ ok: true });
    }) as typeof fetch;

    await Promise.all([getJSON("/events/person-server-1"), getJSON("/insights/person-server-1")]);
    assert.equal(sessionCreates, 1, "parallel protected requests must share session bootstrap");
    const protectedCalls = calls.filter((call) => call.url.includes("/events/") || call.url.includes("/insights/"));
    assert.equal(protectedCalls.length, 2);
    assert.ok(protectedCalls.every((call) => (call.init?.headers as Record<string, string>)?.Authorization === "Bearer server-issued-token"));
    assert.equal(getPersonId(), "person-server-1");
  }

  // A legacy record ID must not override the server-issued identity already bound to the bearer token.
  {
    const store = makeStore();
    installBrowser(store);
    store.setItem("solenos_person_id", "legacy-other-person");
    store.setItem("solenos_backend_person_id", "person-server-1");
    store.setItem("solenos_backend_caregiver_id", "caregiver-server-1");
    store.setItem("solenos_anonymous_access_token", "server-issued-token");
    store.setItem("solenos_anonymous_session_expires_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    let request: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = { url: String(input), init };
      return jsonResponse({ ok: true });
    }) as typeof fetch;

    await getJSON("/events/person-server-1");
    assert.equal(getPersonId(), "person-server-1");
    assert.equal((request?.init?.headers as Record<string, string>)?.Authorization, "Bearer server-issued-token");
  }

  // A legacy ID without its bearer capability fails closed; it must not silently create a different record.
  {
    const store = makeStore();
    installBrowser(store);
    store.setItem("solenos_person_id", "legacy-other-person");
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse(session());
    }) as typeof fetch;
    await assert.rejects(getJSON("/events/legacy-other-person"), /cannot safely restore that record/i);
    assert.equal(calls, 0, "no protected request or replacement session may be sent for a legacy-only ID");
  }

  // Public time utilities remain usable before a caregiver starts a care session.
  {
    const store = makeStore();
    installBrowser(store);
    let request: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = { url: String(input), init };
      return jsonResponse({ now: "test-only-time-response" });
    }) as typeof fetch;

    await getJSON("/time/now");
    assert.equal(request?.url, "/api/v1/time/now");
    assert.equal(request?.init?.headers && (request.init.headers as Record<string, string>).Authorization, undefined);
  }

  console.log("Anonymous session identity race checks passed.");
}
void main();
