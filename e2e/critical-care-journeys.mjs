import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const requireLiveQwen = process.env.SOLENOS_REQUIRE_LIVE_QWEN === "1";
const browser = await chromium.launch({ headless: true });
const password = "CI-critical-journey-passphrase-2026!";
const results = [];
let dailyScenarioEventIdsByReport = {};
let dailyScenarioEvidenceIdsByReport = {};
const scenarioReports = [
  "Mum slept poorly last night and seemed more unsettled this morning.",
  "Mum barely touched her lunch today. She drank some water, though.",
  "I think the doctor changed Mum's medication yesterday, but I can't remember the new dose.",
  "Mum was calmer this evening. She ate a little more at dinner and is now resting.",
];

async function request(path, { token, method = "GET", body, form, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders, ...(token ? { authorization: `Bearer ${token}` } : {}) };
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(new URL(path, backend), {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  return { status: response.status, payload, response };
}

async function newSession(label) {
  const created = await request("/api/v1/sessions/anonymous", {
    method: "POST",
    body: { name: `E2E ${label}`, caregiver_name: "Browser integration caregiver" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.payload));
  return created.payload;
}

function auth(session) {
  return {
    token: session.access_token,
    personId: session.person.id,
    caregiverId: session.caregiver.id,
    headers: { authorization: `Bearer ${session.access_token}` },
  };
}

async function createBrowserPage(session, path, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((identity) => {
    // Seed only the first document in this browser context. Re-seeding on every
    // navigation would silently restore credentials after the user deletes them.
    if (sessionStorage.getItem("solenos_e2e_identity_seeded") === "1") return;
    sessionStorage.setItem("solenos_e2e_identity_seeded", "1");
    localStorage.setItem("solenos_anonymous_access_token", identity.token);
    localStorage.setItem("solenos_backend_person_id", identity.personId);
    localStorage.setItem("solenos_backend_caregiver_id", identity.caregiverId);
    localStorage.setItem("solenos_anonymous_session_expires_at", identity.expiresAt);
  }, {
    token: session.access_token,
    personId: session.person.id,
    caregiverId: session.caregiver.id,
    expiresAt: session.expires_at,
  });
  const page = await context.newPage();
  const observed = [];
  page.on("response", (response) => { const url = new URL(response.url()); if (url.pathname.startsWith("/api/")) observed.push({ path: url.pathname, status: response.status() }); });
  await page.route("**/api/**", async (route) => {
    try {
      const source = new URL(route.request().url());
      const target = new URL(source.pathname + source.search, backend);
      const headers = { ...route.request().headers() };
      delete headers.origin;
      let response;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await route.fetch({ url: target.toString(), headers, timeout: 210000 });
          break;
        } catch (error) {
          const message = String(error?.message || error);
          const transientConnectionFailure = /ECONNRESET|ECONNREFUSED|socket hang up/i.test(message);
          if (!transientConnectionFailure || attempt === 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        }
      }
      if (!response) throw new Error("Backend proxy did not return a response after transient retries");
      await route.fulfill({ response });
    } catch (error) {
      // Closing a test context may cancel API requests before Playwright reports
      // page.isClosed(). Ignore only that explicit target-closed teardown error.
      const message = String(error?.message || error);
      const targetClosedDuringTeardown = /Target page, context or browser has been closed|TargetClosedError/.test(message);
      if (page.isClosed() || context.pages().length === 0 || targetClosedDuringTeardown) return;
      throw error;
    }
  });
  await page.goto(new URL(path, frontend).toString(), { waitUntil: "domcontentloaded" });
  return { context, page, observed };
}

async function browserPageConsumes(page, pathname, observed) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  return observed.filter((item) => item.path.includes(pathname));
}

async function verifyMobile(page) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport + 2,
    `mobile horizontal overflow: ${JSON.stringify(dimensions)}`,
  );
}

async function record(name, work) {
  await work();
  results.push(name);
  process.stdout.write(`PASS ${name}\n`);
}

// 1. First caregiver session: the browser, not a seeded fixture, creates the identity.
await record("01 first caregiver session", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route("**/api/**", async (route) => {
    const source = new URL(route.request().url());
    const target = new URL(source.pathname + source.search, backend);
    const headers = { ...route.request().headers() };
    delete headers.origin;
    try {
      const response = await route.fetch({ url: target.toString(), headers, timeout: 210000 });
      if (page.isClosed()) return;
      await route.fulfill({ response });
    } catch (error) {
      if (page.isClosed()) return;
      throw error;
    }
  });
  await page.goto(new URL("/workspace/daily-care", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    localStorage.getItem("solenos_anonymous_access_token") &&
    localStorage.getItem("solenos_backend_person_id") &&
    localStorage.getItem("solenos_backend_caregiver_id")
  ), { timeout: 25_000 });
  const identity = await page.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  const person = await request(`/api/v1/persons/${encodeURIComponent(identity.personId)}`, { token: identity.token });
  assert.equal(person.status, 200, JSON.stringify(person.payload));
  assert.equal(person.payload.id, identity.personId);
  assert.ok(identity.caregiverId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction((expected) =>
    localStorage.getItem("solenos_backend_person_id") === expected.personId &&
    localStorage.getItem("solenos_backend_caregiver_id") === expected.caregiverId &&
    Boolean(localStorage.getItem("solenos_anonymous_access_token")),
    { personId: identity.personId, caregiverId: identity.caregiverId },
    { timeout: 15_000 },
  );
  await verifyMobile(page);
  await context.close();
});

// Shared persisted session for the remaining independently scoped journey checks.
let session = await newSession("critical journey matrix");
const identity = auth(session);
const unique = (prefix) => `${prefix}-${randomUUID()}`;

await record("01b visible Follow-ups button and mobile navigation", async () => {
  const { context, page } = await createBrowserPage(
    session,
    "/workspace/daily-care",
    { width: 390, height: 844 },
  );
  const viewFollowups = page.getByRole("button", { name: "Open Follow-ups", exact: true });
  await viewFollowups.waitFor({ state: "visible", timeout: 20_000 });
  await viewFollowups.click();
  await page.waitForURL("**/workspace/open-loops", { timeout: 20_000 });
  await page.getByRole("heading", { name: "Follow-ups", exact: true })
    .waitFor({ state: "visible", timeout: 20_000 });
  await verifyMobile(page);
  const navigationToggle = page.getByRole("button", { name: "Open navigation", exact: true });
  await navigationToggle.click();
  await page.waitForFunction(() =>
    document.querySelector(".solenos-sidebar-toggle")?.getAttribute("aria-expanded") === "true" &&
    document.querySelector(".solenos-chat-sidebar-host")?.classList.contains("is-sidebar-open") === true
  , undefined, { timeout: 5_000 });
  const followUpsNavigationLink = page.locator("#solenos-navigation")
    .getByRole("link", { name: /Follow-ups/ });
  await followUpsNavigationLink.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(await followUpsNavigationLink.getAttribute("href"), "/workspace/open-loops");
  await context.close();
});

const shareSession = await newSession("share summary export");
const shareIdentity = auth(shareSession);
const shareSeed = await request("/api/v1/daily/log", {
  token: shareIdentity.token,
  method: "POST",
  body: {
    person_id: shareIdentity.personId,
    caregiver_id: shareIdentity.caregiverId,
    capture_idempotency_key: unique("share-summary-seed"),
    observation: "Caregiver reports that Mum slept poorly last night and seemed unsettled this morning.",
    source: "critical_care_journey_share_seed",
  },
});
assert.ok([200, 201].includes(shareSeed.status), JSON.stringify(shareSeed.payload));

