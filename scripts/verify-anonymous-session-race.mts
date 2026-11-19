import assert from "node:assert/strict";
import {
  getJSON,
  getPersonId,
  markAnonymousSessionRevokedLocally,
  revokeAnonymousSession,
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
function installBrowser(
  store: Store,
  href = "https://solenos.test/workspace",
): void {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: store,
      location: { href, origin: "https://solenos.test" },
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

  // A rejected read can recover from token rotation without changing record scope.
  {
    const store = makeStore();
    installBrowser(store);
    store.setItem("solenos_backend_person_id", "person-server-1");
    store.setItem("solenos_backend_caregiver_id", "caregiver-server-1");
    store.setItem("solenos_anonymous_access_token", "old-server-token");
    store.setItem("solenos_anonymous_session_expires_at", new Date(Date.now() + 90 * 86400000).toISOString());
    let refreshes = 0, reads = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/sessions/refresh") {
        refreshes++;
        assert.equal((init?.headers as Record<string, string>)?.Authorization, "Bearer old-server-token");
        return jsonResponse({
          person_id: "person-server-1", caregiver_id: "caregiver-server-1",
          access_token: "rotated-server-token", token_type: "Bearer",
          expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
          expires_in_seconds: 365 * 86400,
        });
      }
      if (url === "/api/situation") {
        reads++;
        if (reads === 1) return jsonResponse({ detail: "Anonymous session is invalid or expired" }, 401);
        assert.equal((init?.headers as Record<string, string>)?.Authorization, "Bearer rotated-server-token");
        return jsonResponse({ situations: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
    const { getJSON } = await import("../src/api/client");
    await getJSON("/situation");
    assert.equal(refreshes, 1);
    assert.equal(reads, 2);
    assert.equal(store.getItem("solenos_backend_person_id"), "person-server-1");
    assert.equal(store.getItem("solenos_backend_caregiver_id"), "caregiver-server-1");
    assert.equal(store.getItem("solenos_anonymous_access_token"), "rotated-server-token");
  }

  // A deleted workspace cannot mint a new identity from background requests.
  {
    const store = makeStore();
    store.setItem("solenos_anonymous_session_revoked", "revocation-1");
    installBrowser(store);
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return jsonResponse(session());
    }) as typeof fetch;

    await assert.rejects(
      getJSON("/events/person-server-1"),
      /workspace was deleted from this device/i,
    );
    assert.equal(requests, 0, "background reads must not create a replacement identity after deletion");
    assert.equal(store.getItem("solenos_anonymous_session_revoked"), "revocation-1");
  }

  // Explicit Care Record entry remains authorized if the URL is cleaned after
  // bootstrap starts but before the server responds.
  {
    const store = makeStore();
    installBrowser(store, "https://solenos.test/workspace?enter=1");
    // Simulate deletion through the same production path used by the UI. This
    // also invalidates any in-flight bootstrap retained by the test module.
    markAnonymousSessionRevokedLocally();
    let resolveCreate!: (response: Response) => void;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input) === "/api/v1/sessions/anonymous") {
        return new Promise<Response>((resolve) => { resolveCreate = resolve; });
      }
      return jsonResponse({ ok: true });
    }) as typeof fetch;

    const pending = getJSON("/events/person-server-1");
    await Promise.resolve();
    (globalThis.window as unknown as { location: { href: string } }).location.href = "https://solenos.test/workspace";
    resolveCreate(jsonResponse(session()));
    await pending;

    assert.equal(store.getItem("solenos_anonymous_session_revoked"), null, "successful explicit replacement clears the deletion marker");
    assert.equal(store.getItem("solenos_anonymous_access_token"), "server-issued-token");
    assert.equal(store.getItem("solenos_backend_person_id"), "person-server-1");
  }

  // A revoke in another tab while bootstrap is pending must win; the late
  // response cannot repopulate credentials or clear the newer revocation.
  {
    const store = makeStore();
    installBrowser(store);
    let resolveCreate!: (response: Response) => void;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      assert.equal(String(input), "/api/v1/sessions/anonymous");
      return new Promise<Response>((resolve) => { resolveCreate = resolve; });
    }) as typeof fetch;

    const pending = getJSON("/events/person-server-1");
    await Promise.resolve();
    store.setItem("solenos_anonymous_session_revoked", "revocation-from-another-tab");
    resolveCreate(jsonResponse(session()));

    await assert.rejects(pending, /workspace was deleted while access was being restored/i);
    assert.equal(store.getItem("solenos_anonymous_session_revoked"), "revocation-from-another-tab");
    assert.equal(store.getItem("solenos_anonymous_access_token"), null, "late bootstrap must not restore a revoked bearer token");
    assert.equal(store.getItem("solenos_backend_person_id"), null, "late bootstrap must not restore a revoked record identity");
  }


  // Deletion revocation blocks background identity recreation; explicit Care Record entry is required.
  {
    const store = makeStore();
    store.setItem("solenos_anonymous_session_revoked", "revoked-1");
    store.setItem("solenos_anonymous_access_token", "stale-revoked-token");
    store.setItem("solenos_backend_person_id", "stale-person");
    store.setItem("solenos_backend_caregiver_id", "stale-caregiver");
    store.setItem("solenos_anonymous_session_expires_at", new Date(Date.now() + 86400000).toISOString());
    installBrowser(store, "https://solenos.test/start");
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return jsonResponse(session());
    }) as typeof fetch;
    await assert.rejects(
      () => getJSON("/events/person-server-1"),
      /workspace was deleted from this device/i,
    );
    assert.equal(requests, 0, "background reads must not mint a replacement identity after deletion");
    assert.equal(store.getItem("solenos_anonymous_session_revoked"), "revoked-1");
  }

  // Only explicit Care Record entry may clear the revocation and create a fresh session.
  {
    const store = makeStore();
    store.setItem("solenos_anonymous_session_revoked", "revoked-2");
    store.setItem("solenos_anonymous_access_token", "stale-revoked-token");
    store.setItem("solenos_backend_person_id", "stale-person");
    store.setItem("solenos_backend_caregiver_id", "stale-caregiver");
    store.setItem("solenos_anonymous_session_expires_at", new Date(Date.now() + 86400000).toISOString());
    installBrowser(store, "https://solenos.test/workspace?enter=1");
    let sessionCreates = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input) === "/api/v1/sessions/anonymous") {
        sessionCreates += 1;
        return jsonResponse(session());
      }
      return jsonResponse({ ok: true });
    }) as typeof fetch;
    await getJSON("/events/person-server-1");
    assert.equal(sessionCreates, 1);
    assert.equal(store.getItem("solenos_anonymous_session_revoked"), null);
    assert.equal(store.getItem("solenos_anonymous_access_token"), "server-issued-token");
    assert.equal(store.getItem("solenos_backend_person_id"), "person-server-1");
    assert.notEqual(store.getItem("solenos_anonymous_access_token"), "stale-revoked-token");
  }

  // Device cleanup must persist a local tombstone even without server credentials.
  {
    const store = makeStore();
    installBrowser(store);
    markAnonymousSessionRevokedLocally();
    assert.ok(store.getItem("solenos_anonymous_session_revoked"), "local deletion marker must be written");
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return jsonResponse(session());
    }) as typeof fetch;
    await assert.rejects(
      getJSON("/events/person-server-1"),
      /workspace was deleted from this device/i,
    );
    assert.equal(requests, 0, "background access must not create a new session after device cleanup");
  }


  // Clearing a device with no bearer must not create a disposable replacement session.
  {
    const store = makeStore();
    installBrowser(store);
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return jsonResponse(session());
    }) as typeof fetch;
    await revokeAnonymousSession();
    assert.equal(requests, 0, "cleanup without a bearer must not call anonymous session creation");
    assert.ok(store.getItem("solenos_anonymous_session_revoked"));
    assert.equal(store.getItem("solenos_anonymous_access_token"), null);
  }

  console.log("Anonymous session identity race checks passed.");

}
void main();
