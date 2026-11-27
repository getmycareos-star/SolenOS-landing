import assert from "node:assert/strict";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const performanceSessionResponse = await fetch(new URL("/api/v1/sessions/anonymous", backend), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Synthetic first-screen performance caregiver",
    caregiver_name: "Synthetic performance test caregiver",
  }),
});
assert.equal(performanceSessionResponse.status, 201, "the performance run needs a fresh server-issued session");
const performanceSession = await performanceSessionResponse.json();
const seedEventResponse = await fetch(new URL("/api/v1/daily/log", backend), {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${performanceSession.access_token}`,
  },
  body: JSON.stringify({
    person_id: performanceSession.person.id,
    caregiver_id: performanceSession.caregiver.id,
    capture_idempotency_key: `first-screen-performance-${Date.now()}`,
    observation: "Synthetic performance fixture: the caregiver recorded one routine update.",
    source: "workspace_first_screen_performance_ci",
  }),
});
assert.ok([200, 201].includes(seedEventResponse.status), "the returning-caregiver fixture must persist before timing begins");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript((identity) => {
  localStorage.setItem("solenos_anonymous_access_token", identity.token);
  localStorage.setItem("solenos_backend_person_id", identity.personId);
  localStorage.setItem("solenos_backend_caregiver_id", identity.caregiverId);
  localStorage.setItem("solenos_anonymous_session_expires_at", identity.expiresAt);
}, {
  token: performanceSession.access_token,
  personId: performanceSession.person.id,
  caregiverId: performanceSession.caregiver.id,
  expiresAt: performanceSession.expires_at,
});
const page = await context.newPage();
const apiResponses = [];
const apiRequests = [];
const apiRequestStarts = new Map();
const currentCareDurations = [];

try {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
    connectionType: "cellular4g",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  // Route same-origin frontend requests to the isolated FastAPI + PostgreSQL
  // service. A single synthetic care event is seeded before timing so the
  // browser measures the returning-caregiver current-care screen. The browser
  // journey itself performs no care-record writes.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const target = new URL(requestUrl.pathname + requestUrl.search, backend);
    const headers = { ...request.headers() };
    delete headers.origin;
    delete headers.host;
    const response = await route.fetch({ url: target.toString(), headers });
    await route.fulfill({ response });
  });

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      apiRequestStarts.set(request.url(), Date.now());
      apiRequests.push({ method: request.method(), path: url.pathname });
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    apiResponses.push({ method: request.method(), path: url.pathname, status: response.status() });
    const started = apiRequestStarts.get(request.url());
    if (started && url.pathname.endsWith("/care-continuity/current-care")) {
      currentCareDurations.push(Date.now() - started);
    }
  });

  const firstCareReady = async () => {
    await page.waitForFunction(
      () => performance.getEntriesByName("solenos.workspace.first-care-ready", "measure").length > 0,
      null,
      { timeout: 30_000 },
    );
    return page.evaluate(() => {
      const entries = performance.getEntriesByName("solenos.workspace.first-care-ready", "measure");
      const navigation = performance.getEntriesByType("navigation")[0];
      return {
        component_load_ms: entries[entries.length - 1]?.duration ?? null,
        navigation_to_first_care_ms: navigation ? performance.now() - navigation.startTime : null,
      };
    });
  };

  await page.goto(new URL("/workspace?enter=1", frontend).toString(), { waitUntil: "domcontentloaded" });
  const coldMetrics = await firstCareReady();

  // Reload in the same browser context: this retains the server-issued session
  // and browser cache, giving a returning-session measurement.
  await page.reload({ waitUntil: "domcontentloaded" });
  const returningMetrics = await firstCareReady();

  const menuButton = page.getByRole("button", { name: "Open navigation" });
  const menuStartedAt = Date.now();
  await menuButton.click();
  await page.getByRole("navigation", { name: "Primary navigation" }).waitFor({ state: "visible" });
  const mobileMenuOpenMs = Date.now() - menuStartedAt;

  const careInformationLink = page.locator("#solenos-navigation")
    .getByRole("link", { name: "Care information", exact: true });
  await careInformationLink.click();
  await page.waitForURL(/\/workspace\/care-continuity(?:\?|$)/);
  const documentsLink = page.locator(".care-information-directory")
    .getByRole("link", { name: "Documents", exact: true });
  assert.equal(await documentsLink.getAttribute("aria-describedby"), "care-information-documents-description",
    "Documents navigation must retain its explanatory accessible description");
  try {
    await page.getByRole("heading", { name: "Explore care information", exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });
    await documentsLink.waitFor({ state: "visible", timeout: 10_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      headings: [...document.querySelectorAll("h1,h2,h3")].map((node) => node.textContent?.trim()).filter(Boolean),
      visibleText: document.body.innerText.slice(0, 2500),
      workspaceRoot: Boolean(document.querySelector(".solenos-chat-app")),
      directoryExists: Boolean(document.querySelector(".care-information-directory")),
      archivedFlag: localStorage.getItem("solenos_workspace_archived"),
    }));
    await page.screenshot({ path: "/tmp/solenos-care-information-navigation-failure.png", fullPage: true });
    throw new Error(`Care information directory did not become visible: ${JSON.stringify(diagnostics)}; ${String(error)}`);
  }
  const routeStartedAt = Date.now();
  await documentsLink.click();
  await page.waitForURL(/\/workspace\/documents(?:\?|$)/);
  await page.waitForFunction(
    () => performance.getEntriesByName("solenos.workspace.navigation-to-route-mounted", "measure").length > 0,
    null,
    { timeout: 15_000 },
  );
  const navigationToDocumentsMs = await page.evaluate(() => {
    const entries = performance.getEntriesByName("solenos.workspace.navigation-to-route-mounted", "measure");
    return entries[entries.length - 1]?.duration ?? null;
  });

  const currentCareReads = apiResponses.filter((item) => item.path.endsWith("/care-continuity/current-care"));
  assert.ok(coldMetrics.component_load_ms !== null && coldMetrics.component_load_ms >= 0, "cold first-care readiness mark must be emitted");
  assert.ok(coldMetrics.navigation_to_first_care_ms !== null && coldMetrics.navigation_to_first_care_ms >= 0, "cold navigation-to-care readiness must be measured");
  assert.ok(returningMetrics.component_load_ms !== null && returningMetrics.component_load_ms >= 0, "returning first-care readiness mark must be emitted");
  assert.ok(returningMetrics.navigation_to_first_care_ms !== null && returningMetrics.navigation_to_first_care_ms >= 0, "returning navigation-to-care readiness must be measured");
  assert.ok(currentCareReads.length >= 2, "cold and returning sessions must each retrieve the person-scoped current-care projection");
  assert.ok(currentCareReads.every((item) => item.status === 200), JSON.stringify(currentCareReads));
  assert.ok(currentCareDurations.length >= 2, "both current-care API request durations must be measured");
  assert.ok(mobileMenuOpenMs >= 0, "mobile menu interaction must be measured");
  assert.ok(navigationToDocumentsMs !== null && navigationToDocumentsMs >= 0, "navigation-to-route mount must be measured");

  const nonSessionWrites = apiRequests.filter((item) =>
    item.method !== "GET" &&
    !item.path.endsWith("/sessions/anonymous") &&
    !item.path.endsWith("/sessions/refresh")
  );
  // First-use orientation acknowledgement is profile metadata, not a care
  // record mutation. No Daily Care, document, LCR, appointment or handoff write
  // is permitted during this read-only performance measurement.
  const careRecordWrites = nonSessionWrites.filter((item) =>
    !item.path.endsWith("/care-profile/orientation-complete")
  );
  assert.deepEqual(careRecordWrites, [], "first-screen performance test must not write care records");
  assert.ok(nonSessionWrites.every((item) => item.path.endsWith("/care-profile/orientation-complete")),
    "only the non-care-record first-use orientation acknowledgement may be written");

  console.log("WORKSPACE_FIRST_SCREEN_PERFORMANCE=" + JSON.stringify({
    viewport: "390x844",
    network: "4G emulation, 150ms RTT, 1.6Mbps down, 750Kbps up",
    cpuThrottle: "4x",
    cold_component_load_ms: Math.round(coldMetrics.component_load_ms),
    cold_navigation_to_first_care_ms: Math.round(coldMetrics.navigation_to_first_care_ms),
    returning_component_load_ms: Math.round(returningMetrics.component_load_ms),
    returning_navigation_to_first_care_ms: Math.round(returningMetrics.navigation_to_first_care_ms),
    current_care_api_request_ms: currentCareDurations,
    mobile_menu_open_ms: mobileMenuOpenMs,
    navigation_to_documents_route_ms: Math.round(navigationToDocumentsMs),
    api_statuses: apiResponses,
    care_record_writes: 0,
    database_scope: "disposable_postgresql_ci_only",
  }));
} finally {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
  await browser.close();
}