await record("01c workspace links, browser back, More menu and account form validation", async () => {
  const { context, page, observed } = await createBrowserPage(
    shareSession,
    "/workspace",
    { width: 390, height: 844 },
  );
  await page.getByRole("heading", { name: "Care Record", exact: true }).waitFor({ timeout: 20_000 });
  await verifyMobile(page);

  const moreTrigger = page.getByRole("button", { name: "More care record actions", exact: true });
  await moreTrigger.click();
  const menu = page.getByRole("menu", { name: "Care record actions", exact: true });
  await menu.waitFor({ state: "visible", timeout: 5_000 });
  const menuBounds = await menu.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.ok(menuBounds, "More menu must have a visible position");
  assert.ok(menuBounds.x >= 0 && menuBounds.y >= 0 &&
    menuBounds.x + menuBounds.width <= viewport.width &&
    menuBounds.y + menuBounds.height <= viewport.height,
    `More menu must remain inside the mobile viewport: ${JSON.stringify({ menuBounds, viewport })}`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "menuitem",
    "opening More menu must move keyboard focus into the menu");
  await page.keyboard.press("Escape");
  assert.equal(await moreTrigger.getAttribute("aria-expanded"), "false",
    "Escape must close the More menu");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    "More care record actions", "closing More menu must restore focus to its trigger");

  const openMoreMenu = async () => {
    await moreTrigger.click();
    const opened = page.getByRole("menu", { name: "Care record actions", exact: true });
    await opened.waitFor({ state: "visible", timeout: 5_000 });
    return opened;
  };

  let actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Pin", exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem("solenos_workspace_pinned")), "1",
    "Pin must persist on this device");
  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Unpin", exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem("solenos_workspace_pinned")), "0",
    "Unpin must clear the saved device preference");

  actionMenu = await openMoreMenu();
  page.once("dialog", (dialog) => { void dialog.accept(); });
  await actionMenu.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await page.getByRole("heading", { name: "Workspace archived", exact: true }).waitFor({ timeout: 10_000 });
  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Restore", exact: true }).click();
  await page.getByRole("heading", { name: "Care Record", exact: true }).waitFor({ timeout: 10_000 });

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "View record details", exact: true }).click();
  const detailsDialog = page.getByRole("dialog");
  await detailsDialog.getByRole("heading", { name: "Care record details", exact: true }).waitFor({ timeout: 10_000 });
  await detailsDialog.getByRole("button", { name: "Close care record details", exact: true }).click();
  await detailsDialog.waitFor({ state: "detached", timeout: 10_000 });

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Edit record", exact: true }).click();
  await page.waitForURL("**/workspace/daily-care", { timeout: 15_000 });
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL("**/workspace", { timeout: 15_000 });

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Share care summary", exact: true }).click();
  await page.getByRole("heading", { name: "Share care summary", exact: true }).waitFor({ timeout: 10_000 });
  await page.locator(".share-panel-close").click();

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Download / Export", exact: true }).click();
  await page.getByRole("heading", { name: "Download / Export care summary", exact: true }).waitFor({ timeout: 10_000 });
  const exportPanel = page.locator(".share-care-summary-panel");
  const limitedReadiness = exportPanel.getByRole("button", { name: "Continue anyway", exact: true });
  const audiencePrompt = exportPanel.getByText("Who should this summary be prepared for?", { exact: true });
  const readinessState = await Promise.race([
    limitedReadiness.waitFor({ state: "visible", timeout: 10_000 }).then(() => "limited"),
    audiencePrompt.waitFor({ state: "visible", timeout: 10_000 }).then(() => "audience"),
  ]);
  if (readinessState === "limited") {
    await limitedReadiness.click();
    await audiencePrompt.waitFor({ timeout: 10_000 });
  }
  const shareContextDiagnostic = await page.evaluate(() => ({
    tokenPresent: Boolean(localStorage.getItem("solenos_anonymous_access_token")),
    personPresent: Boolean(localStorage.getItem("solenos_backend_person_id")),
    caregiverPresent: Boolean(localStorage.getItem("solenos_backend_caregiver_id")),
    careSessionIdPresent: Boolean(localStorage.getItem("solenos_care_session_id")),
    careSessionId: localStorage.getItem("solenos_care_session_id"),
  }));
  const situationDiagnostic = await request(
    `/api/situation?caregiver_id=${encodeURIComponent(shareSession.caregiver.id)}&care_session_id=${encodeURIComponent(shareContextDiagnostic.careSessionId ?? "e2e-share")}`,
    { token: shareSession.access_token },
  );
  console.log("SHARE_EXPORT_DIAGNOSTIC", JSON.stringify({
    tokenPresent: shareContextDiagnostic.tokenPresent,
    personPresent: shareContextDiagnostic.personPresent,
    caregiverPresent: shareContextDiagnostic.caregiverPresent,
    careSessionIdPresent: shareContextDiagnostic.careSessionIdPresent,
    status: situationDiagnostic.status,
    responseKeys: Object.keys(situationDiagnostic.payload ?? {}),
    events: Array.isArray(situationDiagnostic.payload?.events) ? situationDiagnostic.payload.events.length : null,
    contextEvents: Array.isArray(situationDiagnostic.payload?.context?.events) ? situationDiagnostic.payload.context.events.length : null,
    totalEvents: situationDiagnostic.payload?.total_events ?? null,
    observations: Array.isArray(situationDiagnostic.payload?.active_care_situation?.observations)
      ? situationDiagnostic.payload.active_care_situation.observations.length : null,
  }));
  assert.ok((situationDiagnostic.payload?.total_events ?? situationDiagnostic.payload?.events?.length ?? 0) > 0,
    "the seeded caregiver report must be visible to the share-summary readiness check");
  console.log("SHARE_EXPORT_PANEL_TEXT", (await exportPanel.innerText()).slice(0, 1200));
  console.log("SHARE_NETWORK_REQUESTS", JSON.stringify(observed.filter((item) => item.path.includes("situation"))));
  await exportPanel.getByRole("radio", { name: /Doctor \/ clinician/ }).click();
  await exportPanel.getByText("Prepared for: Doctor / clinician", { exact: true }).waitFor({ timeout: 10_000 });
  await exportPanel.getByRole("button", { name: "Continue", exact: true }).click();
  await exportPanel.getByText("Review the summary, then download it or save it as a PDF.", { exact: true })
    .waitFor({ timeout: 10_000 });
  const summaryDownloadPromise = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "Download summary (.txt)", exact: true }).click();
  const summaryDownload = await summaryDownloadPromise;
  assert.match(summaryDownload.suggestedFilename(), /^care-summary-\d{4}-\d{2}-\d{2}\.txt$/,
    "the export action must create a dated care summary file");
  const summaryPath = await summaryDownload.path();
  const summaryText = await readFile(summaryPath, "utf8");
  assert.ok(summaryText.length > 100, "the downloaded summary must contain actual reviewed content");
  assert.match(summaryText, /Prepared for: Doctor \/ clinician/,
    "the downloaded file must retain its selected recipient");
  await exportPanel.getByText("Summary downloaded.", { exact: true }).waitFor({ timeout: 10_000 });
  await page.locator(".share-panel-close").click();

  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: frontend });
  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Share care summary", exact: true }).click();
  const sharePanel = page.locator(".share-care-summary-panel");
  await sharePanel.getByRole("heading", { name: "Share care summary", exact: true }).waitFor({ timeout: 10_000 });
  const shareLimitedReadiness = sharePanel.getByRole("button", { name: "Continue anyway", exact: true });
  if (await shareLimitedReadiness.isVisible().catch(() => false)) {
    await shareLimitedReadiness.click();
  }
  await sharePanel.getByRole("radio", { name: /^Family/ }).click();
  await sharePanel.getByText("Prepared for: Family", { exact: true }).waitFor({ timeout: 10_000 });
  await sharePanel.getByRole("button", { name: "Continue", exact: true }).click();
  await sharePanel.locator(".share-format-option").filter({ hasText: "Copy text" }).click();
  await sharePanel.locator(".share-confirm-actions")
    .getByRole("button", { name: "Share", exact: true }).click();
  await sharePanel.getByText("Summary copied to clipboard.", { exact: true }).waitFor({ timeout: 10_000 });
  const copiedSummary = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copiedSummary, /Prepared for: Family/,
    "the share action must place the reviewed family summary on the clipboard");
  assert.ok(copiedSummary.length > 100,
    "the copied summary must contain actual care information");
  await page.locator(".share-panel-close").click();

  await page.evaluate(() => {
    const installEvent = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperty(window, "__solenosInstallPromptCalled", { configurable: true, value: false, writable: true });
    Object.defineProperties(installEvent, {
      prompt: { value: async () => { window.__solenosInstallPromptCalled = true; } },
      userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) },
    });
    window.dispatchEvent(installEvent);
  });
  await page.waitForTimeout(100);
  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Add to Home", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__solenosInstallPromptCalled), true,
    "Add to Home must invoke the browser install prompt when one is available");
  await page.waitForTimeout(100);

  const fallbackDialogPromise = page.waitForEvent("dialog");
  actionMenu = await openMoreMenu();
  const fallbackClick = actionMenu.getByRole("menuitem", { name: "Add to Home", exact: true }).click();
  const fallbackDialog = await fallbackDialogPromise;
  assert.match(fallbackDialog.message(), /iPhone or iPad|Android|Desktop/,
    "Add to Home must explain the manual steps when the browser has no install prompt");
  await fallbackDialog.accept();
  await fallbackClick;

  const navToggle = page.getByRole("button", { name: "Open navigation", exact: true });
  await navToggle.click();
  await page.waitForFunction(() =>
    document.querySelector(".solenos-sidebar-toggle")?.getAttribute("aria-expanded") === "true" &&
    document.querySelector(".solenos-chat-sidebar-host")?.classList.contains("is-sidebar-open") === true,
    undefined,
    { timeout: 5_000 },
  );
  const navigation = page.locator("#solenos-navigation");
  const links = await navigation.getByRole("link").evaluateAll((items) =>
    items.map((item) => item.getAttribute("href")).filter(Boolean),
  );
  const expectedRoutes = [
    "/workspace",
    "/workspace/daily-care",
    "/workspace/open-loops",
    "/workspace/timeline",
    "/workspace/documents",
    "/workspace/appointments",
    "/workspace/handoffs",
    "/workspace/companion",
    "/workspace/settings",
  ];
  for (const route of expectedRoutes) {
    assert.ok(links.includes(route), `primary navigation is missing ${route}`);
  }
  await navigation.getByRole("link", { name: /Documents/ }).click();
  await page.waitForURL("**/workspace/documents", { timeout: 15_000 });
  await page.getByRole("heading", { name: "Documents", exact: true }).waitFor({ timeout: 15_000 });
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL("**/workspace", { timeout: 15_000 });
  await page.getByRole("heading", { name: "Care Record", exact: true }).waitFor({ timeout: 15_000 });
  await verifyMobile(page);

  await page.goto(new URL("/workspace/settings", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Account access", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const email = page.locator("#account-email");
  const password = page.locator("#account-password");
  const accountForm = email.locator("xpath=ancestor::form");
  const accountPosts = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/accounts") {
      accountPosts.push(request.url());
    }
  });
  await email.fill("not-an-email");
  await password.fill("short");
  assert.equal(await email.evaluate((element) => element.validity.typeMismatch), true,
    "account form must reject an invalid email address");
  assert.equal(await password.evaluate((element) => element.validity.tooShort), true,
    "account form must reject passwords shorter than 12 characters");
  assert.equal(await accountForm.evaluate((form) => form.checkValidity()), false,
    "invalid account details must not pass browser form validation");
  await accountForm.getByRole("button", { name: "Create account", exact: true }).click();
  assert.equal(accountPosts.length, 0, "invalid account details must not be submitted to the backend");
  await email.fill("browser-form-validation@example.test");
  await password.fill("valid-test-passphrase-2026");
  assert.equal(await accountForm.evaluate((form) => form.checkValidity()), true,
    "a correctly formatted email and 12+ character password must pass browser validation");
  await context.close();

  // Test local workspace deletion with a disposable identity, never the shared
  // caregiver fixture used by the remaining acceptance journeys.
  const disposableSession = await newSession("more-menu local deletion");
  const disposableIdentity = auth(disposableSession);
  const disposable = await createBrowserPage(
    disposableSession,
    "/workspace",
    { width: 390, height: 844 },
  );
  const identityBeforeDeletion = await disposable.page.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.deepEqual(identityBeforeDeletion, {
    token: disposableIdentity.token,
    personId: disposableIdentity.personId,
    caregiverId: disposableIdentity.caregiverId,
  }, "the disposable browser must start with its own identity before deletion");
  const deletionRequests = [];
  disposable.page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && request.method() === "DELETE") {
      deletionRequests.push(request.url());
    }
  });
  // Capture storage at the first /start document script boundary. The start
  // route may legitimately create a fresh anonymous session after deletion;
  // inspecting storage after hydration would observe that new session rather
  // than the cleared state produced by the delete action.
  await disposable.page.addInitScript(() => {
    if (window.location.pathname === "/start") {
      const keys = [
        "solenos_anonymous_access_token",
        "solenos_backend_person_id",
        "solenos_backend_caregiver_id",
        "solenos_anonymous_session_expires_at",
        "solenos_person_id",
      ];
      const values = Object.fromEntries(
        keys.map((key) => [key, window.localStorage.getItem(key)]),
      );
      window.__solenosWorkspaceDeleteSnapshot = {
        token: values.solenos_anonymous_access_token,
        personId: values.solenos_backend_person_id,
        caregiverId: values.solenos_backend_caregiver_id,
        expiresAt: values.solenos_anonymous_session_expires_at,
        legacyPersonId: values.solenos_person_id,
      };
    }
  });
  const deleteMenu = await disposable.page.getByRole("button", {
    name: "More care record actions", exact: true,
  }).click().then(() => disposable.page.getByRole("menu", { name: "Care record actions", exact: true }));
  await deleteMenu.waitFor({ state: "visible", timeout: 5_000 });
  const deleteDialogPromise = disposable.page.waitForEvent("dialog");
  const deleteClick = deleteMenu.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const deleteDialog = await deleteDialogPromise;
  assert.match(deleteDialog.message(), /does not delete care information already saved in SolenOS/i,
    "workspace deletion must distinguish local browser data from saved care information");
  await deleteDialog.accept();
  await deleteClick;
  await disposable.page.waitForURL("**/start", { timeout: 15_000 });
  const clearedLocalData = await disposable.page.evaluate(() =>
    window.__solenosWorkspaceDeleteSnapshot ?? null
  );
  assert.ok(clearedLocalData, "the /start document must capture local identity before application bootstrap");
  assert.deepEqual(clearedLocalData, {
    token: null,
    personId: null,
    caregiverId: null,
    expiresAt: null,
    legacyPersonId: null,
  }, "workspace deletion must clear current and legacy browser identity data");
  assert.equal(deletionRequests.length, 0,
    "workspace deletion must not call an endpoint that deletes saved care information");
  const revokedSession = await request(
    `/api/v1/persons/${encodeURIComponent(disposableIdentity.personId)}`,
    { token: disposableIdentity.token },
  );
  assert.equal(revokedSession.status, 401,
    "the anonymous browser session must be revoked after local workspace deletion");
  await disposable.context.close();
});

