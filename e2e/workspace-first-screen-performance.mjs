import assert from "node:assert/strict";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const apiResponses: Array<{ method: string; path: string; status: number }> = [];
const apiRequests: Array<{ method: string; path: string }> = [];
const apiRequestStarts = new Map<string, number>();
const currentCareDurations: number[] = [];

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
  // service. The test uses a fresh server-issued anonymous session and creates
  // no care events, evidence, appointments, handoffs or Companion messages.
  await page.route("**/api/v1/**", async (route) => {
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
    if (url.pathname.includes("/api/v1/")) {
      apiRequestStarts.set(request.url(), Date.now());
      apiRequests.push({ method: request.method(), path: url.pathname });
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(response.url());
    if (!url.pathname.includes("/api/v1/")) return;
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

  const documentsLink = page.locator("#solenos-navigation").getByRole("link", { name: "Documents" });
  await documentsLink.hover(); // route prefetch is intentionally triggered only by user intent
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

  const forbiddenWrites = apiRequests.filter((item) =>
    item.method !== "GET" &&
    !item.path.endsWith("/sessions/anonymous") &&
    !item.path.endsWith("/sessions/refresh")
  );
  assert.deepEqual(forbiddenWrites, [], "first-screen performance test must not write care records");

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
  await context.close();
  await browser.close();
}