await record("01d secondary routes and reminder actions persist through reload", async () => {
  const { context, page } = await createBrowserPage(
    session,
    "/workspace/reminders",
    { width: 390, height: 844 },
  );

  for (const [route, expectedPath, expectedHash] of [
    ["/workspace/community", "/workspace", ""],
    ["/workspace/continuity", "/workspace", ""],
    ["/workspace/record", "/workspace", ""],
    ["/workspace/notifications", "/workspace/settings", "#settings-notifications"],
  ]) {
    await page.goto(new URL(route, frontend).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) =>
      url.pathname === expectedPath && url.hash === expectedHash,
      { timeout: 15_000 },
    );
  }

  await page.goto(new URL("/workspace/reminders", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Care reminders", exact: true }).waitFor({ timeout: 15_000 });
  await verifyMobile(page);

  const form = page.locator("form.care-reminder-form");
  const titleInput = form.getByLabel("What needs following up?");
  const dueInput = form.getByLabel("Due date and time");
  const noteInput = form.getByLabel("Context (optional)");
  const saveButton = form.getByRole("button", { name: "Save reminder", exact: true });
  assert.equal(await titleInput.inputValue(), "");
  assert.equal(await saveButton.isDisabled(), true,
    "an empty reminder must not be submitted");

  const firstTitle = unique("Browser reminder — appointment follow-up");
  await titleInput.fill(firstTitle);
  await noteInput.fill("Check the clinic's appointment confirmation.");
  assert.ok(await dueInput.inputValue(),
    "the reminder form must provide a valid default due date");
  await saveButton.click();
  await page.getByRole("status").filter({ hasText: "Reminder saved." }).waitFor({ timeout: 15_000 });
  let firstItem = page.locator(".care-reminder-item").filter({ hasText: firstTitle });
  await firstItem.waitFor({ timeout: 15_000 });

  const persistedAfterCreate = await request(
    `/api/v1/reminders/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(persistedAfterCreate.status, 200, JSON.stringify(persistedAfterCreate.payload));
  let firstSaved = persistedAfterCreate.payload.find((item) => item.title === firstTitle);
  assert.ok(firstSaved, "the reminder must be saved by the backend");
  assert.equal(firstSaved.status, "open");
  assert.equal(firstSaved.note, "Check the clinic's appointment confirmation.");
  assert.equal(firstSaved.snooze_count, 0);

  await firstItem.getByRole("button", { name: "Snooze 1 hour", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Reminder moved one hour later." }).waitFor({ timeout: 15_000 });
  const persistedAfterSnooze = await request(
    `/api/v1/reminders/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(persistedAfterSnooze.status, 200, JSON.stringify(persistedAfterSnooze.payload));
  firstSaved = persistedAfterSnooze.payload.find((item) => item.id === firstSaved.id);
  assert.equal(firstSaved.status, "open", "snoozing must not complete a reminder");
  assert.equal(firstSaved.snooze_count, 1, "snooze count must be persisted");
  assert.ok(firstSaved.snoozed_at, "snooze time must be persisted");

  firstItem = page.locator(".care-reminder-item").filter({ hasText: firstTitle });
  await firstItem.getByRole("button", { name: "Mark complete", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Reminder marked complete." }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Show").selectOption("completed");
  firstItem = page.locator(".care-reminder-item").filter({ hasText: firstTitle });
  await firstItem.waitFor({ timeout: 15_000 });
  const completed = await request(
    `/api/v1/reminders/${encodeURIComponent(identity.personId)}?status=completed`,
    { token: identity.token },
  );
  assert.equal(completed.status, 200, JSON.stringify(completed.payload));
  assert.equal(completed.payload.find((item) => item.id === firstSaved.id)?.status, "completed");

  await page.getByLabel("Show").selectOption("open");
  const secondTitle = unique("Browser reminder — cancel test");
  await titleInput.fill(secondTitle);
  await noteInput.fill("This reminder will be cancelled in the test.");
  await saveButton.click();
  await page.getByRole("status").filter({ hasText: "Reminder saved." }).waitFor({ timeout: 15_000 });
  const secondItem = page.locator(".care-reminder-item").filter({ hasText: secondTitle });
  await secondItem.waitFor({ timeout: 15_000 });
  await secondItem.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Reminder cancelled." }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Show").selectOption("cancelled");
  await page.locator(".care-reminder-item").filter({ hasText: secondTitle }).waitFor({ timeout: 15_000 });
  const cancelled = await request(
    `/api/v1/reminders/${encodeURIComponent(identity.personId)}?status=cancelled`,
    { token: identity.token },
  );
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.payload));
  assert.ok(cancelled.payload.some((item) => item.title === secondTitle && item.status === "cancelled"));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Care reminders", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Show").selectOption("cancelled");
  await page.locator(".care-reminder-item").filter({ hasText: secondTitle }).waitFor({ timeout: 15_000 });
  await page.getByRole("link", { name: "Back to Care Record", exact: true }).click();
  await page.waitForURL("**/workspace", { timeout: 15_000 });
  await context.close();
});

// 2. Daily Capture: write, idempotent replay, invalid payload, expired bearer, then retrieve.
let dailyCaptureEventId;
await record("02 Daily Capture", async () => {
  const key = unique("daily-capture");
  const payload = {
    person_id: identity.personId,
    caregiver_id: identity.caregiverId,
    capture_idempotency_key: key,
    observation: "Caregiver reports restless sleep and three overnight awakenings.",
    source: "critical_care_journey_e2e",
  };
  const saved = await request("/api/v1/daily/log", { token: identity.token, method: "POST", body: payload });
  assert.ok([200, 201].includes(saved.status), JSON.stringify(saved.payload));
  assert.ok(saved.payload.id);
  dailyCaptureEventId = saved.payload.id;
  const replay = await request("/api/v1/daily/log", { token: identity.token, method: "POST", body: payload });
  assert.ok([200, 201].includes(replay.status), JSON.stringify(replay.payload));
  assert.equal(replay.payload.id, saved.payload.id);
  assert.equal(replay.payload.idempotent_replay, true);
  const invalid = await request("/api/v1/daily/log", { token: identity.token, method: "POST", body: { person_id: identity.personId, caregiver_id: identity.caregiverId, capture_idempotency_key: 4, observation: "bad request" } });
  assert.equal(invalid.status, 422);
  const expired = await request(`/api/v1/persons/${identity.personId}`, { token: "expired-invalid-token" });
  assert.equal(expired.status, 401);
  const history = await request(`/api/v1/events/${identity.personId}`, { token: identity.token });
  assert.equal(history.status, 200, JSON.stringify(history.payload));
  assert.ok(JSON.stringify(history.payload).includes(saved.payload.id));
});

// 3. Add Record: persist evidence, reject invalid references, and reload the record.
let evidenceId;
await record("03 Add Record", async () => {
  const key = unique("add-record");
  const payload = {
    person_id: identity.personId,
    uploaded_by_caregiver_id: identity.caregiverId,
    type: "note",
    evidence_kind: "caregiver_report",
    epistemic_status: "unverified",
    source_text: "Caregiver reports reduced appetite at breakfast; no cause established.",
    source_type: "critical_care_journey_e2e",
    ingestion_key: key,
  };
  const saved = await request("/api/v1/evidence", { token: identity.token, method: "POST", body: payload });
  assert.ok([200, 201].includes(saved.status), JSON.stringify(saved.payload));
  evidenceId = saved.payload.id;
  const replay = await request("/api/v1/evidence", { token: identity.token, method: "POST", body: payload });
  assert.equal(replay.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.id, evidenceId);
  const invalid = await request("/api/v1/evidence", {
    token: identity.token, method: "POST",
    body: { ...payload, person_id: "another-person", ingestion_key: unique("invalid") },
  });
  assert.equal(invalid.status, 403);
  const reread = await request(`/api/v1/evidence/${identity.personId}`, { token: identity.token });
  assert.equal(reread.status, 200);
  assert.ok(reread.payload.some((row) => row.id === evidenceId));
});

// 3b. A caregiver-facing question must be linked to the exact saved source and intended answerer.
let caregiverQuestionId;
await record("03b source-backed caregiver question routing", async () => {
  const rationale = "The healthcare professional needs to clarify the appetite change before the next care decision.";
  const question = await request("/api/v1/uncertainty/questions", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      question: "Ask the healthcare professional whether the reduced breakfast appetite needs follow-up.",
      subject_type: "person",
      subject_id: identity.personId,
      intended_answerer_role: "professional",
      intended_answerer_label: "Healthcare professional",
      necessity: "necessary",
      necessity_rationale: rationale,
      priority: "high",
      evidence_ids: [evidenceId],
      context: [{
        source_kind: "caregiver_report",
        source_id: evidenceId,
        necessity_assessment: {
          necessity_rationale: rationale,
          decision_dependency: "The caregiver needs the professional's answer before deciding what follow-up is appropriate.",
          evidence_ids: [evidenceId],
        },
      }],
      created_by_caregiver_id: identity.caregiverId,
    },
  });
  assert.equal(question.status, 200, JSON.stringify(question.payload));
  caregiverQuestionId = question.payload.id;
  const recommended = await request("/api/v1/uncertainty/questions/recommended/" + identity.personId, {
    token: identity.token,
  });
  assert.equal(recommended.status, 200, JSON.stringify(recommended.payload));
  assert.ok(
    recommended.payload.questions.some((item) => item.id === caregiverQuestionId),
    "the source-backed question with an explicit professional answerer must enter the caregiver question queue",
  );
});

// 4. Document upload: original bytes -> server extraction -> persisted extraction read.
let documentId;
await record("04 document upload and extraction", async () => {
  const form = new FormData();
  form.append("person_id", identity.personId);
  form.append("caregiver_id", identity.caregiverId);
  form.append("evidence_type", "document");
  form.append("file", new Blob(["Caregiver observation: Mary ate half of her breakfast today. Caregiver observation: Mary woke twice overnight. Caregiver observation: Mary walked to the kitchen using her walking frame. Discharge instruction: Follow-up appointment requested in two weeks. The caregiver reports that Mary had no fever today."], { type: "text/plain" }), "journey-discharge-note.txt");
  const uploaded = await request("/api/v1/upload", { token: identity.token, method: "POST", form });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.payload));
  documentId = uploaded.payload.evidence_id;
  assert.equal(uploaded.payload.persisted, true);
  const extracted = await request(`/api/v1/documents/${documentId}/extract`, { token: identity.token, method: "POST", body: {} });
  assert.equal(extracted.status, 201, JSON.stringify(extracted.payload));
  const reviewed = await request(`/api/v1/documents/analyses/${extracted.payload.analysis_id}`, { token: identity.token });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.payload));
  assert.ok(String(reviewed.payload.extracted_text).toLowerCase().includes("follow-up appointment"));
  const intelligence = await request("/api/v1/documents/" + documentId + "/intelligence", { token: identity.token, method: "POST", body: {} });
  const beforeAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(beforeAcceptance.status, 200, JSON.stringify(beforeAcceptance.payload));

  if (intelligence.status === 201) {
    assert.ok(intelligence.payload.observations.length > 0, "A successful document review must contain source-grounded candidates");
    assert.equal(intelligence.payload.written_to_lcr, false);
    assert.ok(!beforeAcceptance.payload.items.some((item) => JSON.stringify(item).includes(documentId)), "unreviewed document candidate appeared in the LCR");
    const accepted = await request("/api/v1/documents/intelligence/" + intelligence.payload.analysis_id + "/review", { token: identity.token, method: "POST", body: { candidate_index: 0, decision: "accept" } });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.payload));
    assert.equal(accepted.payload.written_to_lcr, true);
  } else {
    const modelUnavailable = intelligence.status === 503
      && intelligence.payload?.detail?.code === "runtime_unreachable";
    assert.equal(
      process.env.SOLENOS_REQUIRE_LIVE_QWEN === "1" ? false : modelUnavailable,
      true,
      `Document intelligence may be unavailable only when live Qwen is not required: ${JSON.stringify(intelligence.payload)}`,
    );
    assert.ok(
      !beforeAcceptance.payload.items.some((item) => JSON.stringify(item).includes(documentId)),
      "An unavailable or unreviewed document interpretation must never be written to the Care Record",
    );
    process.stdout.write("SKIP document interpretation acceptance: inference runtime unavailable; original upload and extracted text remain persisted\\n");
  }
  const duplicateForm = new FormData();
  duplicateForm.append("person_id", identity.personId);
  duplicateForm.append("caregiver_id", identity.caregiverId);
  duplicateForm.append("evidence_type", "document");
  duplicateForm.append("file", new Blob(["Caregiver observation: Mary ate half of her breakfast today. Caregiver observation: Mary woke twice overnight. Caregiver observation: Mary walked to the kitchen using her walking frame. Discharge instruction: Follow-up appointment requested in two weeks. The caregiver reports that Mary had no fever today."], { type: "text/plain" }), "journey-discharge-note-copy.txt");
  const duplicate = await request("/api/v1/upload", { token: identity.token, method: "POST", form: duplicateForm });
  assert.equal(duplicate.status, 201, JSON.stringify(duplicate.payload));
  assert.equal(duplicate.payload.duplicate_detected, true);
});

// 5. LCR: current projection must contain persisted, explicitly sourced evidence.
await record("05 Living Care Record projection and evidence", async () => {
  const lcr = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(lcr.status, 200, JSON.stringify(lcr.payload));
  assert.ok(Array.isArray(lcr.payload.items), "LCR response must expose persisted items");
  assert.ok(lcr.payload.items.some((item) =>
    JSON.stringify(item).includes(evidenceId) || JSON.stringify(item).includes(documentId)
  ), "LCR projection omitted the newly persisted evidence lineage");
  const empty = await request("/api/v1/care-continuity/current-care?limit_per_source=1&query=definitely-no-match-journey", { token: identity.token });
  assert.equal(empty.status, 200);
  const invalid = await request("/api/v1/care-continuity/current-care?limit_per_source=0", { token: identity.token });
  assert.equal(invalid.status, 422);
});

// 6. Companion: must return model-generated output grounded in this care record.
await record("Daily Care saves and retrieves original reports without relying on live AI", async () => {
  const daily = await createBrowserPage(session, "/workspace/daily-care");
  const saveFreeTextUpdate = async (text, afterSaved) => {
    console.log(`Daily Care Scenario 01: opening capture for: ${text}`);
    const shareButton = daily.page.getByRole("button", { name: "Share something", exact: true });
    await shareButton.waitFor({ state: "visible", timeout: 15_000 });
    await shareButton.click();
    const happenedButton = daily.page.getByRole("button", { name: /Something happened/ });
    await happenedButton.waitFor({ state: "visible", timeout: 15_000 });
    await happenedButton.click();
    const originalWords = daily.page.locator("#natural-daily-update-report");
    await originalWords.waitFor({ state: "visible", timeout: 15_000 });
    await originalWords.fill(text);
    const saveStartedAt = Date.now();
    const saveResponsePromise = daily.page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/api/v1/daily-care/entries")
      && response.request().method() === "POST"
    );
    await daily.page.getByRole("button", { name: "Save update", exact: true }).click();
    const saveResponse = await saveResponsePromise;
    const savePayload = await saveResponse.json();
    assert.equal(saveResponse.status(), 200, JSON.stringify(savePayload));
    assert.equal(savePayload.success, true, JSON.stringify(savePayload));
    assert.ok(Date.now() - saveStartedAt < 10_000,
      "the caregiver save must return before background Qwen extraction completes");
    assert.equal(savePayload.qwen_extraction_status, "queued");
    assert.ok(typeof savePayload.qwen_job_id === "string" && savePayload.qwen_job_id);
    await daily.page.getByRole("status").filter({ hasText: "Your update was saved to the care record." }).waitFor({ timeout: 10_000 });
    if (afterSaved) await afterSaved();
    await daily.page.getByRole("button", { name: "Close capture", exact: true }).click();
    await originalWords.waitFor({ state: "detached", timeout: 15_000 });
    console.log(`Daily Care Scenario 01: saved source report: ${text}`);
    return { eventId: savePayload.id, jobId: savePayload.qwen_job_id };
  };
  const seededMedication = await request("/api/v1/care-continuity/medications", {
    token: identity.token,
    method: "POST",
    body: {
      name: "Metformin",
      dose: "500 mg",
      note: "Existing reviewed medication record for Daily Care Scenario 01.",
      review_after_days: 30,
    },
  });
  assert.equal(seededMedication.status, 201, JSON.stringify(seededMedication.payload));
  const reviewedMedication = await request(
    `/api/v1/care-continuity/medications/${seededMedication.payload.medication_id}/review`,
    { token: identity.token, method: "POST", body: {} },
  );
  assert.equal(reviewedMedication.status, 200, JSON.stringify(reviewedMedication.payload));
  const medicationBefore = await request("/api/v1/care-continuity/medications", { token: identity.token });
  assert.equal(medicationBefore.status, 200, JSON.stringify(medicationBefore.payload));
  const existingMedication = medicationBefore.payload.medications.find((item) =>
    item.medication_id === seededMedication.payload.medication_id
  );
  assert.ok(existingMedication, "Scenario 01 must start with an established reviewed medication record");
  assert.equal(existingMedication.dose, "500 mg");

  const appointmentFollowUp = await request("/api/v1/open-loops", {
    token: identity.token,
    method: "POST",
    body: {
      loop_type: "follow_up",
      title: "Contact the clinic about the appointment",
      description: "The clinic has not confirmed the appointment yet. Contact the clinic to confirm it.",
      uncertainty: "unknown",
      source_type: "caregiver_report",
      owner_role: "Caregiver",
      owner_label: "Daughter",
      missing_information: ["Appointment confirmation"],
    },
  });
  assert.equal(appointmentFollowUp.status, 201, JSON.stringify(appointmentFollowUp.payload));
  const appointmentFollowUpId = appointmentFollowUp.payload.id;

  const openLoopsBefore = await request("/api/v1/open-loops?limit=100&offset=0", { token: identity.token });
  assert.equal(openLoopsBefore.status, 200, JSON.stringify(openLoopsBefore.payload));
  const openLoopIdsBefore = (openLoopsBefore.payload.items || []).map((item) => item.id).sort();
  assert.ok(openLoopIdsBefore.includes(appointmentFollowUpId), "the pre-existing clinic follow-up must be in the record before the day begins");
  await daily.page.reload({ waitUntil: "domcontentloaded" });
  await daily.page.getByRole("heading", { name: "Follow-ups", exact: true }).waitFor({ timeout: 15_000 });
  const savedFollowUps = daily.page.getByRole("list", { name: "Saved follow-ups" });
  await savedFollowUps.getByText("Contact the clinic about the appointment", { exact: true })
    .waitFor({ timeout: 15_000 });
  const dailyCaptureJobs = [];
  for (const [index, report] of scenarioReports.entries()) {
    dailyCaptureJobs.push(await saveFreeTextUpdate(report, index === 2 ? async () => {
      await daily.page.getByText(/The existing reviewed medication record lists: Metformin — 500 mg/i).waitFor({ timeout: 15_000 });
    } : undefined));
  }

  // The browser acceptance environment intentionally has no live AI runtime.
  // Verify the save receipts without pretending model extraction has completed.
  for (const { jobId } of dailyCaptureJobs) {
    const status = await request(`/api/v1/assistant/jobs/${jobId}`, { token: identity.token });
    assert.equal(status.status, 200, JSON.stringify(status.payload));
    assert.ok(["queued", "processing", "failed"].includes(status.payload.status),
      `AI extraction must not be reported as complete without a live model: ${JSON.stringify(status.payload)}`);
    assert.equal(status.payload.output_id, null,
      "the no-model test must not invent a generated answer");
    assert.equal(status.payload.written_to_lcr, false,
      "AI output must never be written into the Care Record");
  }

  const dailyHistory = await request(`/api/v1/events/${identity.personId}`, { token: identity.token });
  assert.equal(dailyHistory.status, 200);
  const scenarioEvents = dailyHistory.payload.filter((row) =>
    scenarioReports.some((report) => JSON.stringify(row).includes(report))
  );
  assert.equal(scenarioEvents.length, 4, "all four original caregiver reports must remain independently retrievable");
  assert.equal(new Set(scenarioEvents.map((row) => row.id)).size, 4, "each report must have its own persisted event");
  assert.ok(scenarioEvents.every((row) => Array.isArray(row.evidence_ids) && row.evidence_ids.length === 1));
  dailyScenarioEventIdsByReport = Object.fromEntries(scenarioReports.map((report) => {
    const event = scenarioEvents.find((row) => JSON.stringify(row).includes(report));
    assert.ok(event, `missing persisted event for source report: ${report}`);
    return [report, event.id];
  }));
  dailyScenarioEvidenceIdsByReport = Object.fromEntries(scenarioReports.map((report) => {
    const event = scenarioEvents.find((row) => JSON.stringify(row).includes(report));
    return [report, event.evidence_ids[0]];
  }));

  const dailyEvidence = await request(`/api/v1/evidence/${identity.personId}`, { token: identity.token });
  assert.equal(dailyEvidence.status, 200);
  for (const reportEvent of scenarioEvents) {
    const source = dailyEvidence.payload.find((item) => item.id === reportEvent.evidence_ids[0]);
    assert.ok(source, "each natural-language update must have a retrievable source evidence record");
    assert.ok(JSON.stringify(source).includes(scenarioReports.find((report) => JSON.stringify(reportEvent).includes(report))));
  }

  const dailyLcr = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(dailyLcr.status, 200, JSON.stringify(dailyLcr.payload));
  const medicationAfter = await request("/api/v1/care-continuity/medications", { token: identity.token });
  assert.equal(medicationAfter.status, 200, JSON.stringify(medicationAfter.payload));
  const unchangedMedication = medicationAfter.payload.medications.find((item) =>
    item.medication_id === seededMedication.payload.medication_id
  );
  assert.ok(unchangedMedication, "uncertain medication update must not remove the existing reviewed medication");
  assert.equal(unchangedMedication.name, existingMedication.name);
  assert.equal(unchangedMedication.dose, existingMedication.dose, "uncertain dose must not overwrite the existing reviewed dose");
  const lcrRowsByEvent = new Map();
  for (const reportEvent of scenarioEvents) {
    const lcrRow = dailyLcr.payload.items.find((item) => item.id === reportEvent.id);
    assert.ok(lcrRow, "each saved report must be available through the existing LCR projection");
    assert.deepEqual(lcrRow.evidence_ids, reportEvent.evidence_ids);
    assert.equal(lcrRow.source_type, "caregiver_report");
    lcrRowsByEvent.set(reportEvent.id, lcrRow);
  }

  // With AI inference disabled, the original caregiver reports remain the
  // source of truth. No unreviewed derived observations may appear.
  const projectedObservations = scenarioEvents.flatMap((event) =>
    lcrRowsByEvent.get(event.id)?.derived_observations || []
  );
  assert.equal(projectedObservations.length, 0,
    "without a live inference runtime, no derived observations may be invented or projected");

  const openLoopsAfter = await request("/api/v1/open-loops?limit=100&offset=0", { token: identity.token });
  assert.equal(openLoopsAfter.status, 200, JSON.stringify(openLoopsAfter.payload));
  assert.deepEqual(
    (openLoopsAfter.payload.items || []).map((item) => item.id).sort(),
    openLoopIdsBefore,
    "natural-language observations and missing optional details must not manufacture follow-up tasks or duplicate existing ones",
  );
  const retainedAppointmentFollowUp = openLoopsAfter.payload.items.find((item) => item.id === appointmentFollowUpId);
  assert.ok(retainedAppointmentFollowUp, "the original clinic follow-up must remain retrievable");
  assert.equal(retainedAppointmentFollowUp.status, "open");

  await daily.page.getByText(scenarioReports[2], { exact: false }).first().waitFor({ timeout: 15_000 });
  await daily.page.reload({ waitUntil: "domcontentloaded" });
  await daily.page.getByText("Contact the clinic about the appointment", { exact: true }).waitFor({ timeout: 15_000 });
  for (const report of scenarioReports) {
    await daily.page.getByText(report, { exact: false }).first().waitFor({ timeout: 15_000 });
  }
  await verifyMobile(daily.page);
  await daily.context.close();

});

await record("Care history opens the original caregiver report and its source details", async () => {
  const history = await createBrowserPage(session, "/workspace/care-continuity");
  await history.page.getByRole("heading", { name: "Your Care Record" }).waitFor({ timeout: 20_000 });

  // Recent history lives inside the collapsible workspace navigation sidebar.
  // Open it before interacting with the history controls; do not force a click
  // on an inert element inside the closed sidebar.
  await history.page.getByRole("button", { name: "Open navigation" }).click();
  await history.page.getByRole("button", { name: "Close navigation" }).waitFor({ state: "visible", timeout: 5_000 });

  const reportCard = history.page.locator(".history-event-card")
    .filter({ hasText: scenarioReports[0] }).first();
  await reportCard.waitFor({ state: "visible", timeout: 15_000 });
  await reportCard.locator("button.history-event-open").click();

  await history.page.locator(".history-drawer-heading strong").filter({ hasText: "Care record" }).waitFor({ state: "visible", timeout: 15_000 });
  await history.page.getByRole("heading", { name: "Original record", exact: true }).waitFor({ timeout: 15_000 });
  const originalText = history.page.locator(".history-original-text");
  await originalText.waitFor({ state: "visible", timeout: 15_000 });
  assert.ok((await originalText.innerText()).includes(scenarioReports[0]),
    "the history detail must show the exact original caregiver wording");

  await history.page.getByRole("heading", { name: "More details", exact: true }).waitFor({ timeout: 10_000 });
  const sourceDetails = await history.page.locator(".history-detail-list").innerText();
  assert.match(sourceDetails, /When it happened/,
    "the history detail must show when the caregiver says the event happened");
  assert.match(sourceDetails, /When it was saved/,
    "the history detail must distinguish the saved time");
  assert.match(sourceDetails, /Who shared it\s+Caregiver/,
    "the history detail must identify the caregiver as the source");
  assert.match(sourceDetails, /Related notes or documents\s+1 related item/,
    "the history detail must show its linked source record");

  const evidenceList = await request(`/api/v1/evidence/${encodeURIComponent(identity.personId)}`, {
    token: identity.token,
  });
  assert.equal(evidenceList.status, 200, JSON.stringify(evidenceList.payload));
  const originalEvidence = evidenceList.payload.find(
    (item) => item.id === dailyScenarioEvidenceIdsByReport[scenarioReports[0]],
  );
  assert.ok(originalEvidence?.id, "the source record linked to the caregiver report must remain available");
  assert.ok(
    typeof originalEvidence.source_text === "string" &&
      originalEvidence.source_text.includes(scenarioReports[0]),
    "the exact original caregiver wording must remain inside the saved source text",
  );

  await history.page.getByRole("button", { name: "Back to care history", exact: true }).click();
  await reportCard.waitFor({ state: "visible", timeout: 10_000 });
  await verifyMobile(history.page);
  await history.context.close();
});

await record("06 Companion context and Qwen output", async () => {
  const answer = await request("/api/v1/conversation/message", {
    token: identity.token, method: "POST",
    body: { person_id: identity.personId, text: "What has the caregiver recorded about sleep, lunch and dinner?" },
  });
  assert.equal(answer.status, 200, JSON.stringify(answer.payload));
  assert.equal(answer.payload.written_to_lcr, false);
  if (requireLiveQwen) {
    assert.ok(
      answer.payload.ai_generated === true || answer.payload.ai_generated === false,
      "Companion must identify whether the final answer was model-generated or source-extracted",
    );
    if (answer.payload.ai_generated === false) {
      assert.match(
        answer.payload.safety_note || "",
        /saved caregiver entries/i,
        "A deterministic history fallback must disclose that it quotes saved caregiver entries",
      );
    }
    assert.ok(answer.payload.reply && answer.payload.reply.length > 12);
    const normalizedReply = answer.payload.reply.toLowerCase();
    assert.match(normalizedReply, /sleep|slept|rest|overnight/);
    assert.match(normalizedReply, /lunch|midday/);
    assert.match(normalizedReply, /dinner|supper|evening/);
    assert.match(
      normalizedReply,
      /poorly|poor sleep|unsettled|restless|rough sleep/,
      "Companion did not communicate the recorded poor-sleep or unsettled observation",
    );
    assert.match(
      normalizedReply,
      /barely|hardly|little.*lunch|lunch.*little|low appetite|small lunch/,
      "Companion did not communicate the recorded low-lunch-intake observation",
    );
    assert.match(
      normalizedReply,
      /calmer|more.*dinner|dinner.*more|ate a little more|settled this evening/,
      "Companion did not communicate the recorded evening improvement observation",
    );
    assert.ok(
      (answer.payload.source_event_ids ?? []).length > 0 ||
      (answer.payload.source_evidence_ids ?? []).length > 0,
      "Companion response did not return source references",
    );
  } else {
    assert.ok(typeof answer.payload.reply === "string" && answer.payload.reply.length > 0);
    assert.ok(
      answer.payload.ai_generated === true || answer.payload.ai_generated === false,
      "Companion response must explicitly identify whether a model generated it",
    );
  }
  const companionEventIds = new Set(answer.payload.source_event_ids || []);
  const companionEvidenceIds = new Set(answer.payload.source_evidence_ids || []);
  const companionSourceRefs = new Set(
    (answer.payload.source_record_refs || []).map((item) => `${item.record_type}:${item.record_id}`),
  );
  for (const report of [
    "Mum slept poorly last night and seemed more unsettled this morning.",
    "Mum barely touched her lunch today. She drank some water, though.",
    "Mum was calmer this evening. She ate a little more at dinner and is now resting.",
  ]) {
    assert.ok(
      companionEventIds.has(dailyScenarioEventIdsByReport[report]),
      `Companion did not retrieve the Daily Care event relevant to sleep/appetite: ${report}`,
    );
    assert.ok(
      companionEvidenceIds.has(dailyScenarioEvidenceIdsByReport[report]),
      `Companion did not retrieve the source evidence for: ${report}`,
    );
    assert.ok(
      companionSourceRefs.has(`care_event:${dailyScenarioEventIdsByReport[report]}`),
      `Companion omitted typed care-event provenance for: ${report}`,
    );
    assert.ok(
      companionSourceRefs.has(`care_evidence:${dailyScenarioEvidenceIdsByReport[report]}`),
      `Companion omitted typed evidence provenance for: ${report}`,
    );
  }
  assert.equal(
    companionEventIds.has(dailyScenarioEventIdsByReport["I think the doctor changed Mum's medication yesterday, but I can't remember the new dose."]),
    false,
    "the sleep/appetite question must not pull an unrelated medication report into its source set",
  );
  assert.equal(
    answer.payload.lcr_context_coverage?.prompt_context_complete,
    true,
    "Companion must disclose a complete prompt context for this bounded care-history question",
  );
  assert.ok(
    Number(answer.payload.lcr_context_coverage?.prompt_context_chars || 0)
      <= Number(answer.payload.lcr_context_coverage?.prompt_context_budget_chars || 0),
    "Companion prompt context must remain inside its declared budget",
  );

  const questionAnswer = await request("/api/v1/conversation/message", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      text: "What question should I raise with the healthcare professional about appetite?",
      client_turn_id: randomUUID(),
    },
  });
  assert.equal(questionAnswer.status, 200, JSON.stringify(questionAnswer.payload));
  assert.equal(questionAnswer.payload.ai_generated, false);
  assert.equal(questionAnswer.payload.response_mode, "source_quoted_caregiver_question");
  assert.equal(questionAnswer.payload.written_to_lcr, false);
  assert.ok(
    (questionAnswer.payload.source_lcr_context_ids || []).includes(caregiverQuestionId),
    "Companion must retrieve the source-validated caregiver question from the LCR question queue",
  );
  assert.ok(
    questionAnswer.payload.lcr_context_coverage?.sources?.caregiver_question_queue?.selected_for_answer > 0,
    "Companion must report that the validated caregiver question was selected for the source-grounded answer",
  );

  const professionalQuestionReply = String(questionAnswer.payload.reply || "").toLowerCase();
  assert.match(
    professionalQuestionReply,
    /appetite|breakfast|eating|food/,
    "Companion must answer the caregiver's actual appetite question",
  );
  assert.match(
    professionalQuestionReply,
    /healthcare professional|professional|doctor|clinician|care team/,
    "Companion must preserve that the question is intended for a healthcare professional",
  );

  const medicationAnswerStartedAt = Date.now();
  const medicationAnswer = await request("/api/v1/conversation/message", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      text: "What new dose did the doctor prescribe for Mum yesterday?",
      client_turn_id: randomUUID(),
    },
  });
  const medicationAnswerDurationMs = Date.now() - medicationAnswerStartedAt;
  assert.ok(
    medicationAnswerDurationMs < 60_000,
    `Medication recall must return within 60 seconds, got ${medicationAnswerDurationMs}ms`,
  );
  assert.equal(medicationAnswer.status, 200, JSON.stringify(medicationAnswer.payload));
  assert.equal(medicationAnswer.payload.written_to_lcr, false);
  assert.equal(
    medicationAnswer.payload.ai_generated,
    false,
    "medication-dose recall must use a source-bound deterministic response, not model completion",
  );
  assert.match(
    medicationAnswer.payload.safety_note || "",
    /does not confirm the prescribed dose or current medication instructions/i,
    "the medication recall answer must disclose that a caregiver report does not verify the prescription",
  );
  const medicationReply = String(medicationAnswer.payload.reply || "").toLowerCase();
  assert.match(
    medicationReply,
    /i think the doctor changed mum's medication yesterday, but i can't remember the new dose/,
    "Companion must quote the caregiver's uncertain medication report instead of inventing a dose",
  );
  assert.doesNotMatch(
    medicationReply,
    /\b500\s*mg\b/i,
    "Companion must not substitute an older recorded dose for the requested new prescription",
  );
  assert.doesNotMatch(
    medicationReply,
    /(?:the new dose is|the doctor prescribed|the medication was changed to)\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ml)/i,
    "Companion must not invent a new medication dose from an uncertain caregiver report",
  );
  assert.ok(
    (medicationAnswer.payload.source_event_ids || []).includes(
      dailyScenarioEventIdsByReport[scenarioReports[2]],
    ),
    "Companion must retrieve the exact uncertain medication report",
  );
  assert.ok(
    (medicationAnswer.payload.source_evidence_ids || []).includes(
      dailyScenarioEvidenceIdsByReport[scenarioReports[2]],
    ),
    "Companion must retain the original evidence for the uncertain medication report",
  );
  const medicationSourceRefs = new Set(
    (medicationAnswer.payload.source_record_refs || []).map(
      (item) => `${item.record_type}:${item.record_id}`,
    ),
  );
  assert.ok(
    medicationSourceRefs.has(`care_event:${dailyScenarioEventIdsByReport[scenarioReports[2]]}`),
    "Medication recall must expose a typed reference to the exact caregiver event",
  );
  assert.ok(
    medicationSourceRefs.has(`care_evidence:${dailyScenarioEvidenceIdsByReport[scenarioReports[2]]}`),
    "Medication recall must expose a typed reference to the original evidence",
  );
  assert.equal(
    medicationAnswer.payload.lcr_context_coverage?.prompt_context_complete,
    true,
    "Companion must disclose complete context for the medication-dose question",
  );
  assert.equal(
    medicationAnswer.payload.lcr_context_coverage?.direct_medication_recall?.status,
    "available",
    "Medication recall must perform a person-scoped lookup of saved caregiver reports",
  );
  assert.equal(
    medicationAnswer.payload.lcr_context_coverage?.direct_medication_recall?.history_complete,
    true,
    "Medication recall must disclose whether its direct source lookup covered the matching history",
  );

  const documentAnswer = await request("/api/v1/conversation/message", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      text: "What does the uploaded document say about walking?",
      client_turn_id: randomUUID(),
    },
  });
  assert.equal(documentAnswer.status, 200, JSON.stringify(documentAnswer.payload));
  assert.equal(documentAnswer.payload.written_to_lcr, false);
  assert.ok(
    documentAnswer.payload.ai_generated === true || documentAnswer.payload.ai_generated === false,
    "Companion must identify whether a document answer came from Qwen or the verified source excerpt",
  );
  if (documentAnswer.payload.ai_generated === false) {
    assert.match(
      documentAnswer.payload.safety_note || "",
      /quoted from the uploaded document/i,
      "A deterministic document excerpt must disclose its source and verification limit",
    );
  }
  assert.ok(
    Array.isArray(documentAnswer.payload.source_document_analysis_ids)
      && documentAnswer.payload.source_document_analysis_ids.length > 0,
    "Companion must return the exact verified document extraction IDs supplied to its answer",
  );
  assert.ok(
    (documentAnswer.payload.source_evidence_ids || []).includes(documentId),
    "Companion must cite the exact uploaded document when answering a document question",
  );
  assert.ok(
    (documentAnswer.payload.source_document_analysis_ids || []).length > 0,
    "Companion must retain the persisted document-extraction reference in its source metadata",
  );
  assert.ok(
    /walking frame|walked to the kitchen|walking to the kitchen/i.test(documentAnswer.payload.reply || ""),
    `Companion must answer from the persisted document extraction rather than generic care advice. Reply: ${String(documentAnswer.payload.reply || "").slice(0, 500)}; source analyses: ${JSON.stringify(documentAnswer.payload.source_document_analysis_ids || [])}`,
  );

  const overwhelmedAnswer = await request("/api/v1/conversation/message", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      text: "I'm exhausted. I can't keep up with all these updates and I don't know what to do.",
      client_turn_id: randomUUID(),
    },
  });
  assert.equal(overwhelmedAnswer.status, 200, JSON.stringify(overwhelmedAnswer.payload));
  assert.equal(overwhelmedAnswer.payload.written_to_lcr, false);
  if (requireLiveQwen) {
    if (overwhelmedAnswer.payload.ai_generated === false) {
      assert.equal(
        overwhelmedAnswer.payload.response_mode,
        "deterministic_low_capacity_support_fallback",
        "A non-model response must be explicitly identified as the safe low-capacity fallback",
      );
      assert.match(
        overwhelmedAnswer.payload.safety_note || "",
        /couldn't confirm a reliable answer from the care record/i,
        "The fallback must disclose its limits in caregiver-facing language",
      );
      assert.equal(
        overwhelmedAnswer.payload.reply,
        "I hear that you're exhausted. We can take this one concern at a time.",
      );
      assert.deepEqual(overwhelmedAnswer.payload.source_event_ids || [], []);
      assert.deepEqual(overwhelmedAnswer.payload.source_evidence_ids || [], []);
      assert.deepEqual(overwhelmedAnswer.payload.source_record_refs || [], []);
    } else {
      assert.equal(overwhelmedAnswer.payload.ai_generated, true);
    }
  }
  const overloadReply = String(overwhelmedAnswer.payload.reply || "").trim();
  const overloadSentences = overloadReply.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  assert.doesNotMatch(
    overloadReply,
    /\b(?:diagnos(?:ed|is)|prescribed|recommended\s+(?:a\s+)?(?:medication|treatment|dose)|ordered\s+(?:a\s+)?(?:test|scan|medication))\b/i,
    "An overwhelmed caregiver must not receive an unsupported clinical recommendation or status claim",
  );
  assert.ok(overloadReply.length > 0 && overloadReply.length <= 700, "Companion must keep an overwhelmed-caregiver response brief");
  assert.ok(overloadSentences.length <= 2, "Companion must keep an overwhelmed-caregiver response to two short sentences");
  assert.ok((overloadReply.match(/\?/g) || []).length <= 1, "Companion must ask at most one question when the caregiver is overwhelmed");
  assert.doesNotMatch(overloadReply, /(?:^|\n)\s*(?:\d+[.)]|[-*])\s+/m, "Companion must not turn caregiver distress into a checklist");

  const invalid = await request("/api/v1/conversation/message", {
    token: identity.token, method: "POST",
    body: { person_id: identity.personId, text: "" },
  });
  assert.equal(invalid.status, 422);
  const history = await request(`/api/v1/conversation/${answer.payload.session_id}`, { token: identity.token });
  assert.equal(history.status, 200);
  assert.ok(history.payload.messages?.length >= 2);
});

// 7. Change detection: reconcile against saved source evidence and retrieve the run.
await record("07 change detection and supporting evidence", async () => {
  const deltaStartedAt = performance.now();
  const reconciled = await request("/api/v1/care-delta/reconcile", {
    token: identity.token, method: "POST",
    body: {
      person_id: identity.personId,
      event_date: new Date().toISOString(),
      source: "critical_care_journey_e2e",
      content: "Caregiver reports a change in sleep pattern and reduced breakfast intake.",
      evidence_ids: [evidenceId],
      persist: true,
    },
  });
  const deltaDurationMs = Math.round(performance.now() - deltaStartedAt);
  assert.equal(reconciled.status, 200, JSON.stringify(reconciled.payload));
  assert.ok(deltaDurationMs < 150_000, `Delta Engine exceeded the 150-second inference budget: ${deltaDurationMs}ms`);
  assert.ok(reconciled.payload?.claim_provenance && Array.isArray(reconciled.payload.claim_provenance.claims), "Delta Engine must return claim-specific source references");
  for (const claim of reconciled.payload.claim_provenance.claims) {
    assert.ok(typeof claim.text === "string" && Array.isArray(claim.source_references), "each Delta claim must expose its own source references");
    if (["matched_source_and_state", "matched_competing_sources", "matched_exact_source_wording"].includes(claim.support_status)) {
      assert.ok(claim.source_references.length > 0, "a supported Delta claim must identify at least one source");
    }
  }
  for (const domain of ["medications", "conditions", "symptoms", "tests", "follow_ups", "clinical_gaps", "contradictions"]) {
    for (const finding of reconciled.payload[domain] || []) {
      assert.ok(Array.isArray(finding.source_record_refs), "each Delta finding must carry its own source links");
    }
  }
  const invalid = await request("/api/v1/care-delta/reconcile", {
    token: identity.token, method: "POST",
    body: { person_id: identity.personId, source: "critical_care_journey_e2e", content: "", persist: true },
  });
  assert.equal(invalid.status, 422);
  const runs = await request(`/api/v1/care-delta/runs/${identity.personId}`, { token: identity.token });
  assert.equal(runs.status, 200);
  assert.ok(runs.payload.some((run) => run.evidence_ids?.includes(evidenceId)));
});

// 8. Community: currently disabled; prove it cannot contaminate the authoritative LCR.
await record("08 Community and LCR isolation", async () => {
  const before = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  const feed = await request("/api/v1/community", { token: identity.token });
  assert.equal(feed.status, 404, "Community is disabled and must not expose an unimplemented feed");
  const publish = await request("/api/v1/community", {
    token: identity.token, method: "POST",
    body: { post_type: "experience", content: "This must never be written into the LCR." },
  });
  assert.equal(publish.status, 404);
  const after = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(after.status, 200);
  assert.deepEqual(after.payload.items, before.payload.items, "community attempts changed authoritative LCR state");
});

// 9. Appointment: idempotent save and durable summary retrieval.
let appointmentWorkspaceId;
await record("09 appointment summary persistence", async () => {
  const preparationBrief = await request("/api/v1/appointment-workspaces/preparation-brief?window_days=90", {
    token: identity.token,
  });
  assert.equal(preparationBrief.status, 200, JSON.stringify(preparationBrief.payload));
  assert.equal(preparationBrief.payload.read_only, true);
  assert.ok(
    preparationBrief.payload.events.some((item) => item.description?.includes("restless sleep"))
      || preparationBrief.payload.events.some((item) => item.description?.includes("overnight awakenings")),
    "appointment preparation must retrieve saved Daily Care history from the care record",
  );
  assert.ok(
    preparationBrief.payload.documents.some((item) => item.source_evidence_id === documentId),
    "appointment preparation must retrieve the persisted document extraction linked to its original upload",
  );
  assert.ok(
    preparationBrief.payload.open_questions.some((item) => item.source_id === caregiverQuestionId),
    "appointment preparation must retrieve the source-backed question and preserve its intended answerer",
  );
  assert.equal(
    preparationBrief.payload.open_questions.find((item) => item.source_id === caregiverQuestionId).intended_answerer_role,
    "professional",
  );
  assert.ok(
    ["available", "empty"].includes(preparationBrief.payload.source_coverage.open_questions),
    "appointment preparation must report whether caregiver questions were successfully retrieved",
  );
  const payload = {
    status: "preparation",
    payload: {
      summary: "Prepare for the next care review.",
      caregiver_concerns: ["Sleep pattern", "Breakfast intake"],
      evidence_ids: [evidenceId],
      source_attribution: "caregiver_reported",
    },
    change_reason: "Critical journey browser integration test",
    idempotency_key: unique("appointment-save"),
  };
  const saved = await request("/api/v1/appointment-workspaces", { token: identity.token, method: "POST", body: payload });
  assert.equal(saved.status, 201, JSON.stringify(saved.payload));
  appointmentWorkspaceId = saved.payload.id;
  const replay = await request("/api/v1/appointment-workspaces", { token: identity.token, method: "POST", body: payload });
  assert.ok([200, 201].includes(replay.status), JSON.stringify(replay.payload));
  assert.equal(replay.payload.id, appointmentWorkspaceId);
  const invalid = await request("/api/v1/appointment-workspaces", {
    token: identity.token, method: "POST",
    body: { status: "invalid-stage", payload: {}, change_reason: "invalid enum", idempotency_key: unique("invalid-appointment") },
  });
  assert.equal(invalid.status, 422);
  const list = await request("/api/v1/appointment-workspaces", { token: identity.token });
  assert.equal(list.status, 200);
  assert.ok(list.payload.items.some((item) => item.id === appointmentWorkspaceId));
});

// 10. Handoff: prepare a source-referenced draft and confirm it remains persisted/read-only.
let handoffDraftId;
await record("10 evidence-backed handoff", async () => {
  const requestId = unique("handoff-request");
  const handoffBody = { purpose: "professional_appointment", audience: "professional", window_days: 30 };
  const draft = await request("/api/v1/handoff-drafts/prepare", {
    token: identity.token, method: "POST", body: handoffBody,
    extraHeaders: { "x-request-id": requestId },
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.payload));
  assert.equal(draft.payload.draft_persisted, true);
  assert.equal(draft.payload.updates_lcr, false);
  assert.equal(typeof draft.payload.retrieval_complete, "boolean");
  assert.ok(draft.payload.source_statuses.daily_care.status === "available");
  assert.ok(draft.payload.source_statuses.documents.status === "available");
  assert.ok(
    draft.payload.source_references.some((item) => item.source_table === "care_events"),
    "handoff draft must retrieve Daily Care entries from the same persisted care record",
  );
  assert.ok(
    draft.payload.source_references.some((item) => item.source_table === "capture_analyses"),
    "handoff draft must retrieve document extraction provenance from the same persisted care record",
  );
  if (requireLiveQwen) {
    assert.equal(draft.payload.generation_status, "generated", JSON.stringify(draft.payload.generation));
    assert.equal(draft.payload.validation_status, "exact_quote_reference_validation_passed");
    assert.ok(draft.payload.generation.sections.length > 0, "live Qwen did not select source-grounded handoff sections");
    assert.ok(
      draft.payload.claim_provenance.claims.length > 0
        && draft.payload.claim_provenance.claims.every((claim) =>
          ["matched_saved_wording", "matched_historical_only"].includes(claim.support_status)
        ),
      "every generated handoff statement must resolve to exact saved source wording",
    );
  }
  handoffDraftId = draft.payload.draft_id;
  const replay = await request("/api/v1/handoff-drafts/prepare", {
    token: identity.token, method: "POST", body: handoffBody,
    extraHeaders: { "x-request-id": requestId },
  });
  assert.equal(replay.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.draft_id, handoffDraftId);
  const invalid = await request("/api/v1/handoff-drafts/prepare", {
    token: identity.token, method: "POST",
    body: { purpose: "invalid-purpose", audience: "professional", window_days: 30 },
  });
  assert.equal(invalid.status, 422);
  const list = await request("/api/v1/handoff-drafts?limit=10", { token: identity.token });
  assert.equal(list.status, 200);
  assert.ok(JSON.stringify(list.payload).includes(handoffDraftId));
  assert.ok(Array.isArray(draft.payload.source_references));
});

// 11. Returning caregiver: sign in from a fresh browser context and retrieve same history.
let accountEmail;
let recoveryCode;
await record("11 returning caregiver history", async () => {
  accountEmail = `critical-journey-${randomUUID()}@example.test`;
  const created = await request("/api/v1/accounts", {
    token: identity.token, method: "POST",
    body: { email: accountEmail, password },
  });
  assert.equal(created.status, 201, JSON.stringify(created.payload));
  recoveryCode = created.payload.recovery_code;
  const login = await request("/api/v1/accounts/login", {
    method: "POST", body: { email: accountEmail, password },
  });
  assert.equal(login.status, 200, JSON.stringify(login.payload));
  assert.equal(login.payload.person_id, identity.personId);
  assert.equal(login.payload.caregiver_id, identity.caregiverId);
  // Recovery rotates the active session token; subsequent browser checks must use it.
  session = { ...session, access_token: login.payload.access_token, expires_at: login.payload.expires_at };
  identity.token = login.payload.access_token;
  const returningHistory = await request(`/api/v1/events/${identity.personId}`, { token: login.payload.access_token });
  assert.equal(returningHistory.status, 200, JSON.stringify(returningHistory.payload));
  assert.ok(
    JSON.stringify(returningHistory.payload).includes(dailyCaptureEventId),
    "returning caregiver could not retrieve the persisted Daily Capture event",
  );
  const returningEvidence = await request(`/api/v1/evidence/${identity.personId}`, { token: login.payload.access_token });
  assert.equal(returningEvidence.status, 200, JSON.stringify(returningEvidence.payload));
  assert.ok(
    returningEvidence.payload.some((row) => row.id === evidenceId),
    "returning caregiver could not retrieve the Add Record evidence",
  );
  const { context, page } = await createBrowserPage({
    ...session,
    access_token: login.payload.access_token,
    expires_at: login.payload.expires_at,
  }, "/workspace");
  await verifyMobile(page);
  await context.close();
});

// 12. Account recovery: one-time code rotates credentials without changing care ownership.
await record("12 account recovery preserves care record", async () => {
  const recovered = await request("/api/v1/accounts/recover", {
    method: "POST",
    body: { email: accountEmail, recovery_code: recoveryCode, new_password: "CI-recovered-passphrase-2026!" },
  });
  assert.equal(recovered.status, 200, JSON.stringify(recovered.payload));
  assert.equal(recovered.payload.recovered, true);
  const reusedCode = await request("/api/v1/accounts/recover", {
    method: "POST",
    body: { email: accountEmail, recovery_code: recoveryCode, new_password: "CI-second-recovery-passphrase-2026!" },
  });
  assert.equal(reusedCode.status, 401);
  const oldPassword = await request("/api/v1/accounts/login", {
    method: "POST", body: { email: accountEmail, password },
  });
  assert.equal(oldPassword.status, 401);
  const login = await request("/api/v1/accounts/login", {
    method: "POST", body: { email: accountEmail, password: "CI-recovered-passphrase-2026!" },
  });
  assert.equal(login.status, 200, JSON.stringify(login.payload));
  assert.equal(login.payload.person_id, identity.personId);
  assert.equal(login.payload.caregiver_id, identity.caregiverId);
  // Recovery rotates the active session token. Browser checks must use the
  // recovered credential, not the pre-recovery bearer token.
  session = { ...session, access_token: login.payload.access_token, expires_at: login.payload.expires_at };
  identity.token = login.payload.access_token;
  const persisted = await request(`/api/v1/evidence/${identity.personId}`, { token: login.payload.access_token });
  assert.equal(persisted.status, 200);
  assert.ok(persisted.payload.some((row) => row.id === evidenceId));
});

// UI consumption checks: real frontend pages use the proxied backend, including mobile layout and failure UI.
await record("frontend consumes persisted documents and appointments", async () => {
  const { context, page, observed } = await createBrowserPage(session, "/workspace/documents");
  const documentRequests = await browserPageConsumes(page, "/evidence/", observed);
  assert.ok(documentRequests.some((item) => item.status === 200), JSON.stringify(documentRequests));
  await verifyMobile(page);
  await context.close();

  const appointmentPage = await createBrowserPage(session, "/workspace/appointments");
  const appointmentRequests = await browserPageConsumes(appointmentPage.page, "/appointment-workspaces", appointmentPage.observed);
  assert.ok(appointmentRequests.some((item) => item.status === 200), JSON.stringify(appointmentRequests));
  await verifyMobile(appointmentPage.page);
  await appointmentPage.context.close();
});


await record("frontend loading and empty states", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((identity) => {
    localStorage.setItem("solenos_anonymous_access_token", identity.token);
    localStorage.setItem("solenos_backend_person_id", identity.personId);
    localStorage.setItem("solenos_backend_caregiver_id", identity.caregiverId);
    localStorage.setItem("solenos_anonymous_session_expires_at", identity.expiresAt);
  }, {
    token: session.access_token,
    personId: session.person.id,
    caregiverId: session.caregiver.id,
    expiresAt: session.expires_at,
  });
  const page = await context.newPage();
  await page.route("**/api/v1/evidence*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto(new URL("/workspace/documents", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.locator(".living-archive-loading").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await verifyMobile(page);
  await context.close();

  const emptySession = await newSession("empty documents state");
  const emptyPage = await createBrowserPage(emptySession, "/workspace/documents");
  await emptyPage.page.getByText("No saved documents yet", { exact: true }).waitFor({ timeout: 15_000 });
  await verifyMobile(emptyPage.page);
  await emptyPage.context.close();
});

await record("frontend network failure is surfaced rather than rendered as empty data", async () => {
  const { context, page } = await createBrowserPage(session, "/workspace/documents");
  await page.route("**/api/v1/evidence*", (route) => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("alert").first().waitFor({ timeout: 15_000 });
  await verifyMobile(page);
  await context.close();
});


await record("browser renders caregiver surfaces and submits Companion through the UI", async () => {

  const surfaces = ["/workspace", "/workspace/companion", "/workspace/appointments", "/workspace/documents", "/workspace/settings", "/workspace/community"];
  for (const route of surfaces) {
    const { context, page, observed } = await createBrowserPage(session, route);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    const bodyText = await page.locator("body").innerText();
    assert.ok(bodyText.trim().length > 40, `surface did not render: ${route}`);
    await verifyMobile(page);
    if (route === "/workspace") {
      assert.ok(observed.some((item) => item.path.includes("/care-continuity/current-care") && item.status === 200), "LCR screen did not consume the persisted current-care API");
    }
    if (route === "/workspace/community") await page.waitForURL("**/workspace", { timeout: 10_000 });
    await context.close();
  }

  const companion = await createBrowserPage(session, "/workspace/companion");
  await companion.page.locator("#companion-message-input").fill("What did the caregiver record about sleep and appetite?");
  // The composer documents Enter as its primary send action; exercise that exact UI path.
  await companion.page.locator("#companion-message-input").press("Enter");
  await companion.page.waitForFunction(() => {
    const messages = Array.from(document.querySelectorAll(".companion-message.is-assistant"));
    return messages.length > 0 && !messages[messages.length - 1].querySelector(".companion-typing");
  }, undefined, { timeout: 210_000 });
  const assistantReply = await companion.page.locator(".companion-message.is-assistant").last().innerText();
  assert.ok(assistantReply.trim().length > 30, "Companion UI did not render the backend response");
  await companion.page.getByRole("status", { name: "Care history coverage" }).waitFor({ timeout: 15_000 });
  await companion.page.getByText("How much of the saved care history was checked", { exact: true }).waitFor();
  await verifyMobile(companion.page);

  // Companion messages remain conversation-only until the caregiver separately
  // confirms the exact message, reviews the proposal, and accepts it.
  const observationText = "Mum woke up three times last night.";
  const previousAssistantCount = await companion.page.locator(".companion-message.is-assistant").count();
  await companion.page.locator("#companion-message-input").fill(observationText);
  await companion.page.locator("#companion-message-input").press("Enter");
  await companion.page.waitForFunction((count) => {
    const messages = Array.from(document.querySelectorAll(".companion-message.is-assistant"));
    return messages.length > count && !messages[messages.length - 1].querySelector(".companion-typing");
  }, previousAssistantCount, { timeout: 210_000 });
  const observationMessage = companion.page.locator(".companion-message.is-user").filter({ hasText: observationText }).last();
  await observationMessage.getByRole("button", { name: "Save as a care note" }).waitFor({ timeout: 15_000 });
  await observationMessage.getByRole("button", { name: "Save as a care note" }).click();
  await observationMessage.getByRole("button", { name: "Yes, save for review" }).click();

  const reviewCard = companion.page.locator(".companion-care-update").filter({ hasText: observationText }).last();
  await reviewCard.waitFor({ timeout: 15_000 });
  const beforeAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(beforeAcceptance.status, 200, JSON.stringify(beforeAcceptance.payload));
  assert.equal(
    JSON.stringify(beforeAcceptance.payload).includes(observationText),
    false,
    "a Companion message and pending proposal must not update the Care Record before acceptance",
  );

  await reviewCard.getByRole("button", { name: "Add to Care Record" }).click();
  await companion.page.getByText(
    "Your report was added to the Care Record. A healthcare professional has not confirmed it.",
    { exact: true },
  ).waitFor({ timeout: 15_000 });
  const afterAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(afterAcceptance.status, 200, JSON.stringify(afterAcceptance.payload));
  assert.ok(
    JSON.stringify(afterAcceptance.payload).includes(observationText),
    "the explicitly accepted Companion report must appear in the same persisted Care Record",
  );
  await companion.context.close();
});



await record("clarification questions are linked, answerable, skippable and durable", async () => {
  const sourceRows = await request("/api/v1/evidence/" + identity.personId, { token: identity.token });
  assert.equal(sourceRows.status, 200, JSON.stringify(sourceRows.payload));
  const source = sourceRows.payload.find((row) => row.person_id === identity.personId && row.id);
  assert.ok(source, "the clarification journey needs a real saved source in this care record");
  const tag = unique("clarification-source");
  const answerQuestionText = "Who can confirm the care detail " + tag + "?";
  const skipQuestionText = "When was the care detail " + tag + " first noticed?";
  const createQuestion = async (question) => {
    const created = await request("/api/v1/uncertainty/questions", {
      token: identity.token,
      method: "POST",
      body: {
        person_id: identity.personId,
        question,
        subject_type: "person",
        subject_id: identity.personId,
        priority: "medium",
        necessity: "necessary",
        necessity_rationale: "The current care review depends on confirming this detail.",
        intended_answerer_role: "reporting_caregiver",
        evidence_ids: [source.id],
        context: [{
          source_kind: "caregiver_report",
          source_id: source.id,
          source_record_refs: [{ record_type: "evidence", record_id: source.id }],
          necessity_assessment: {
            necessity: "necessary",
            necessity_rationale: "The current care review depends on confirming this detail.",
            decision_dependency: "The current handoff cannot be completed accurately without this answer.",
            evidence_ids: [source.id],
          },
        }],
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.payload));
    return created.payload;
  };
  const answerQuestion = await createQuestion(answerQuestionText);
  const skipQuestion = await createQuestion(skipQuestionText);

  const { context, page } = await createBrowserPage(session, "/workspace/care-continuity");
  // Clarification is intentionally progressive disclosure: the long-form review
  // workflow must not expand into the caregiver's first-screen summary.
  await page.getByText("Questions that may help clarify care", { exact: true }).click();
  await page.getByRole("heading", { name: "Questions worth clarifying" }).waitFor({ timeout: 20_000 });
  await page.getByText(answerQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(answerQuestionText, { exact: true }).first().click();
  const exactAnswer = "I observed this on " + tag + ".";
  const exactProvenance = "I was present and recorded it in the care note.";
  await page.getByLabel("What did you observe or report?").fill(exactAnswer);
  await page.getByLabel("When did you observe this?").fill(exactProvenance);
  await page.getByRole("button", { name: "Save answer", exact: true }).click();
  await page.getByText("Your answer has been saved.", { exact: false }).waitFor({ timeout: 20_000 });

  const answerHistory = await request(
    "/api/v1/uncertainty/questions/" + answerQuestion.id + "/answer-history",
    { token: identity.token },
  );
  assert.equal(answerHistory.status, 200, JSON.stringify(answerHistory.payload));
  assert.equal(answerHistory.payload[0].answer, exactAnswer);
  assert.equal(answerHistory.payload[0].answer_provenance, exactProvenance);
  assert.equal(answerHistory.payload[0].evidence_ids.length, 1);
  await page.getByText("This question is not linked to a specific care detail.", { exact: false }).waitFor({ timeout: 10_000 });
  assert.equal(
    await page.getByRole("button", { name: "Accept as caregiver report", exact: true }).count(),
    0,
    "an unlinked clarification must not offer a review action that cannot be completed",
  );

  await page.evaluate(() => window.dispatchEvent(new Event("careRecordUpdated")));
  await page.getByText(skipQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(skipQuestionText, { exact: true }).first().click();
  await page.getByRole("button", { name: "I don't know the answer yet", exact: true }).click();
  await page.getByText("This question remains open for later.", { exact: false }).waitFor({ timeout: 20_000 });

  const questions = await request("/api/v1/uncertainty/questions/" + identity.personId, { token: identity.token });
  assert.equal(questions.status, 200, JSON.stringify(questions.payload));
  assert.equal(questions.payload.find((row) => row.id === skipQuestion.id)?.status, "unresolved");
  assert.equal(questions.payload.find((row) => row.id === answerQuestion.id)?.status, "answered");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Questions worth clarifying" }).waitFor({ timeout: 20_000 });
  await page.getByText(skipQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText("View answered and closed questions", { exact: true }).click();
  await page.getByRole("button", { name: new RegExp(answerQuestionText) }).click();
  await page.getByText(exactAnswer, { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText(exactProvenance, { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByText("Earlier answers", { exact: true }).waitFor();
  await verifyMobile(page);
  await context.close();
});

await record("persisted situation evidence review and caregiver trajectory update", async () => {
  assert.ok(dailyCaptureEventId, "situation review needs a persisted source event");
  const situationId = unique("caregiver-situation");
  const seed = String.raw`
import sys
from app.core.database import SessionLocal
from app.models.care import CareEvent
from app.models.change import Situation, SituationState, SituationType

person_id, event_id, situation_id = sys.argv[1:4]
db = SessionLocal()
try:
    event = db.query(CareEvent).filter(
        CareEvent.id == event_id,
        CareEvent.person_id == person_id,
    ).first()
    if event is None:
        raise RuntimeError("The source care event was not found in the scoped care record")
    situation = Situation(
        id=situation_id,
        person_id=person_id,
        situation_type=SituationType.UNKNOWN,
        state=SituationState.ACTIVE,
        title="Sleep changes",
        description="A caregiver recorded restless sleep and overnight awakenings.",
        signal_ids=[event.id],
        signal_types=["care_event"],
        temporal_start=event.occurred_at,
        temporal_end=event.occurred_at,
        pattern_ids=[],
        change_ids=[],
        confidence=None,
        alternative_interpretations=[],
        context={},
        attention_candidate=False,
        follow_up_candidate=False,
        is_active=True,
    )
    db.add(situation)
    db.commit()
finally:
    db.close()
`;
  execFileSync(
    "python",
    ["-c", seed, identity.personId, dailyCaptureEventId, situationId],
    { cwd: "backend-service/backend", env: process.env, stdio: "pipe" },
  );

  const persisted = await request(
    `/api/v1/change/situations/${identity.personId}`,
    { token: identity.token },
  );
  assert.equal(persisted.status, 200, JSON.stringify(persisted.payload));
  assert.ok(persisted.payload.some((row) => row.id === situationId));

  const { context, page } = await createBrowserPage(session, "/workspace/care-continuity");
  await page.getByText("Earlier care history", { exact: true }).click();
  const situationCard = page.locator("article.lcr-timeline-item").filter({
    hasText: "Sleep changes",
  });
  await situationCard.waitFor({ state: "visible", timeout: 20_000 });
  await situationCard.getByRole("button", { name: "Review related notes and documents", exact: true }).click();
  await situationCard.getByText("restless sleep and three overnight awakenings", { exact: false })
    .waitFor({ timeout: 15_000 });

  const reason = "The caregiver reports the sleep disruption is worse than the previous night.";
  await situationCard.getByLabel("Caregiver-reported status").selectOption("worsening");
  await situationCard.getByLabel("Reason for this status (required)").fill(reason);
  await situationCard.getByRole("button", { name: "Save status", exact: true }).click();
  await situationCard.getByText("Previous status updates (1)", { exact: true })
    .waitFor({ timeout: 20_000 });
  await situationCard.getByText("Caregiver reports worsening", { exact: true }).waitFor();
  await situationCard.getByText(reason, { exact: true }).waitFor();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Earlier care history", { exact: true }).click();
  const reloadedCard = page.locator("article.lcr-timeline-item").filter({
    hasText: "Sleep changes",
  });
  await reloadedCard.getByText("Previous status updates (1)", { exact: true })
    .waitFor({ timeout: 20_000 });
  await reloadedCard.getByText(reason, { exact: true }).waitFor();
  await verifyMobile(page);
  await context.close();
});

await record("13 identity isolation across private care records", async () => {
  assert.ok(dailyCaptureEventId, "identity isolation requires an existing private care event");
  const foreignSession = await newSession("identity isolation");
  const foreignToken = foreignSession.access_token;

  const foreignEvents = await request(`/api/v1/events/${encodeURIComponent(identity.personId)}`, {
    token: foreignToken,
  });
  assert.equal(foreignEvents.status, 403, JSON.stringify(foreignEvents.payload));

  const foreignEvidence = await request(`/api/v1/evidence/${encodeURIComponent(identity.personId)}`, {
    token: foreignToken,
  });
  assert.equal(foreignEvidence.status, 403, JSON.stringify(foreignEvidence.payload));

  const foreignLcr = await request("/api/v1/care-continuity/current-care?limit_per_source=50", {
    token: foreignToken,
  });
  assert.equal(foreignLcr.status, 200, JSON.stringify(foreignLcr.payload));
  assert.equal(
    JSON.stringify(foreignLcr.payload).includes(dailyCaptureEventId),
    false,
    "a different caregiver session must never receive another person's event in its LCR",
  );
});

await record("14 privacy deletion request remains pending until independent review and verified fulfilment", async () => {
  const deletionSession = await newSession("privacy deletion boundary");
  const token = deletionSession.access_token;
  const personId = deletionSession.person.id;

  const submitted = await request("/api/v1/privacy/requests", {
    token,
    method: "POST",
    body: {
      request_type: "deletion",
      authority_basis: "self",
      authority_attested: true,
      note: "Synthetic acceptance test; verify request intake does not delete data automatically.",
    },
  });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.payload));
  assert.equal(submitted.payload.request_type, "deletion");
  assert.equal(submitted.payload.status, "received_pending_authority_review");
  assert.equal(submitted.payload.authority_verified, false);
  assert.equal(submitted.payload.fulfilment_started, false);

  const listed = await request("/api/v1/privacy/requests", { token });
  assert.equal(listed.status, 200, JSON.stringify(listed.payload));
  assert.ok(listed.payload.requests.some((item) => item.id === submitted.payload.id));

  const stillPresent = await request(`/api/v1/persons/${encodeURIComponent(personId)}`, { token });
  assert.equal(stillPresent.status, 200, JSON.stringify(stillPresent.payload));
});



await record("15 synthetic privacy deletion erases the caregiver record and original document bytes", async () => {
  const deletionSession = await newSession("verified privacy deletion");
  const token = deletionSession.access_token;
  const personId = deletionSession.person.id;
  const caregiverId = deletionSession.caregiver.id;
  const evidenceForm = new FormData();
  evidenceForm.append("person_id", personId);
  evidenceForm.append("caregiver_id", caregiverId);
  evidenceForm.append("evidence_type", "document");
  evidenceForm.append(
    "file",
    new Blob(["Synthetic deletion verification record. This file must be erased with the care record."], { type: "text/plain" }),
    "synthetic-privacy-deletion.txt",
  );
  const uploaded = await request("/api/v1/upload", { token, method: "POST", form: evidenceForm });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.payload));
  const evidenceId = uploaded.payload.evidence_id;
  assert.ok(evidenceId, "the synthetic upload must have a persisted evidence identifier");

  const submitted = await request("/api/v1/privacy/requests", {
    token,
    method: "POST",
    body: {
      request_type: "deletion",
      authority_basis: "self",
      authority_attested: true,
      note: "Synthetic CI deletion verification; no real caregiver information is present.",
    },
  });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.payload));
  const requestId = submitted.payload.id;
  assert.equal(submitted.payload.status, "received_pending_authority_review");

  const reviewerToken = process.env.SOLENOS_PRIVACY_REVIEWER_TOKEN;
  const deletionReviewerToken = process.env.SOLENOS_PRIVACY_DELETION_REVIEWER_TOKEN;
  assert.ok(reviewerToken && reviewerToken.length >= 32, "CI primary privacy reviewer must be configured");
  assert.ok(deletionReviewerToken && deletionReviewerToken.length >= 32, "CI independent deletion reviewer must be configured");
  assert.notEqual(reviewerToken, deletionReviewerToken);

  const reviewed = await request(`/api/v1/privacy/requests/${requestId}/review`, {
    method: "POST",
    body: {
      decision: "approve",
      review_basis: "Synthetic test record; authority evidence checked for the CI-only session.",
      authority_evidence_checked: "CI generated the record and verified its synthetic self-authority.",
    },
    extraHeaders: { "X-SolenOS-Privacy-Reviewer-Token": reviewerToken },
  });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.payload));
  assert.equal(reviewed.payload.status, "approved_pending_fulfilment_assessment");
  assert.equal(reviewed.payload.fulfilment_started, false);

  const fulfilled = await request(`/api/v1/privacy/requests/${requestId}/fulfil-deletion`, {
    method: "POST",
    body: {
      backup_erasure_verified: true,
      backup_retention_evidence: "The CI PostgreSQL service is ephemeral, isolated to this workflow, and destroyed at workflow completion; no external backup is configured.",
    },
    extraHeaders: { "X-SolenOS-Privacy-Deletion-Reviewer-Token": deletionReviewerToken },
  });
  assert.equal(fulfilled.status, 200, JSON.stringify(fulfilled.payload));
  assert.equal(fulfilled.payload.status, "fulfilled");
  assert.equal(fulfilled.payload.fulfilment.operation, "deletion");
  assert.equal(fulfilled.payload.idempotent_replay, false);

  const replay = await request(`/api/v1/privacy/requests/${requestId}/fulfil-deletion`, {
    method: "POST",
    body: {
      backup_erasure_verified: true,
      backup_retention_evidence: "The CI PostgreSQL service is ephemeral, isolated to this workflow, and destroyed at workflow completion; no external backup is configured.",
    },
    extraHeaders: { "X-SolenOS-Privacy-Deletion-Reviewer-Token": deletionReviewerToken },
  });
  assert.equal(replay.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.idempotent_replay, true);
  assert.equal(replay.payload.fulfilment.receipt_id, fulfilled.payload.fulfilment.receipt_id);

  const revoked = await request(`/api/v1/persons/${encodeURIComponent(personId)}`, { token });
  assert.equal(revoked.status, 401, "the deleted caregiver session must no longer authenticate");

  const verification = JSON.parse(execFileSync("python", ["-c", `
import json, os
from sqlalchemy import create_engine, text
engine = create_engine(os.environ["DATABASE_URL"])
params = {
    "person_id": os.environ["SOLENOS_DELETE_TEST_PERSON_ID"],
    "caregiver_id": os.environ["SOLENOS_DELETE_TEST_CAREGIVER_ID"],
    "evidence_id": os.environ["SOLENOS_DELETE_TEST_EVIDENCE_ID"],
    "request_id": os.environ["SOLENOS_DELETE_TEST_REQUEST_ID"],
    "receipt_id": os.environ["SOLENOS_DELETE_TEST_RECEIPT_ID"],
}
with engine.connect() as connection:
    row = connection.execute(text("""
        SELECT
          (SELECT COUNT(*) FROM persons WHERE id = :person_id) AS persons_remaining,
          (SELECT COUNT(*) FROM caregivers WHERE id = :caregiver_id) AS caregivers_remaining,
          (SELECT COUNT(*) FROM anonymous_sessions WHERE person_id = :person_id OR caregiver_id = :caregiver_id) AS sessions_remaining,
          (SELECT COUNT(*) FROM care_events WHERE person_id = :person_id) AS events_remaining,
          (SELECT COUNT(*) FROM evidence WHERE id = :evidence_id OR person_id = :person_id) AS evidence_remaining,
          (SELECT COUNT(*) FROM evidence_uploads WHERE evidence_id = :evidence_id) AS upload_bytes_remaining,
          (SELECT COUNT(*) FROM data_subject_requests
             WHERE id = :request_id AND request_status = 'fulfilled'
               AND person_id IS NULL AND caregiver_id IS NULL
               AND record_metadata->'fulfilment'->>'operation' = 'deletion') AS redacted_receipts,
          (SELECT COUNT(*) FROM audit_log_events
             WHERE target_id = :receipt_id AND action = 'privacy_request.deletion_fulfilled') AS deletion_audit_receipts
    """), params).mappings().one()
    print(json.dumps(dict(row)))
`], {
    encoding: "utf8",
    env: {
      ...process.env,
      SOLENOS_DELETE_TEST_PERSON_ID: personId,
      SOLENOS_DELETE_TEST_CAREGIVER_ID: caregiverId,
      SOLENOS_DELETE_TEST_EVIDENCE_ID: evidenceId,
      SOLENOS_DELETE_TEST_REQUEST_ID: requestId,
      SOLENOS_DELETE_TEST_RECEIPT_ID: fulfilled.payload.fulfilment.receipt_id,
    },
  }));
  for (const key of [
    "persons_remaining",
    "caregivers_remaining",
    "sessions_remaining",
    "events_remaining",
    "evidence_remaining",
    "upload_bytes_remaining",
  ]) assert.equal(verification[key], 0, `privacy deletion left ${key}: ${JSON.stringify(verification)}`);
  assert.equal(verification.redacted_receipts, 1, JSON.stringify(verification));
  assert.equal(verification.deletion_audit_receipts, 1, JSON.stringify(verification));
});

process.stdout.write(`\nCompleted ${results.length} critical journey checks.\n`);
await browser.close();
