import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const requireLiveQwen = process.env.SOLENOS_REQUIRE_LIVE_QWEN === "1";
const openApiResponse = await fetch(new URL("/openapi.json", backend));
assert.equal(openApiResponse.status, 200, "the isolated backend must expose its active API contract");
const openApi = await openApiResponse.json();
assert.ok(
  openApi.components?.schemas?.QwenAssistRequest?.properties?.source_event_id,
  "Companion assist requests must accept a source-event anchor for LCR-grounded interpretation",
);
const sourceEventIdSchema = openApi.components.schemas.QwenAssistRequest.properties.source_event_id;
const sourceEventIdStringSchema = sourceEventIdSchema.maxLength !== undefined
  ? sourceEventIdSchema
  : sourceEventIdSchema.anyOf?.find((schema) => schema.type === "string");
assert.equal(
  sourceEventIdStringSchema?.maxLength,
  128,
  "source-event anchors must use the same bounded identifier contract as persisted care events",
);
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

async function createBrowserPage(
  session,
  path,
  viewport = { width: 390, height: 844 },
  options = {},
) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((identity) => {
    // window.name survives same-tab navigation but is not browser storage.
    // Do not use sessionStorage here: device cleanup intentionally clears it,
    // and a later navigation must never reseed a revoked credential.
    // Playwright creates an initial about:blank document before navigation.
    // Do not consume the one-time marker there: seed on the real app origin.
    if (location.origin === "null" || location.protocol === "about:") return;
    if (window.name === "solenos-e2e-identity-seeded") return;
    window.name = "solenos-e2e-identity-seeded";
    // Content-free request tracing distinguishes a blocked session bootstrap
    // from a request that reached the backend during browser acceptance.
    if (!window.__solenosE2ETraceInstalled) {
      window.__solenosE2ETraceInstalled = true;
      window.__solenosE2EFetchTrace = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(raw, location.origin);
        const entry = { method: (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase(), path: url.pathname, startedAt: Date.now(), status: null, error: null };
        window.__solenosE2EFetchTrace.push(entry);
        try {
          const response = await originalFetch(input, init);
          entry.status = response.status;
          entry.finishedAt = Date.now();
          return response;
        } catch (error) {
          entry.error = String(error?.message || error).slice(0, 180);
          entry.finishedAt = Date.now();
          throw error;
        }
      };
    }
    localStorage.setItem("solenos_anonymous_access_token", identity.token);
    localStorage.setItem("solenos_backend_person_id", identity.personId);
    localStorage.setItem("solenos_backend_caregiver_id", identity.caregiverId);
    localStorage.setItem("solenos_anonymous_session_expires_at", identity.expiresAt);
    if (identity.failCompanionPointerWrites) {
      window.__solenosCompanionPointerWriteFailures = 0;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith("solenos_companion_session:")) {
          window.__solenosCompanionPointerWriteFailures += 1;
          throw new DOMException("Simulated browser storage quota failure", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    }
  }, {
    token: session.access_token,
    personId: session.person.id,
    caregiverId: session.caregiver.id,
    expiresAt: session.expires_at,
    failCompanionPointerWrites: options.failCompanionPointerWrites === true,
  });
  const page = await context.newPage();
  const observed = [];
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push({
    method: request.method(),
    url: new URL(request.url()).pathname,
    error: request.failure()?.errorText || "request failed",
  }));
  page.on("response", (response) => { const url = new URL(response.url()); if (url.pathname.startsWith("/api/")) observed.push({ path: url.pathname, status: response.status() }); });
  await page.route("**/api/**", async (route) => {
    try {
      // route.fetch() runs outside Chromium and otherwise bypasses
      // browserContext.setOffline(true). Preserve the browser's offline
      // semantics so offline-queue acceptance tests exercise a real failed
      // browser request rather than a successful Node-side proxy request.
      const browserOnline = await page.evaluate(() => navigator.onLine).catch(() => true);
      if (!browserOnline) {
        await route.abort("internetdisconnected");
        return;
      }
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
      // Materialize the upstream body before fulfilling. Passing the APIResponse
      // object through can race with browser navigation/teardown and produce
      // "Fetch response has been disposed" even when the backend answered.
      const responseBody = await response.body();
      const responseHeaders = { ...response.headers() };
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];
      await route.fulfill({
        status: response.status(),
        headers: responseHeaders,
        body: responseBody,
      });
    } catch (error) {
      // Closing a test context may cancel API requests before Playwright reports
      // page.isClosed(). Ignore only that explicit target-closed teardown error.
      const message = String(error?.message || error);
      const targetClosedDuringTeardown = /Target page, context or browser has been closed|TargetClosedError/.test(message);
      // Playwright may invalidate the upstream Fetch response when Chromium
      // aborts an in-flight request during navigation/context teardown. In that
      // case route.fulfill cannot complete, even if request.failure() has not
      // been populated yet. There is no response left to deliver to the browser.
      const responseDisposedDuringAbort = /Fetch response has been disposed/.test(message);
      if (
        page.isClosed() ||
        context.pages().length === 0 ||
        targetClosedDuringTeardown ||
        responseDisposedDuringAbort
      ) return;
      throw error;
    }
  });
  await page.goto(new URL(path, frontend).toString(), { waitUntil: "domcontentloaded" });
  return { context, page, observed, pageErrors, consoleErrors, failedRequests };
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

// 0. First-time caregiver: focused welcome, first capture, durable save, then returning record.
const firstVisitSession = await newSession("first visit capture");
const firstVisitConsent = await request("/api/v1/consent", {
  token: firstVisitSession.access_token,
  method: "POST",
  body: {
    person_id: firstVisitSession.person.id,
    caregiver_id: firstVisitSession.caregiver.id,
    medical_disclaimer_acknowledged: true,
    privacy_model_acknowledged: true,
    multi_caregiver_acknowledged: true,
    no_advertising_acknowledged: true,
    data_improvement_consent: true,
    accepted_terms_version: "2026-10",
  },
});
assert.equal(firstVisitConsent.status, 200, JSON.stringify(firstVisitConsent.payload));
assert.equal(firstVisitConsent.payload.verified, true);
assert.equal(firstVisitConsent.payload.profile?.data_improvement_consent, true);
await record("00 first-time caregiver capture and persisted return", async () => {
  const { context, page, pageErrors } = await createBrowserPage(
    firstVisitSession,
    "/workspace",
    { width: 390, height: 844 },
  );
  let firstVisitAssistStatus = null;
  page.on("pageerror", (error) => console.log("FIRST_VISIT_PAGE_ERROR", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.log("FIRST_VISIT_CONSOLE_ERROR", message.text()); });
  page.on("response", async (response) => {
    const responseUrl = new URL(response.url());
    if (responseUrl.pathname === "/api/v1/assistant/assist") {
      firstVisitAssistStatus = response.status();
      const payload = await response.json().catch(() => null);
      console.log("FIRST_VISIT_ASSIST_RESPONSE", JSON.stringify({
        status: response.status(),
        error: payload?.detail ?? payload?.error ?? null,
      }));
    }
    if (response.status() >= 400) {
      console.log("FIRST_VISIT_HTTP_ERROR", response.status(), response.url());
    }
  });
  await page.getByRole("heading", { name: "Your care journey starts here.", exact: true })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("heading", { name: "What’s been happening?", exact: true })
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("solenos-first-visit-mode"), undefined, { timeout: 5_000 });
  assert.equal(
    await page.locator(".solenos-workspace-breadcrumbs").isVisible(),
    false,
    "first visit should not show a workspace breadcrumb before the caregiver has started",
  );
  assert.equal(
    await page.locator(".solenos-chat-topbar").isVisible(),
    false,
    "first visit should focus on the care entry instead of showing workspace navigation",
  );
  const firstNote = "Mum has been forgetting whether she has eaten breakfast.";
  await page.getByRole("textbox", { name: "Describe your situation", exact: true }).fill(firstNote);
  const captureResponsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/situation" &&
    response.request().method() === "POST",
    { timeout: 30_000 },
  );
  const addToRecordButton = page.getByRole("button", { name: "Add to record", exact: true });
  assert.equal(await addToRecordButton.isEnabled(), true, "the first care entry must be ready to save");
  await addToRecordButton.click();
  let captureResponse;
  try {
    captureResponse = await captureResponsePromise;
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const button = document.querySelector('button[aria-label="Add to record"]');
      const textarea = document.querySelector("textarea");
      return {
        buttonText: button?.innerText ?? null,
        buttonDisabled: button instanceof HTMLButtonElement ? button.disabled : null,
        noteLength: textarea instanceof HTMLTextAreaElement ? textarea.value.length : null,
        accessTokenPresent: Boolean(localStorage.getItem("solenos_anonymous_access_token")),
        accessTokenExpiry: localStorage.getItem("solenos_anonymous_access_expires_at"),
        sessionStorageKeys: Object.keys(sessionStorage),
        sessionRelatedLocalStorageKeys: Object.keys(localStorage).filter((key) =>
          /session|care|person|caregiver|token|expires|revoke/i.test(key)
        ),
        visibleMessages: Array.from(document.querySelectorAll('[role="alert"], [role="status"]'))
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => element.textContent?.trim())
          .filter(Boolean),
        fetchTrace: window.__solenosE2EFetchTrace ?? [],
        sessionBootstrapMeasures: performance.getEntriesByName("solenos.session.bootstrap").map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
      };
    });
    console.error("FIRST_VISIT_SUBMIT_DIAGNOSTIC", JSON.stringify(diagnostic));
    throw error;
  }
  const capturePayload = await captureResponse.json().catch(() => null);
  const persistedEventRead = await request(
    `/api/v1/events/${encodeURIComponent(firstVisitSession.person.id)}`,
    { token: firstVisitSession.access_token },
  );
  const persistedEvents = Array.isArray(persistedEventRead.payload) ? persistedEventRead.payload : [];
  const capturedEvent = persistedEvents.find((event) => event?.id === capturePayload?.care_event_id);
  assert.equal(persistedEventRead.status, 200, JSON.stringify(persistedEventRead.payload));
  assert.ok(capturedEvent, "the saved capture event must be retrievable from the authenticated event-history API");
  assert.equal(capturedEvent.person_id, firstVisitSession.person.id);
  assert.ok(
    [capturedEvent.title, capturedEvent.description].some((value) =>
      typeof value === "string" && value.includes(firstNote)
    ),
    "the persisted event must retain the caregiver's original note",
  );
  assert.equal(capturePayload?.qwen_extraction_status, "queued", "a saved free-text care report must receive a durable extraction job");
  assert.equal(typeof capturePayload?.qwen_analysis_id, "string", "the capture receipt must identify its persisted analysis");
  assert.ok(capturePayload.qwen_analysis_id, "the persisted analysis ID must not be empty");
  assert.equal(typeof capturePayload?.qwen_job_id, "string", "the capture receipt must identify its durable background job");
  assert.ok(capturePayload.qwen_job_id, "the durable background job ID must not be empty");
  assert.deepEqual(capturePayload?.qwen_job_ids, [capturePayload.qwen_job_id], "the response must expose the complete queued job list");
  assert.equal(capturePayload?.care_continuity_execution?.workflow, "situation_capture");
  assert.equal(capturePayload?.care_continuity_execution?.stages?.extraction, "queued");
  assert.equal(capturePayload?.care_continuity_execution?.stages?.reconciliation, "pending");
  assert.equal(capturePayload?.care_continuity_execution?.stages?.longitudinal_retrieval, "not_verified");
  assert.equal(capturePayload?.qwen_written_to_lcr, false, "model suggestions must not be written directly to the Living Care Record");
  console.log("FIRST_VISIT_CAPTURE_RESPONSE", JSON.stringify({
    status: captureResponse.status(),
    keys: Object.keys(capturePayload ?? {}),
    ok: capturePayload?.ok,
    person_id: capturePayload?.person_id,
    care_recipient_id: capturePayload?.care_recipient_id,
    caregiver_id: capturePayload?.caregiver_id,
    care_session_id: capturePayload?.care_session_id,
    care_event_id: capturePayload?.care_event_id,
    has_context_root: capturePayload?.has_context_root,
    active_care_situation: capturePayload?.active_care_situation ? {
      keys: Object.keys(capturePayload.active_care_situation),
      subject_label: capturePayload.active_care_situation.subject_label,
      theme: capturePayload.active_care_situation.theme,
      understanding_stage: capturePayload.active_care_situation.understanding_stage,
      observations_count: capturePayload.active_care_situation.observations?.length,
      first_observation_keys: Object.keys(capturePayload.active_care_situation.observations?.[0] ?? {}),
      first_raw_text_type: typeof capturePayload.active_care_situation.observations?.[0]?.raw_text,
      first_human_fact_type: typeof capturePayload.active_care_situation.observations?.[0]?.human_fact,
    } : null,
    active_care_situation_turn: capturePayload?.active_care_situation_turn ? {
      keys: Object.keys(capturePayload.active_care_situation_turn),
      relation: capturePayload.active_care_situation_turn.relation,
      situation_keys: Object.keys(capturePayload.active_care_situation_turn.situation ?? {}),
      what_needs_context: capturePayload.active_care_situation_turn.what_needs_context,
    } : null,
  }));
  await page.waitForTimeout(2_000);
  console.log("FIRST_VISIT_CAPTURE_DOM", await page.locator("body").innerText());
  console.log("FIRST_VISIT_CAPTURE_STATE", await page.locator(".cognitive-workspace").getAttribute("class").catch(() => null));
  // The saved original note is the durable first-visit success criterion; the page title may remain unchanged.
  await page.locator(".care-card-note-body").getByText(firstNote, { exact: true })
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".situation-response").waitFor({ state: "visible", timeout: 15_000 });
  const contextInterpretationRegion = page.getByRole("region", { name: "Possible explanation for this update", exact: true });
  await contextInterpretationRegion.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(() => {
    const region = document.querySelector('[aria-label="Possible explanation for this update"]');
    const text = region?.textContent ?? "";
    return text.includes("We couldn’t connect this update with earlier care information right now.")
      || text.includes("Suggested explanation for you to review.");
  }, undefined, { timeout: 30_000 });
  const contextInterpretationText = await contextInterpretationRegion.innerText();
  assert.ok(firstVisitAssistStatus !== null, "the first saved observation must trigger the read-only Companion interpretation request");
  assert.notEqual(firstVisitAssistStatus, 413, "a first-visit question must not be rejected because retrieval metadata exceeds the model context budget");
  assert.match(contextInterpretationText, /Your Care Record is unchanged\./,
    "the optional interpretation must never imply that it changed the Care Record");
  assert.match(contextInterpretationText, /You do not need to add the update again\./,
    "an unavailable interpretation must not encourage duplicate care-record submissions");

  assert.equal(
    await page.locator(".care-card-understanding").count(),
    0,
    "first capture must not show Clarity when no grounded interpretation is available",
  );
  await page.getByText("What else have you noticed alongside this?", { exact: true })
    .waitFor({ state: "visible", timeout: 10_000 });
  const firstCaptureUnderstanding = await page.locator(".lcr-recognition").innerText();
  assert.match(
    firstCaptureUnderstanding,
    /first update about E2E first visit capture/i,
    "one first-capture observation must be described as one update",
  );
  assert.doesNotMatch(firstCaptureUnderstanding, /several care concerns/i);
  const firstCaptureRecordText = await page.locator(".living-care-record-panel").innerText();
  assert.doesNotMatch(
    firstCaptureRecordText,
    /Keep tracking: Mum has been forgetting whether she has eaten breakfast/i,
    "the record must not turn the original note into a repetitive next action",
  );
  assert.equal(await page.getByText("Your original note is still saved.", { exact: false }).count(), 0, "the first care summary should render rather than fall back to a summary error");

  const helpfulFeedback = page.getByRole("button", { name: "Helpful", exact: true });
  await helpfulFeedback.waitFor({ state: "visible", timeout: 15_000 });
  const feedbackResponsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/feedback" &&
    response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await helpfulFeedback.click();
  const feedbackResponse = await feedbackResponsePromise;
  const feedbackPayload = await feedbackResponse.json().catch(() => null);
  assert.equal(feedbackResponse.status(), 200, JSON.stringify(feedbackPayload));
  assert.equal(feedbackPayload?.event_type, "feedback");
  assert.equal(feedbackPayload?.source_type, "feedback");
  await page.locator(".research-feedback-thanks").waitFor({ state: "visible", timeout: 10_000 });
  // Saved history is grouped under More in the simplified caregiver navigation.
  // Verify the durable history row there, then return to Today for the rest of this journey.
  await page.goto(new URL("/workspace/more", frontend).toString());
  await page.getByRole("heading", { name: "Recent care history", exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
  const savedHistoryRecord = page.locator(".history-event-list .history-event-open")
    .filter({ hasText: firstNote }).first();
  await savedHistoryRecord.waitFor({ state: "visible", timeout: 15_000 });
  await page.goto(new URL("/workspace", frontend).toString());
  await page.getByRole("heading", { name: "Today", exact: true })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("heading", { name: "Your Care Record", exact: true }).first()
    .waitFor({ state: "visible", timeout: 15_000 });
  for (const heading of ["Your care information", "What matters now", "What’s changed"]) {
    await page.getByRole("heading", { name: heading, exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  }
  const firstVisitPersonId = String(firstVisitSession.person?.id ?? "").trim();
  assert.ok(firstVisitPersonId, "anonymous session must return its server-issued care-record ID");
  const learningEventsPath = `/api/v1/learning-events/${encodeURIComponent(firstVisitPersonId)}?person_id=${encodeURIComponent(firstVisitPersonId)}`;
  console.log("FIRST_VISIT_LEARNING_EVENTS_READ", JSON.stringify({
    path: learningEventsPath,
    session_person_id_present: Boolean(firstVisitPersonId),
  }));
  const persistedFeedbackEvents = await request(
    learningEventsPath,
    { token: firstVisitSession.access_token },
  );
  assert.equal(persistedFeedbackEvents.status, 200, JSON.stringify(persistedFeedbackEvents.payload));
  assert.ok(
    persistedFeedbackEvents.payload.some((event) => event.event_type === "feedback" && event.source_type === "feedback"),
    "explicit caregiver feedback must persist through the consent-gated backend contract",
  );

  const browserIdentity = await page.evaluate(() => ({
    tokenPresent: Boolean(localStorage.getItem("solenos_anonymous_access_token")),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
    careSessionId: localStorage.getItem("solenos_care_session_id"),
  }));
  console.log("FIRST_VISIT_BROWSER_IDENTITY", JSON.stringify(browserIdentity));
  const careSessionId = browserIdentity.careSessionId;
  assert.ok(careSessionId, "first capture must retain the interaction session identity");
  const persisted = await request(
    `/api/situation?caregiver_id=${encodeURIComponent(browserIdentity.caregiverId ?? "")}&care_session_id=${encodeURIComponent(careSessionId)}&offer_return_invite=0`,
    { token: firstVisitSession.access_token },
  );
  assert.equal(persisted.status, 200, JSON.stringify(persisted.payload));
  console.log("FIRST_VISIT_PERSISTED_READ", JSON.stringify({
    care_recipient_id: persisted.payload?.care_recipient_id,
    has_context_root: persisted.payload?.has_context_root,
    total_events: persisted.payload?.total_events,
    observations: persisted.payload?.observations?.length,
    browser_person_id: browserIdentity.personId,
    bootstrap_person_id: firstVisitSession.person.id,
  }));
  assert.equal(persisted.payload?.has_context_root, true, "first capture must create durable care context");
  assert.ok((persisted.payload?.total_events ?? 0) > 0, "first capture must be retrievable as a persisted event");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Today", exact: true })
    .waitFor({ state: "visible", timeout: 20_000 });
  for (const heading of ["Your care information", "What matters now", "What’s changed"]) {
    await page.getByRole("heading", { name: heading, exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  }
  await page.getByText("More about your Care Record — follow-ups, details and history", { exact: true }).click();
  for (const heading of ["What happened", "Your care history"]) {
    await page.getByRole("heading", { name: heading, exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  }
  await page.waitForFunction(() => !document.documentElement.classList.contains("solenos-first-visit-mode"));
  assert.equal(
    await page.getByRole("heading", { name: "Your care journey starts here.", exact: true }).count(),
    0,
    "a returning caregiver must not be sent through first-visit welcome again",
  );
  await verifyMobile(page);
  assert.deepEqual(pageErrors, [], `first-visit and returning-caregiver screens must not throw browser errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

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
// This matrix exercises the returning-caregiver workspace, so establish consent
// and one durable care entry before opening Daily Care. The first-visit journey
// above independently verifies the empty-record experience.
let session = await newSession("critical journey matrix");
const identity = auth(session);
const matrixConsent = await request("/api/v1/consent", {
  token: identity.token,
  method: "POST",
  body: {
    person_id: identity.personId,
    caregiver_id: identity.caregiverId,
    medical_disclaimer_acknowledged: true,
    privacy_model_acknowledged: true,
    multi_caregiver_acknowledged: true,
    no_advertising_acknowledged: true,
    data_improvement_consent: true,
    accepted_terms_version: "2026-10",
  },
});
assert.equal(matrixConsent.status, 200, JSON.stringify(matrixConsent.payload));
assert.equal(matrixConsent.payload.verified, true);
const matrixSeed = await request("/api/v1/daily-care/entries", {
  token: identity.token,
  method: "POST",
  body: {
    person_id: identity.personId,
    caregiver_id: identity.caregiverId,
    capture_idempotency_key: randomUUID(),
    capture_kind: "natural_language_update",
    notes: "A saved care update for the returning caregiver journey checks.",
  },
});
assert.equal(matrixSeed.status, 200, JSON.stringify(matrixSeed.payload));
assert.equal(matrixSeed.payload.success, true, JSON.stringify(matrixSeed.payload));
assert.ok(matrixSeed.payload.id, "the returning-caregiver journey requires one persisted care entry");
const unique = (prefix) => `${prefix}-${randomUUID()}`;

await record("01a dementia profile review window and observation persistence are person-scoped", async () => {
  const foreignSession = await newSession("dementia observation isolation");
  const foreign = auth(foreignSession);
  const profileField = "dementia_profile.wandering_getting_lost";
  const conflictingProfileValue = `Conflicting-scope attempt ${randomUUID()}`;
  const conflictingProfileWrite = await request("/api/v1/care-continuity/assertions", {
    token: identity.token,
    method: "POST",
    body: {
      subject_type: "person",
      subject_id: identity.personId,
      field: profileField,
      assertion_kind: "current_state",
      epistemic_state: "reported",
      asserted_value: conflictingProfileValue,
      source_label: "Caregiver-provided care profile",
      source_text: conflictingProfileValue,
      review_after_days: 90,
      // A conflicting client identity is rejected; it cannot override the bearer session.
      person_id: foreign.personId,
    },
  });
  assert.equal(conflictingProfileWrite.status, 403, JSON.stringify(conflictingProfileWrite.payload));
  assert.match(JSON.stringify(conflictingProfileWrite.payload), /Conflicting care-record scope/);

  const profileValue = `Caregiver report ${randomUUID()}`;
  const profileWrite = await request("/api/v1/care-continuity/assertions", {
    token: identity.token,
    method: "POST",
    body: {
      subject_type: "person",
      subject_id: identity.personId,
      field: profileField,
      assertion_kind: "current_state",
      epistemic_state: "reported",
      asserted_value: profileValue,
      source_label: "Caregiver-provided care profile",
      source_text: profileValue,
      review_after_days: 90,
      person_id: identity.personId,
    },
  });
  assert.equal(profileWrite.status, 201, JSON.stringify(profileWrite.payload));
  assert.equal(profileWrite.payload.person_id, identity.personId);
  assert.equal(profileWrite.payload.review_after_days, 90);

  const profileRead = await request(`/api/v1/care-continuity/assertions/${identity.personId}?limit=100`, {
    token: identity.token,
  });
  assert.equal(profileRead.status, 200, JSON.stringify(profileRead.payload));
  assert.ok(profileRead.payload.some((row) =>
    row.field === profileField && row.asserted_value === profileValue && row.review_after_days === 90
  ), "the caregiver-selected review window and profile value must persist");
  assert.ok(!profileRead.payload.some((row) => row.asserted_value === conflictingProfileValue),
    "a conflicting client identity must not create a care assertion");

  const occurredAt = new Date(Date.now() - 60_000).toISOString();
  const conflictingDescription = `Conflicting-scope observation attempt ${randomUUID()}`;
  const conflictingObservationWrite = await request("/api/v1/care-continuity/caregiver-observations", {
    token: identity.token,
    method: "POST",
    body: {
      observation_category: "dementia.wandering",
      description: conflictingDescription,
      observation_type: "direct",
      epistemic_status: "observed",
      observed_at: occurredAt,
      // A conflicting client identity must be rejected, not used for authorization.
      person_id: foreign.personId,
    },
  });
  assert.equal(conflictingObservationWrite.status, 403, JSON.stringify(conflictingObservationWrite.payload));
  assert.match(JSON.stringify(conflictingObservationWrite.payload), /Conflicting care-record scope/);

  const description = `Observed dementia-care event ${randomUUID()}`;
  const observationWrite = await request("/api/v1/care-continuity/caregiver-observations", {
    token: identity.token,
    method: "POST",
    body: {
      observation_category: "dementia.wandering",
      description,
      observation_type: "direct",
      epistemic_status: "observed",
      observed_at: occurredAt,
      person_id: identity.personId,
    },
  });
  assert.equal(observationWrite.status, 201, JSON.stringify(observationWrite.payload));
  assert.equal(observationWrite.payload.person_id, identity.personId);
  assert.equal(observationWrite.payload.reported_by_caregiver_id, identity.caregiverId);
  assert.ok(observationWrite.payload.recorded_at, "server receipt time must be recorded");
  assert.ok(observationWrite.payload.observed_at, "event time must be preserved separately");
  assert.equal(observationWrite.payload.observation_type, "DIRECT");

  const observationRead = await request("/api/v1/care-continuity/caregiver-observations?limit=100", {
    token: identity.token,
  });
  assert.equal(observationRead.status, 200, JSON.stringify(observationRead.payload));
  assert.ok(observationRead.payload.some((row) =>
    row.id === observationWrite.payload.id && row.description === description
  ), "the original observation must be retrievable");
  assert.ok(!observationRead.payload.some((row) => row.description === conflictingDescription),
    "a conflicting client identity must not create an observation");

  const currentCare = await request("/api/v1/care-continuity/current-care", {
    token: identity.token,
  });
  assert.equal(currentCare.status, 200, JSON.stringify(currentCare.payload));
  assert.ok(currentCare.payload.items.some((item) =>
    item.id === observationWrite.payload.id && item.source_collection === "caregiver_observations"
  ), "the saved dementia observation must appear in the existing Living Care Record projection");

  const foreignRead = await request("/api/v1/care-continuity/caregiver-observations?limit=100", {
    token: foreign.token,
  });
  assert.equal(foreignRead.status, 200, JSON.stringify(foreignRead.payload));
  assert.ok(!foreignRead.payload.some((row) => row.id === observationWrite.payload.id),
    "another care record must not retrieve this observation");
  const foreignCorrection = await request(
    `/api/v1/care-continuity/caregiver-observations/${encodeURIComponent(observationWrite.payload.id)}`,
    {
      token: foreign.token,
      method: "PATCH",
      body: { description: "Unauthorized cross-person correction attempt." },
    },
  );
  assert.equal(foreignCorrection.status, 404,
    "another care record must not update or discover this observation");

  const { context, page, observed, pageErrors } = await createBrowserPage(session, "/workspace/care-continuity");
  await page.getByRole("heading", { name: "Your Care Record" }).first().waitFor({ timeout: 20_000 });
  const dementiaDisclosure = page.locator("details.lcr-history-details").filter({
    has: page.getByText("Dementia care profile and observations", { exact: true }),
  });
  const dementiaSummary = dementiaDisclosure.locator(":scope > summary");
  await dementiaSummary.waitFor({ state: "visible", timeout: 10_000 });
  await dementiaSummary.scrollIntoViewIfNeeded();
  await dementiaSummary.click();
  await page.waitForFunction(() => {
    const summary = [...document.querySelectorAll("details.lcr-history-details > summary")]
      .find((item) => item.textContent?.trim() === "Dementia care profile and observations");
    return summary?.parentElement instanceof HTMLDetailsElement && summary.parentElement.open;
  }, undefined, { timeout: 10_000 });
  await page.evaluate(() => {
    window.__personIdChangeEventsAfterStableLoad = 0;
    window.addEventListener("personIdChanged", () => {
      window.__personIdChangeEventsAfterStableLoad += 1;
    });
  });
  await page.getByText("Background and care", { exact: true }).click();
  await page.getByLabel("Diagnosis, if a healthcare professional has shared one status").selectOption("unknown");
  await page.getByLabel("Diagnosis, if a healthcare professional has shared one review interval").selectOption("90");
  await page.getByRole("button", { name: "Save" }).first().click();
  await page.getByText("Saved: Diagnosis, if a healthcare professional has shared one.", { exact: true }).waitFor({ timeout: 20_000 });
  const identityEventsDuringSamePersonSave = await page.evaluate(
    () => window.__personIdChangeEventsAfterStableLoad ?? 0,
  );
  assert.equal(
    identityEventsDuringSamePersonSave,
    0,
    "reusing the active care-record session during a save must not emit a false person-change event",
  );
  await page.getByRole("heading", { name: "Notes about memory and daily life" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("What was this about?").selectOption("wandering");
  const uiDescription = `UI dementia observation ${randomUUID()}`;
  await page.getByLabel("What happened?").fill(uiDescription);
  await page.getByLabel("Who saw or heard this?").selectOption("direct");
  await page.getByLabel("When did it happen? (optional)").fill("2026-11-23T10:15");
  const uiWrite = page.waitForResponse((response) =>
    response.url().includes("/care-continuity/caregiver-observations") &&
    response.request().method() === "POST" && response.status() === 201,
  { timeout: 20_000 });
  await page.getByRole("button", { name: "Save note" }).click();
  const uiWriteResponse = await uiWrite;
  const originalObservation = await uiWriteResponse.json();
  assert.ok(originalObservation.observed_at, "the browser-created observation must preserve its event time");
  await page.getByText(uiDescription, { exact: true }).waitFor({ timeout: 15_000 });
  const observationCard = page.locator("li").filter({ hasText: uiDescription }).last();
  await observationCard.getByRole("button", { name: "Edit note", exact: true }).click();
  assert.equal(
    await observationCard.getByLabel("Topic").inputValue(),
    "wandering",
    "editing a saved observation must remove its stored dementia category prefix",
  );
  const correctedUiDescription = uiDescription + " — corrected after review";
  await observationCard.getByLabel("What happened?").fill(correctedUiDescription);
  const observationCorrection = page.waitForResponse((response) =>
    response.url().includes("/care-continuity/caregiver-observations/") &&
    response.request().method() === "PATCH" && response.status() === 200,
    { timeout: 20_000 },
  );
  await observationCard.getByRole("button", { name: "Save correction", exact: true }).click();
  const observationCorrectionResponse = await observationCorrection;
  const correctionPayload = observationCorrectionResponse.request().postDataJSON();
  assert.equal(
    correctionPayload.observation_category,
    "dementia.wandering",
    "editing must not duplicate the dementia category prefix",
  );
  const correctedEventTime = Date.parse(correctionPayload.observed_at);
  const originalEventTime = Date.parse(originalObservation.observed_at);
  assert.ok(Number.isFinite(correctedEventTime) && Number.isFinite(originalEventTime),
    "both saved event times must remain valid timestamps");
  assert.equal(
    correctedEventTime,
    originalEventTime,
    "editing without changing the event time must preserve the exact instant even if UTC formatting is normalized",
  );
  await page.getByText(correctedUiDescription, { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 15_000 });
  const observationHistory = await request(
    "/api/v1/care-continuity/observation-revisions?limit=100",
    { token: identity.token },
  );
  assert.equal(observationHistory.status, 200, JSON.stringify(observationHistory.payload));
  const savedCorrectionRevision = observationHistory.payload.find((item) =>
    item.observation_id === originalObservation.id && item.revision_number === 2,
  );
  assert.ok(savedCorrectionRevision, "the correction must create a second persisted PostgreSQL observation revision");
  assert.equal(
    savedCorrectionRevision.previous_payload.description,
    uiDescription,
    "the original observation wording must remain in revision history",
  );
  assert.equal(
    savedCorrectionRevision.current_payload.description,
    correctedUiDescription,
    "the corrected observation wording must be stored in the new revision",
  );
  assert.deepEqual(pageErrors, [], `dementia observation UI must not throw: ${JSON.stringify(pageErrors)}`);
  assert.ok(observed.some((item) => item.path.includes("/care-continuity/caregiver-observations") && item.status === 201),
    "the browser must save the observation through the authenticated API proxy");
  await verifyMobile(page);
  await context.close();
});

await record("01b visible Follow-ups link and mobile navigation", async () => {
  const { context, page, pageErrors, consoleErrors, failedRequests } = await createBrowserPage(
    session,
    "/workspace/daily-care",
    { width: 390, height: 844 },
  );
  const followupsSummary = page.locator("details.daily-care-context-panel > summary").filter({ hasText: "Follow-ups" });
  try {
    await followupsSummary.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    const browserState = await page.evaluate(() => ({
      url: location.pathname,
      body: document.body.innerText.slice(0, 1800),
      requests: (window.__solenosE2EFetchTrace || []).slice(-20).map(({ method, path, status, error }) => ({ method, path, status, error })),
      localStorageKeys: Object.keys(localStorage),
      scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean).slice(-12),
    }));
    const diagnostic = { ...browserState, pageErrors, consoleErrors, failedRequests };
    throw new Error(`Daily Care did not render its Follow-ups section: ${JSON.stringify(diagnostic)}`);
  }
  await followupsSummary.click();
  const viewFollowups = page.getByRole("link", { name: "Open Follow-ups", exact: true });
  await viewFollowups.waitFor({ state: "visible", timeout: 20_000 });
  await viewFollowups.click();
  await page.waitForURL("**/workspace/open-loops", { timeout: 20_000 });
  await page.locator(".followups-page h1").getByText("Follow-ups", { exact: true })
    .waitFor({ state: "visible", timeout: 20_000 });
  for (const heading of ["Needs attention", "Being monitored", "Needs clarification"]) {
    await page.getByRole("heading", { name: heading, exact: true })
      .waitFor({ state: "visible", timeout: 10_000 });
  }
  await verifyMobile(page);
  const navigationToggle = page.getByRole("button", { name: "Open navigation", exact: true });
  await navigationToggle.click();
  await page.waitForFunction(() =>
    document.querySelector(".solenos-sidebar-toggle")?.getAttribute("aria-expanded") === "true" &&
    document.querySelector(".solenos-chat-sidebar-host")?.classList.contains("is-sidebar-open") === true
  , undefined, { timeout: 5_000 });
  const primaryNavigation = page.locator("#solenos-navigation");
  const followUpsNavigationLink = primaryNavigation.getByRole("link", { name: /Follow-ups/ });
  await followUpsNavigationLink.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(await followUpsNavigationLink.getAttribute("href"), "/workspace/open-loops");
  const moreNavigationLink = primaryNavigation.getByRole("link", { name: /More/ });
  await moreNavigationLink.waitFor({ state: "visible", timeout: 10_000 });
  await moreNavigationLink.click();
  await page.waitForURL("**/workspace/more", { timeout: 15_000 });
  await page.getByRole("link", { name: /Care Assistant/ }).waitFor({ state: "visible", timeout: 10_000 });
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
const shareAppointment = await request("/api/v1/appointments", {
  token: shareIdentity.token,
  method: "POST",
  body: {
    person_id: shareIdentity.personId,
    title: "Primary care follow-up",
    scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    provider: "Primary care clinician",
    healthcare_org: "E2E clinic",
    preparation_notes: "Discuss recent sleep and appetite observations.",
    status: "scheduled",
    created_by_caregiver_id: shareIdentity.caregiverId,
  },
});
assert.equal(shareAppointment.status, 200, JSON.stringify(shareAppointment.payload));
assert.ok(shareAppointment.payload.id, "appointment briefing journey must start with a persisted appointment");

await record("01c workspace links, browser back, More menu and account form validation", async () => {
  const { context, page, observed } = await createBrowserPage(
    shareSession,
    "/workspace",
    { width: 390, height: 844 },
  );
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor({ timeout: 20_000 });

  const homeHeading = page.locator(".solenos-chat-main .solenos-workspace-page-heading h1").first();
  const defaultHeadingSize = await homeHeading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const displayTrigger = page.getByRole("button", { name: "Display and accessibility settings", exact: true });
  await displayTrigger.click();
  await page.getByRole("radio", { name: "Large", exact: true }).check();
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--solenos-text-scale") === "1.25");
  const largeHeadingSize = await homeHeading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  assert.ok(largeHeadingSize >= defaultHeadingSize * 1.24,
    `Large text preference must scale caregiver workspace typography: ${JSON.stringify({ defaultHeadingSize, largeHeadingSize })}`);
  await verifyMobile(page);
  await page.getByRole("radio", { name: "Default", exact: true }).check();
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--solenos-text-scale") === "1");
  await displayTrigger.click();

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
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor({ timeout: 10_000 });

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
  const shareEntryDialog = page.getByRole("dialog");
  await shareEntryDialog.getByRole("heading", { name: "Prepare a care briefing", exact: true }).waitFor({ timeout: 10_000 });
  await shareEntryDialog.getByRole("button", { name: "Close care briefing", exact: true }).click();

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Download / Export", exact: true }).click();
  const exportDialog = page.getByRole("dialog");
  await exportDialog.getByRole("heading", { name: "Prepare a care briefing", exact: true }).waitFor({ timeout: 10_000 });
  const exportAudience = exportDialog.locator("select").nth(0);
  const exportPurpose = exportDialog.locator("select").nth(1);
  await exportAudience.selectOption("professional");
  await exportPurpose.selectOption("professional_appointment");
  await exportDialog.locator("select").nth(2).locator(`option[value="${shareAppointment.payload.id}"]`).waitFor({ state: "attached", timeout: 10_000 });
  await exportDialog.locator("select").nth(2).selectOption(shareAppointment.payload.id);
  await exportDialog.locator("select").nth(3).selectOption("30");
  const appointmentPrepareButton = exportDialog.getByRole("button", { name: "Prepare summary to share", exact: true });
  const appointmentPrepareState = await page.evaluate(() => ({
    selects: Array.from(document.querySelectorAll("[role=dialog] select")).map(select => ({ value: select.value, disabled: select.disabled, options: Array.from(select.options).map(option => option.value) })),
    buttons: Array.from(document.querySelectorAll("[role=dialog] button")).map(button => ({ text: button.textContent?.trim(), disabled: button.disabled })),
  }));
  assert.equal(await appointmentPrepareButton.isEnabled(), true, "appointment briefing preparation must be enabled after choosing a saved appointment: " + JSON.stringify(appointmentPrepareState));
  assert.equal(appointmentPrepareState.selects[0]?.value, "professional", "the briefing audience must be set to professional");
  assert.equal(appointmentPrepareState.selects[1]?.value, "professional_appointment", "the briefing purpose must be set to appointment");
  assert.equal(appointmentPrepareState.selects[2]?.value, shareAppointment.payload.id, "the selected appointment must be bound to the draft");
  assert.equal(appointmentPrepareState.selects[3]?.value, "30", "the selected history window must be retained");
  // Match the API client 210s request budget plus a 30s browser-observation margin.
  // A shorter Playwright wait reports a false failure while the backend is still
  // retrieving and validating the authoritative LCR snapshot.
  const appointmentBriefingResponse = page.waitForResponse(response =>
    response.url().includes("/api/v1/handoff-drafts/prepare") && response.request().method() === "POST",
    { timeout: 240_000 });
  await appointmentPrepareButton.click();
  let appointmentBriefing;
  try {
    appointmentBriefing = await appointmentBriefingResponse;
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      buttonDisabled: document.querySelector('button')?.disabled ?? null,
      prepareButton: Array.from(document.querySelectorAll("button"))
        .find(button => button.textContent?.includes("Prepare summary to share"))?.outerHTML ?? null,
      visibleAlerts: Array.from(document.querySelectorAll('[role="alert"], [role="status"]'))
        .filter(element => element.getClientRects().length > 0)
        .map(element => element.textContent?.trim()).filter(Boolean),
      sessionTokenPresent: Boolean(localStorage.getItem("solenos_anonymous_access_token")),
      sessionExpiry: localStorage.getItem("solenos_anonymous_session_expires_at"),
      fetchTrace: window.__solenosE2EFetchTrace ?? [],
      sessionBootstrapMeasures: performance.getEntriesByName("solenos.session.bootstrap")
        .map(entry => ({ duration: entry.duration, startTime: entry.startTime })),
    }));
    throw new Error(String(error?.message || error) + " Appointment briefing request diagnostics: " + JSON.stringify(diagnostic));
  }
  assert.equal(appointmentBriefing.status(), 200, "professional appointment briefing must be prepared by the backend");
  const appointmentDraft = await appointmentBriefing.json();
  assert.equal(appointmentDraft.source_of_truth, "living_care_record",
    "Qwen briefing must declare the Living Care Record as its source of truth");
  assert.ok(appointmentDraft.source_snapshot_id && appointmentDraft.source_snapshot_sha256,
    "the appointment briefing must be bound to a versioned LCR source snapshot");
  console.log("APPOINTMENT_BRIEFING_SOURCE_FRESHNESS", JSON.stringify({
    status: appointmentDraft.source_freshness?.status ?? null,
    staleSourceCount: appointmentDraft.source_freshness?.stale_source_count ?? null,
    unknownSourceCount: appointmentDraft.source_freshness?.unknown_source_count ?? null,
    reason: appointmentDraft.source_freshness?.reason ?? null,
  }));
  assert.equal(appointmentDraft.source_freshness?.status, "current",
    "a newly prepared appointment briefing must return its verified source freshness");
  assert.equal(appointmentDraft.appointment_id, shareAppointment.payload.id,
    "appointment briefing must be bound to the selected persisted appointment");
  assert.equal(appointmentDraft.selected_appointment.title, "Primary care follow-up");
  const appointmentSourceRefs = appointmentDraft.source_references.filter(item => item.source_table === "appointments");
  assert.deepEqual(appointmentSourceRefs.map(item => item.source_id), [shareAppointment.payload.id],
    "the appointment briefing must retrieve only the selected appointment, not unrelated visits");
  assert.ok(["generated", "source_only_fallback"].includes(appointmentDraft.generation_status),
    "appointment briefing must use Qwen or a clearly labelled exact-source fallback");
  if (requireLiveQwen) {
    assert.equal(appointmentDraft.generation_status, "generated", JSON.stringify(appointmentDraft));
    assert.equal(appointmentDraft.generation?.provider, "ollama", JSON.stringify(appointmentDraft.generation));
    assert.match(String(appointmentDraft.generation?.model || ""), /qwen/i, JSON.stringify(appointmentDraft.generation));
  }
  if (appointmentDraft.generation_status === "source_only_fallback") {
    assert.ok(appointmentDraft.generation.sections.every(item => item.summary === item.supporting_quote),
      "source-only fallback must not paraphrase or invent care facts");
  }
  assert.equal(appointmentDraft.validation_status, "exact_quote_reference_validation_passed",
    "each generated summary item must include an exact quote from its LCR source");
  await exportDialog.getByRole("heading", { name: "Professional briefing", exact: true }).waitFor({ timeout: 10_000 });
  await exportDialog.getByText(/Allergy information could not be checked from a connected source/).waitFor({ timeout: 10_000 });
  await exportDialog.getByText(/No medication record does not mean none are being taken/).waitFor({ timeout: 10_000 });
  assert.equal(appointmentDraft.source_statuses.allergies.status, "unavailable",
    "missing allergy integration must be explicit and must not be interpreted as no allergies");
  assert.equal(await exportDialog.getByRole("checkbox", {
    name: /I checked each detail against the saved note or document, including its date and what is still unclear\\. I understand that SolenOS does not independently verify every summary statement/,
  }).count(), 0, "professional briefings remain private review/export and must not expose the family-sharing approval control");
  const appointmentClaimReview = exportDialog.getByRole("checkbox", { name: /I checked “.*” against its saved source wording, dates and what is still unclear/ });
  const appointmentClaimReviewCount = await appointmentClaimReview.count();
  // Professional appointment exports intentionally exclude caregiver-profile
  // claims. The UI's caregiver-visible projection is the review boundary; do not
  // demand a checkbox for a source that must not be shown to the professional.
  const appointmentExportSections = appointmentDraft.generation.sections.filter(
    item => !String(item.source_ref || "").startsWith("caregiver_profiles:"),
  );
  const expectedAppointmentClaimReviewCount = new Set(
    appointmentExportSections.map(item => item.source_ref),
  ).size;
  assert.equal(
    appointmentClaimReviewCount,
    expectedAppointmentClaimReviewCount,
    `professional appointment export must require a separate review for every caregiver-visible source claim: ${JSON.stringify({
      actualReviewControls: appointmentClaimReviewCount,
      expectedSourceClaims: expectedAppointmentClaimReviewCount,
      sourceRefs: appointmentExportSections.map(item => item.source_ref),
    })}`,
  );
  for (let index = 0; index < await appointmentClaimReview.count(); index += 1) {
    await appointmentClaimReview.nth(index).check();
  }
  await exportDialog.getByRole("checkbox", { name: /I understand this is a draft prepared with help from SolenOS/ }).check();
  const summaryDownloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "Download summary (.txt)", exact: true }).click();
  const summaryDownload = await summaryDownloadPromise;
  assert.match(summaryDownload.suggestedFilename(), /^solenos-care-briefing-\d{4}-\d{2}-\d{2}\.txt$/,
    "the professional appointment briefing export must have a dated filename");
  const summaryPath = await summaryDownload.path();
  const summaryText = await readFile(summaryPath, "utf8");
  assert.match(summaryText, /Based on: your Care Record/,
    "the exported briefing must identify the LCR as its source");
  assert.match(summaryText, /Words from your saved note or document:/,
    "the exported briefing must preserve supporting LCR wording");
  assert.match(summaryText, /Caregiver reports that Mum slept poorly last night and seemed unsettled this morning/,
    "structured care notes must export as the original caregiver observation");
  assert.doesNotMatch(summaryText, /capture_idempotency_key|capture_request_fingerprint|critical_care_journey_share_seed|test-fingerprint/,
    "exported briefings must not expose capture identifiers or internal source metadata");
  assert.doesNotMatch(summaryText, /Browser integration caregiver|FAMILY — ACTIVE — UNKNOWN/,
    "professional appointment briefings must not present caregiver profile records as care history");
  assert.ok(summaryText.length > 100, "the downloaded professional briefing must contain reviewed care information");
  await exportDialog.getByRole("button", { name: "Close care briefing", exact: true }).click();

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Download / Export", exact: true }).click();
  const professionalDialog = page.getByRole("dialog");
  await professionalDialog.getByRole("heading", { name: "Prepare a care briefing", exact: true }).waitFor({ timeout: 10_000 });
  await professionalDialog.locator("select").nth(0).selectOption("professional");
  await professionalDialog.locator("select").nth(1).selectOption("period_summary");
  await professionalDialog.locator("select").nth(2).selectOption("30");
  const professionalBriefingResponse = page.waitForResponse(response =>
    response.url().includes("/api/v1/handoff-drafts/prepare") && response.request().method() === "POST",
    { timeout: 240_000 });
  await professionalDialog.getByRole("button", { name: "Prepare summary to share", exact: true }).click();
  const professionalBriefing = await professionalBriefingResponse;
  assert.equal(professionalBriefing.status(), 200, "professional care briefing must be prepared by the backend");
  const professionalDraft = await professionalBriefing.json();
  assert.equal(professionalDraft.audience, "professional");
  assert.equal(professionalDraft.purpose, "period_summary");
  assert.equal(professionalDraft.source_of_truth, "living_care_record");
  assert.ok(["generated", "source_only_fallback"].includes(professionalDraft.generation_status));
  if (requireLiveQwen) {
    assert.equal(professionalDraft.generation_status, "generated", JSON.stringify(professionalDraft));
    assert.equal(professionalDraft.generation?.provider, "ollama", JSON.stringify(professionalDraft.generation));
    assert.match(String(professionalDraft.generation?.model || ""), /qwen/i, JSON.stringify(professionalDraft.generation));
  }
  assert.equal(professionalDraft.appointment_id, null,
    "a general professional briefing must not be silently bound to an appointment");
  await professionalDialog.getByRole("heading", { name: "Professional briefing", exact: true }).waitFor({ timeout: 10_000 });
  await professionalDialog.getByRole("button", { name: "Close care briefing", exact: true }).click();

  actionMenu = await openMoreMenu();
  await actionMenu.getByRole("menuitem", { name: "Share care summary", exact: true }).click();
  const familyDialog = page.getByRole("dialog");
  await familyDialog.getByRole("heading", { name: "Prepare a care briefing", exact: true }).waitFor({ timeout: 10_000 });
  await familyDialog.locator("select").nth(0).selectOption("family");
  await familyDialog.locator("select").nth(1).selectOption("period_summary");
  await familyDialog.locator("select").nth(2).selectOption("30");
  const familyBriefingResponse = page.waitForResponse(response =>
    response.url().includes("/api/v1/handoff-drafts/prepare") && response.request().method() === "POST",
    { timeout: 240_000 });
  await familyDialog.getByRole("button", { name: "Prepare summary to share", exact: true }).click();
  const familyBriefing = await familyBriefingResponse;
  assert.equal(familyBriefing.status(), 200, "family care briefing must be prepared by the backend");
  const familyDraft = await familyBriefing.json();
  assert.equal(familyDraft.source_of_truth, "living_care_record");
  assert.ok(["current", "stale", "unknown"].includes(familyDraft.source_freshness?.status),
    "a family briefing must return an explicit source-freshness result; uncertain or changed sources must not be treated as current");
  assert.ok(["generated", "source_only_fallback"].includes(familyDraft.generation_status),
    "family briefing must use Qwen or a clearly labelled exact-source fallback");
  if (requireLiveQwen) {
    assert.equal(familyDraft.generation_status, "generated", JSON.stringify(familyDraft));
    assert.equal(familyDraft.generation?.provider, "ollama", JSON.stringify(familyDraft.generation));
    assert.match(String(familyDraft.generation?.model || ""), /qwen/i, JSON.stringify(familyDraft.generation));
  }
  if (familyDraft.generation_status === "source_only_fallback") {
    assert.ok(familyDraft.generation.sections.every(item => item.summary === item.supporting_quote),
      "source-only family fallback must preserve saved wording without paraphrase");
  }
  await familyDialog.getByRole("heading", { name: "Review and share with family", exact: true }).waitFor({ timeout: 10_000 });
  await familyDialog.getByText(/Allergy information could not be checked from a connected source/).waitFor({ timeout: 10_000 });
  const expectedFamilyFreshnessLabel = familyDraft.source_freshness.status === "current"
    ? /Last check: Up to date/i
    : familyDraft.source_freshness.status === "stale"
      ? /Last check: May be out of date/i
      : /Last check: Not checked/i;
  await familyDialog.getByText(expectedFamilyFreshnessLabel).waitFor({ timeout: 15_000 });
  if (familyDraft.source_freshness.status !== "current") {
    await familyDialog.getByRole("alert").filter({ hasText: /Prepare a new draft before sharing/ }).waitFor({ timeout: 10_000 });
  } else {
    assert.equal(
      await familyDialog.getByRole("alert").filter({ hasText: /Prepare a new draft before sharing/ }).count(),
      0,
      "a current draft must not show the out-of-date warning",
    );
  }
  assert.ok((await familyDialog.locator("#companion-handoff-share-text").inputValue()).length > 100,
    "family briefing must contain actual LCR-derived content");
  assert.equal(await familyDialog.getByRole("checkbox", {
    name: /I checked each detail against the saved note or document, including its date and what is still unclear\. I understand that SolenOS does not independently verify every summary statement/,
  }).count(), 1, "family sharing must require explicit review of the source-linked statements");
  const familyClaimReviewCount = await familyDialog.getByRole("checkbox", {
    name: /I checked this summary item against the saved wording, dates and what is known or still uncertain/,
  }).count();
  assert.equal(familyClaimReviewCount, new Set(familyDraft.generation.sections.map(item => item.source_ref)).size,
    "every distinct LCR source claim must have its own review acknowledgement before sharing");
  if (familyClaimReviewCount >= 2) {
    const familySourceReviews = familyDialog.getByRole("checkbox", {
      name: /I checked this summary item against the saved wording, dates and what is known or still uncertain/,
    });
    await familySourceReviews.first().check();
    const removeSectionButtons = familyDialog.getByRole("button", { name: "Remove section from this draft", exact: true });
    await removeSectionButtons.last().click();
    await page.waitForFunction(() => {
      const checks = Array.from(document.querySelectorAll('[role="dialog"] input[type="checkbox"]'))
        .filter(input => input.parentElement?.textContent?.includes("I checked this summary item against the saved wording"));
      return checks.length > 0 && checks.every(input => !input.checked);
    }, undefined, { timeout: 5_000 });
    assert.equal(await familySourceReviews.count(), familyClaimReviewCount - 1,
      "removing a briefing item must remove it from the current review set");
  }
  await familyDialog.getByRole("button", { name: "Close care briefing", exact: true }).click();

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
    "/workspace/appointments",
    "/workspace/more",
  ];
  for (const route of expectedRoutes) {
    assert.ok(links.includes(route), `primary navigation is missing ${route}`);
  }
  assert.ok(!links.includes("/workspace/companion"), "Care Assistant must remain under More, not in primary navigation");
  await navigation.getByRole("link", { name: /More/ }).click();
  await page.waitForURL("**/workspace/more", { timeout: 15_000 });
  const moreTools = page.getByRole("navigation", { name: "More care record tools", exact: true });
  await moreTools.waitFor({ state: "visible", timeout: 10_000 });
  const careAssistantLink = moreTools.getByRole("link", { name: /Care Assistant/ });
  await careAssistantLink.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(await careAssistantLink.getAttribute("href"), "/workspace/companion");
  await moreTools.getByRole("link", { name: /Documents/ }).click();
  await page.waitForURL("**/workspace/documents", { timeout: 15_000 });
  await page.getByRole("heading", { name: "Documents", exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await navigation.getByRole("link", { name: /More/ }).getAttribute("aria-current"),
    "page",
    "More stays selected while a secondary destination is open",
  );
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL("**/workspace", { timeout: 15_000 });
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor({ timeout: 15_000 });
  await verifyMobile(page);

  await page.goto(new URL("/workspace/settings", frontend).toString(), { waitUntil: "domcontentloaded" });
  const accountSection = page.locator("#settings-account");
  // Details disclosure state may be preserved by browser history or restored
  // from the prior workspace route. Open it idempotently instead of toggling
  // blindly and accidentally hiding the account controls.
  await accountSection.evaluate((element) => {
    if (element instanceof HTMLDetailsElement && !element.open) element.open = true;
  });
  try {
    await accountSection.getByRole("button", { name: "Create account", exact: true }).waitFor({ timeout: 15_000 });
  } catch (error) {
    const state = await page.evaluate(() => {
      const section = document.querySelector("#settings-account");
      return {
        accountSectionOpen: section instanceof HTMLDetailsElement ? section.open : null,
        accountSectionText: section?.textContent?.trim().slice(0, 1200) ?? null,
        accountControls: Array.from(section?.querySelectorAll("button") ?? []).map((button) => ({
          text: button.textContent?.trim() ?? "",
          disabled: button.disabled,
          visible: Boolean(button.getClientRects().length),
        })),
        localStorageKeys: Object.keys(localStorage).filter((key) => /session|care|person|caregiver|token|expires|revoke/i.test(key)),
      };
    });
    throw new Error(`Account controls did not reach the expected anonymous-session state: ${JSON.stringify(state)}; ${String(error)}`);
  }
  await accountSection.getByRole("button", { name: "Create account", exact: true }).click();
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
  const accountEmail = `caregiver-${randomUUID()}@example.test`;
  const accountPassword = "SolenOS-account-passphrase-2026!";
  const recoveredPassword = "SolenOS-recovered-passphrase-2026!";
  await email.fill(accountEmail);
  await password.fill(accountPassword);
  assert.equal(await accountForm.evaluate((form) => form.checkValidity()), true,
    "a correctly formatted email and 12+ character password must pass browser validation");
  await accountSection.getByText(/SolenOS does not verify email addresses or send password-reset emails/).waitFor();
  await accountForm.getByRole("button", { name: "Create account", exact: true }).click();
  await accountSection.getByText("Account created and linked to your Care Record.", { exact: true }).waitFor({ timeout: 20_000 });
  const initialRecoveryCode = (await accountSection.locator("code").first().textContent())?.trim() || "";
  assert.ok(initialRecoveryCode.length >= 32, "account creation must issue a one-time recovery code");
  await accountSection.getByRole("button", { name: "I have saved the code", exact: true }).click();

  await accountSection.getByRole("button", { name: "Sign out", exact: true }).click();
  await accountSection.getByText(/Signed out securely\. Your Care Record is still saved/).waitFor({ timeout: 15_000 });
  await accountSection.getByRole("button", { name: "Sign in to an existing account", exact: true }).click();
  let authForm = accountSection.locator("form").filter({ has: accountSection.locator("#account-email") });
  await authForm.locator("#account-email").fill(accountEmail);
  await authForm.locator("#account-password").fill(accountPassword);
  await authForm.getByRole("button", { name: "Sign in", exact: true }).click();
  await accountSection.getByText("Signed in. Your existing Care Record is available.", { exact: true }).waitFor({ timeout: 20_000 });

  await accountSection.getByRole("button", { name: "Sign out", exact: true }).click();
  await accountSection.getByText(/Signed out securely\. Your Care Record is still saved/).waitFor({ timeout: 15_000 });
  const securitySection = page.locator("#settings-security");
  await securitySection.locator("summary").click();
  await page.locator("#identity-recovery-email").fill(accountEmail);
  await page.locator("#identity-recovery-code").fill(initialRecoveryCode);
  await page.locator("#identity-recovery-password").fill(recoveredPassword);
  await securitySection.getByRole("button", { name: "Restore account access", exact: true }).click();
  await securitySection.getByText("Your account is ready. You are signed in on this device.", { exact: true }).waitFor({ timeout: 20_000 });
  const replacementRecoveryCode = (await securitySection.locator("code").first().textContent())?.trim() || "";
  assert.ok(replacementRecoveryCode.length >= 32, "fresh-browser recovery must issue a replacement one-time recovery code");
  const recoveredIdentity = await page.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.equal(recoveredIdentity.personId, shareSession.person.id,
    "recovery must restore the original Care Record rather than create a new one");
  assert.equal(recoveredIdentity.caregiverId, shareSession.caregiver.id,
    "recovery must restore the original caregiver identity");

  await page.reload({ waitUntil: "domcontentloaded" });
  await accountSection.locator("summary").click();
  await accountSection.getByRole("button", { name: "Delete account", exact: true }).waitFor({ timeout: 20_000 });
  await accountSection.getByRole("button", { name: "Delete account", exact: true }).click();
  const deleteAccountForm = accountSection.locator("form");
  await deleteAccountForm.locator("#account-password").fill(recoveredPassword);
  await deleteAccountForm.getByRole("button", { name: "Delete account", exact: true }).click();
  await accountSection.getByText("Account deleted. Your Care Record and care history were not deleted.", { exact: true }).waitFor({ timeout: 20_000 });
  const revokedAccountSession = await request(
    `/api/v1/persons/${encodeURIComponent(shareSession.person.id)}`,
    { token: recoveredIdentity.token },
  );
  assert.equal(revokedAccountSession.status, 401,
    "deleting the account login must revoke its sessions without deleting the Care Record");
  await context.close();

  // Test local workspace deletion with a disposable identity, never the shared
  // caregiver fixture used by the remaining acceptance journeys.
  const disposableSession = await newSession("more-menu local deletion");
  const disposableIdentity = auth(disposableSession);
  const disposableSeed = await request("/api/v1/daily/log", {
    token: disposableIdentity.token,
    method: "POST",
    body: {
      person_id: disposableIdentity.personId,
      caregiver_id: disposableIdentity.caregiverId,
      capture_idempotency_key: unique("disposable-local-delete"),
      observation: "Synthetic test fixture: one care update exists before local workspace deletion.",
      source: "critical_care_journey_e2e",
    },
  });
  assert.ok([200, 201].includes(disposableSeed.status), JSON.stringify(disposableSeed.payload));
  const disposable = await createBrowserPage(
    disposableSession,
    "/workspace",
    { width: 390, height: 844 },
  );
  await disposable.page.getByRole("heading", { name: "Today", exact: true }).waitFor({ timeout: 20_000 });
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
  const deleteMenu = await disposable.page.getByRole("button", {
    name: "More care record actions", exact: true,
  }).click().then(() => disposable.page.getByRole("menu", { name: "Care record actions", exact: true }));
  await deleteMenu.waitFor({ state: "visible", timeout: 5_000 });
  const deleteDialogPromise = disposable.page.waitForEvent("dialog");
  const deleteClick = deleteMenu.getByRole("menuitem", { name: "Clear this device", exact: true }).click();
  const deleteDialog = await deleteDialogPromise;
  assert.match(deleteDialog.message(), /does not delete care information already saved in SolenOS/i,
    "workspace deletion must distinguish local browser data from saved care information");
  await deleteDialog.accept();
  await deleteClick;
  await disposable.page.waitForURL("**/start", { timeout: 15_000 });
  const clearedLocalData = await disposable.page.evaluate(() => ({
    token: window.localStorage.getItem("solenos_anonymous_access_token"),
    personId: window.localStorage.getItem("solenos_backend_person_id"),
    caregiverId: window.localStorage.getItem("solenos_backend_caregiver_id"),
    expiresAt: window.localStorage.getItem("solenos_anonymous_session_expires_at"),
    legacyPersonId: window.localStorage.getItem("solenos_person_id"),
    deletionMarker: window.localStorage.getItem("solenos_anonymous_session_revoked"),
    sessionStorageCount: window.sessionStorage.length,
  }));
  assert.deepEqual({
    token: clearedLocalData.token,
    personId: clearedLocalData.personId,
    caregiverId: clearedLocalData.caregiverId,
    expiresAt: clearedLocalData.expiresAt,
    legacyPersonId: clearedLocalData.legacyPersonId,
  }, {
    token: null,
    personId: null,
    caregiverId: null,
    expiresAt: null,
    legacyPersonId: null,
  }, "workspace deletion must clear current and legacy browser identity data without recreating a session on /start");
  assert.ok(clearedLocalData.deletionMarker, "workspace deletion must retain the local marker that blocks silent record recreation");
  assert.equal(clearedLocalData.sessionStorageCount, 0, "workspace deletion must clear temporary browser-session state");
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
  assert.equal(firstSaved.lifecycle_history.at(-1)?.action, "care.reminder.snoozed");
  assert.equal(firstSaved.lifecycle_history.at(-1)?.actor_caregiver_id, identity.caregiverId);

  firstItem = page.locator(".care-reminder-item").filter({ hasText: firstTitle });
  await firstItem.getByText("Reminder history", { exact: true }).click();
  await firstItem.getByText(/Snoozed by/).waitFor({ timeout: 10_000 });
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
  const completedReminder = completed.payload.find((item) => item.id === firstSaved.id);
  assert.equal(completedReminder?.status, "completed");
  assert.ok(completedReminder?.lifecycle_history.some((event) => event.action === "care.reminder.completed"));

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
await record("04 scanned document upload, original bytes, page tracking, idempotent retry and extraction", async () => {
  const documentLines = [
    "Caregiver observation: Mary ate half of her breakfast today.",
    "Caregiver observation: Mary woke twice overnight.",
    "Caregiver observation: Mary walked to the kitchen using her walking frame.",
    "Discharge instruction: Follow-up appointment requested in two weeks.",
    "The caregiver reports that Mary had no fever today.",
  ];
  const scanPage = await browser.newPage({
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 2,
  });
  const scanParagraphs = documentLines.map((line) =>
    `<p style="font-size:30px;line-height:1.55;margin:0 0 30px">${line}</p>`
  ).join("");
  await scanPage.setContent(`<!doctype html><html><body style="margin:0;background:#eee;font-family:Arial,sans-serif;color:#111"><article style="box-sizing:border-box;width:960px;min-height:1350px;margin:40px auto;padding:76px;background:#fff"><h1 style="font-size:42px;margin:0 0 42px">Discharge Summary</h1>${scanParagraphs}</article></body></html>`);
  const documentBytes = await scanPage.locator("article").screenshot({ type: "png" });
  await scanPage.close();

  const uploadRetryKey = `document-retry-${randomUUID()}`;
  const form = new FormData();
  form.append("person_id", identity.personId);
  form.append("caregiver_id", identity.caregiverId);
  form.append("evidence_type", "document");
  form.append("ingestion_key", uploadRetryKey);
  form.append("file", new Blob([documentBytes], { type: "image/png" }), "journey-discharge-note-scan.png");
  const uploaded = await request("/api/v1/upload", { token: identity.token, method: "POST", form });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.payload));
  documentId = uploaded.payload.evidence_id;
  assert.equal(uploaded.payload.persisted, true);

  const originalBinaryResponse = await fetch(new URL(`/api/v1/upload/${documentId}`, backend), {
    headers: { authorization: `Bearer ${identity.token}` },
  });
  assert.equal(originalBinaryResponse.status, 200);
  const originalBinary = Buffer.from(await originalBinaryResponse.arrayBuffer());
  assert.ok(originalBinary.equals(documentBytes), "the exact original scanned image bytes must remain retrievable");

  const retryForm = new FormData();
  retryForm.append("person_id", identity.personId);
  retryForm.append("caregiver_id", identity.caregiverId);
  retryForm.append("evidence_type", "document");
  retryForm.append("ingestion_key", uploadRetryKey);
  retryForm.append("file", new Blob([documentBytes], { type: "image/png" }), "journey-discharge-note-scan.png");
  const replay = await request("/api/v1/upload", { token: identity.token, method: "POST", form: retryForm });
  assert.equal(replay.status, 201, JSON.stringify(replay.payload));
  assert.equal(replay.payload.evidence_id, documentId, "a lost upload response must not create a second evidence record");
  assert.equal(replay.payload.idempotent_replay, true);

  const extracted = await request(`/api/v1/documents/${documentId}/extract`, { token: identity.token, method: "POST", body: {} });
  assert.equal(extracted.status, 201, JSON.stringify(extracted.payload));
  const reviewed = await request(`/api/v1/documents/analyses/${extracted.payload.analysis_id}`, { token: identity.token });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.payload));
  assert.match(String(reviewed.payload.extracted_text), /follow.?up appointment/i);
  const processing = await request("/api/v1/documents/status?limit=20", { token: identity.token });
  assert.equal(processing.status, 200, JSON.stringify(processing.payload));
  const processedScan = processing.payload.items.find((item) => item.evidence_id === documentId);
  assert.ok(processedScan, "the uploaded scan must appear in the saved-document list");
  assert.equal(processedScan.page_count, 1, "the scan must retain its one-page source count");
  assert.ok(processedScan.processed_page_numbers.includes(1), "page one must be recorded as processed");
  const intelligence = await request("/api/v1/documents/" + documentId + "/intelligence", { token: identity.token, method: "POST", body: {} });
  const beforeAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(beforeAcceptance.status, 200, JSON.stringify(beforeAcceptance.payload));

  if (intelligence.status === 201) {
    assert.ok(intelligence.payload.observations.length > 0, "A successful document review must contain source-grounded candidates");
    assert.equal(intelligence.payload.written_to_lcr, false);
    assert.ok(!beforeAcceptance.payload.items.some((item) => JSON.stringify(item).includes(documentId)), "unreviewed document candidate appeared in the LCR");
    const candidate = intelligence.payload.observations[0];
    const accepted = await request("/api/v1/documents/intelligence/" + intelligence.payload.analysis_id + "/review", {
      token: identity.token,
      method: "POST",
      body: {
        candidate_index: typeof candidate.candidate_index === "number" ? candidate.candidate_index : 0,
        decision: "accept",
        expected_source_quote: candidate.source_quote ?? "",
        expected_subject: candidate.subject ?? "",
        expected_observation: candidate.observation ?? "",
        expected_candidate_id: candidate.canonical_candidate?.candidate_id,
        expected_review_status: candidate.review_status ?? "pending_review",
      },
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.payload));
    assert.equal(accepted.payload.written_to_lcr, true);
  } else {
    const unavailableDetail = intelligence.payload?.detail;
    const modelUnavailable = intelligence.status === 503 && (
      unavailableDetail?.code === "runtime_unreachable" ||
      (typeof unavailableDetail === "string" &&
        /local Qwen is unavailable|AI assistance is unavailable/i.test(unavailableDetail))
    );
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
  duplicateForm.append("file", new Blob([documentBytes], { type: "image/png" }), "journey-discharge-note-scan-copy.png");
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
  const followUpsResponsePromise = daily.page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/v1/open-loops")
      && response.request().method() === "GET"
      && url.searchParams.get("limit") === "100"
      && url.searchParams.get("offset") === "0";
  });
  let releaseHistory = () => {};
  const historyGate = new Promise((resolve) => { releaseHistory = resolve; });
  await daily.page.route("**/api/v1/daily-care/intelligence/history**", async (route) => {
    await historyGate;
    await route.continue();
  });
  const followUpsPanel = daily.page.locator("details.daily-care-context-panel").filter({
    has: daily.page.locator("#daily-care-follow-ups-title"),
  });
  const savedFollowUps = followUpsPanel.locator('ul[aria-label="Saved follow-ups"]');
  try {
    await daily.page.reload({ waitUntil: "domcontentloaded" });
    const followUpsResponse = await followUpsResponsePromise;
    const followUpsPayload = await followUpsResponse.json();
    assert.equal(followUpsResponse.status(), 200, JSON.stringify(followUpsPayload));
    const browserFollowUp = (followUpsPayload.items || []).find((item) => item.id === appointmentFollowUpId);
    assert.ok(
      browserFollowUp,
      `Daily Care's browser request did not retrieve the pre-existing follow-up: ${JSON.stringify(followUpsPayload)}`,
    );
    // The list is inside a collapsed native <details>. Wait for it in the DOM,
    // then open it. The history request remains deliberately blocked until the
    // saved follow-up is visible, proving the two reads are independent.
    await savedFollowUps.waitFor({ state: "attached", timeout: 10_000 });
    await followUpsPanel.locator("summary").click();
    await savedFollowUps.waitFor({ state: "visible", timeout: 5_000 });
  } finally {
    releaseHistory();
    await daily.page.unroute("**/api/v1/daily-care/intelligence/history**");
  }
  const followUpsAlreadyOpen = await followUpsPanel.evaluate((element) =>
    element instanceof HTMLDetailsElement && element.open
  );
  if (!followUpsAlreadyOpen) {
    await followUpsPanel.locator("summary").click();
  }
  await followUpsPanel.getByRole("heading", { name: "Follow-ups", exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
  await savedFollowUps.getByText("Contact the clinic about the appointment", { exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
  const dailyCaptureJobs = [];
  for (const [index, report] of scenarioReports.entries()) {
    const saved = await saveFreeTextUpdate(report, index === 2 ? async () => {
      await daily.page.getByText(/The existing reviewed medication record lists: Metformin — 500 mg/i).waitFor({ timeout: 15_000 });
    } : undefined);
    dailyCaptureJobs.push({ ...saved, sourceReport: report });
  }

  if (requireLiveQwen) {
    // In the live-Qwen browser run, wait for every saved update to complete its
    // real extraction and reconciliation path. The model output remains a
    // reviewable candidate; it must not become an accepted care assertion.
    for (const { jobId, sourceReport } of dailyCaptureJobs) {
      const deadline = Date.now() + 12 * 60 * 1000;
      let completed = null;
      while (Date.now() < deadline) {
        const status = await request(`/api/v1/assistant/jobs/${jobId}`, { token: identity.token });
        assert.equal(status.status, 200, JSON.stringify(status.payload));
        assert.ok(!["failed", "cancelled"].includes(status.payload.status),
          `Live Qwen Daily Care extraction failed: ${JSON.stringify(status.payload)}`);
        if (status.payload.status === "completed") {
          completed = status.payload;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2_000));
      }
      assert.ok(completed, `Live Qwen Daily Care job did not complete: ${jobId}`);
      assert.equal(completed.review_required, true, JSON.stringify(completed));
      assert.equal(completed.written_to_lcr, false, JSON.stringify(completed));
      assert.equal(completed.output_id, null, "Daily Care extraction must remain a reviewable analysis, not an auto-approved Qwen output");
      const capture = completed.daily_capture || {};
      assert.equal(capture.projection_status, "verified", JSON.stringify(completed));
      assert.equal(capture.reconciliation_status, "completed", JSON.stringify(completed));
      assert.ok(Number(capture.source_grounded_observations_projected || 0) >= 1, JSON.stringify(completed));
      assert.ok(capture.analysis_id, JSON.stringify(completed));
      const analysis = await request(`/api/v1/capture/analyses/${capture.analysis_id}`, { token: identity.token });
      assert.equal(analysis.status, 200, JSON.stringify(analysis.payload));
      assert.equal(analysis.payload.review_required, true, JSON.stringify(analysis.payload));
      assert.equal(analysis.payload.written_to_lcr, false, JSON.stringify(analysis.payload));
      const candidates = analysis.payload.candidates?.observations || [];
      assert.ok(candidates.length > 0, JSON.stringify(analysis.payload));
      assert.ok(candidates.some(candidate =>
        typeof candidate.source_quote === "string" &&
        sourceReport.includes(candidate.source_quote)
      ), "Live Qwen Daily Care candidates must retain exact wording from a saved caregiver report");
    }
  } else {
    // The no-model browser run must not pretend background inference completed.
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
  assert.equal(new URL(daily.page.url()).pathname, "/workspace/daily-care", "Daily Care must remain the active route before opening Follow-ups");
  await daily.page.locator("#daily-care-follow-ups-title").waitFor({ state: "attached", timeout: 15_000 });
  const appointmentFollowUpsPanel = daily.page.locator("details.daily-care-context-panel").filter({
    has: daily.page.locator("#daily-care-follow-ups-title"),
  });
  await appointmentFollowUpsPanel.waitFor({ state: "attached", timeout: 15_000 });
  const isOpen = await appointmentFollowUpsPanel.evaluate((element) => element.open);
  if (!isOpen) await appointmentFollowUpsPanel.locator("summary").click();
  const openLoopsUiResponsePromise = daily.page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/v1/open-loops") && response.request().method() === "GET";
  }, { timeout: 15_000 });
  // Button(asChild) renders a semantic Next.js anchor. Target the link role,
  // then wait for the destination page h1, not the persistent sidebar heading.
  await appointmentFollowUpsPanel.getByRole("link", { name: "Open Follow-ups", exact: true }).click();
  await daily.page.waitForURL("**/workspace/open-loops", { timeout: 15_000 });
  await daily.page.locator(".followups-page h1").getByText("Follow-ups", { exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
  const openLoopsUiResponse = await openLoopsUiResponsePromise;
  const openLoopsUiPayload = await openLoopsUiResponse.json().catch(() => null);
  assert.equal(openLoopsUiResponse.status(), 200, JSON.stringify(openLoopsUiPayload));
  const browserClinicFollowUp = (openLoopsUiPayload?.items || []).find((item) => item.id === appointmentFollowUpId);
  assert.ok(
    browserClinicFollowUp,
    `Follow-ups page did not retrieve the persisted clinic item: ${JSON.stringify(openLoopsUiPayload)}`,
  );
  assert.equal(browserClinicFollowUp.title, "Contact the clinic about the appointment");
  await daily.page.locator(".followups-page")
    .getByRole("heading", { name: "Contact the clinic about the appointment", exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
  for (const report of scenarioReports) {
    await daily.page.getByText(report, { exact: false }).first().waitFor({ timeout: 15_000 });
  }
  await verifyMobile(daily.page);
  await daily.context.close();

});

await record("Daily Care capture survives secondary read failures", async () => {
  const resilient = await createBrowserPage(firstVisitSession, "/workspace/daily-care");
  const resilientIdentity = auth(firstVisitSession);
  const unavailable = (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Temporary secondary read failure for acceptance testing." }),
  });
  await resilient.page.route("**/api/v1/care-continuity/current-care*", unavailable);
  await resilient.page.route("**/api/v1/daily-care/intelligence/history*", unavailable);
  await resilient.page.route("**/api/v1/open-loops*", unavailable);
  await resilient.page.route("**/api/v1/notifications*", unavailable);
  await resilient.page.route("**/api/v1/documents/status*", unavailable);
  await resilient.page.reload({ waitUntil: "domcontentloaded" });

  const originalReport = `Daily Care capture survives secondary service failures ${randomUUID()}`;
  await resilient.page.getByRole("button", { name: "Share something", exact: true }).click();
  await resilient.page.getByRole("button", { name: /Something happened/ }).click();
  const reportField = resilient.page.locator("#natural-daily-update-report");
  await reportField.waitFor({ state: "visible", timeout: 15_000 });
  await reportField.fill(originalReport);

  // The write is queued before network submission. Verify that an offline
  // attempt is never represented as a canonical care-record save.
  await resilient.context.setOffline(true);
  await resilient.page.getByRole("button", { name: "Save update", exact: true }).click();
  await resilient.page.getByRole("alert")
    .filter({ hasText: "encrypted and saved on this device" })
    .waitFor({ timeout: 10_000 });
  const encryptedQueueRows = await resilient.page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const open = indexedDB.open("solenos-durable-write-queue", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction("writes", "readonly");
        const request = transaction.objectStore("writes").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      };
    });
  });
  assert.ok(Array.isArray(encryptedQueueRows) && encryptedQueueRows.length > 0,
    "offline capture must survive in IndexedDB until the backend confirms it");
  assert.equal(JSON.stringify(encryptedQueueRows).includes(originalReport), false,
    "caregiver text must be encrypted rather than stored as plaintext in IndexedDB");
  // Force one failed retry, then reload the application while the encrypted
  // IndexedDB record remains pending. The subsequent sync must use the same key.
  const abortFirstSync = (route) => route.abort("internetdisconnected");
  await resilient.page.route("**/api/v1/daily-care/entries", abortFirstSync);
  const failedSync = resilient.page.waitForEvent("requestfailed", (request) =>
    new URL(request.url()).pathname.endsWith("/api/v1/daily-care/entries")
    && request.method() === "POST"
  );
  await resilient.context.setOffline(false);
  await failedSync;
  // Keep normal page navigation online; the route below blocks only the
  // care-write POST so the saved queue can be observed after a full reload.
  await resilient.page.reload({ waitUntil: "domcontentloaded" });
  const queueAfterReload = await resilient.page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("solenos-durable-write-queue", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const currentPersonId = localStorage.getItem("solenos_backend_person_id");
    const currentCaregiverId = localStorage.getItem("solenos_backend_caregiver_id");
    const rows = await new Promise((resolve, reject) => {
      const transaction = db.transaction("writes", "readonly");
      const request = transaction.objectStore("writes").getAll();
      request.onsuccess = () => resolve(request.result.map((row) => ({
        endpoint: row.endpoint,
        status: row.status,
        attempts: row.attempts,
        next_retry_at: row.next_retry_at,
        created_at: row.created_at,
        person_id: row.person_id,
        caregiver_id: row.caregiver_id,
        matches_identity: row.person_id === currentPersonId && row.caregiver_id === currentCaregiverId,
      })));
      request.onerror = () => reject(request.error);
    });
    return { currentPersonId, currentCaregiverId, rows };
  });
  assert.ok(
    queueAfterReload.rows.some((row) => row.endpoint === "/daily-care/entries"),
    "the encrypted Daily Care write must remain in IndexedDB after a full page reload",
  );
  console.log("OFFLINE_QUEUE_AFTER_RELOAD", JSON.stringify(queueAfterReload));
  try {
    await resilient.page.getByRole("status")
      .filter({ hasText: "update waiting to sync with the care record" })
      .waitFor({ timeout: 15_000 });
  } catch (error) {
    const state = await resilient.page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open("solenos-durable-write-queue", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      const rows = await new Promise((resolve, reject) => {
        const transaction = db.transaction("writes", "readonly");
        const request = transaction.objectStore("writes").getAll();
        request.onsuccess = () => resolve(request.result.map((row) => ({
          id: row.id, endpoint: row.endpoint, status: row.status,
          attempts: row.attempts, next_retry_at: row.next_retry_at,
        })));
        request.onerror = () => reject(request.error);
      });
      return {
        online: navigator.onLine,
        currentPersonId: localStorage.getItem("solenos_backend_person_id"),
        currentCaregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
        rows: rows.map((row) => ({
          ...row,
          created_at: row.created_at,
          person_id: row.person_id,
          caregiver_id: row.caregiver_id,
        })),
        visibleText: document.body.innerText.slice(-1800),
      };
    });
    console.log("OFFLINE_RELOAD_DIAGNOSTIC", JSON.stringify(state));
    throw error;
  }
  await resilient.page.unroute("**/api/v1/daily-care/entries", abortFirstSync);

  const syncResponsePromise = resilient.page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/api/v1/daily-care/entries")
    && response.request().method() === "POST"
  );
  // Trigger the component's real online-retry handler after removing the
  // one-shot network failure, rather than relying on a timer race.
  await resilient.page.evaluate(() => window.dispatchEvent(new Event("online")));
  const saveResponse = await syncResponsePromise;
  const savePayload = await saveResponse.json();
  assert.equal(saveResponse.status(), 200, JSON.stringify(savePayload));
  assert.equal(savePayload.success, true, JSON.stringify(savePayload));
  assert.ok(typeof savePayload.id === "string" && savePayload.id,
    "the sync receipt must contain the persisted event ID");
  await resilient.page.getByRole("status")
    .filter({ hasText: "A pending update has synced to the care record." })
    .waitFor({ timeout: 15_000 });

  const persisted = await request(`/api/v1/events/${resilientIdentity.personId}`, { token: resilientIdentity.token });
  assert.equal(persisted.status, 200, JSON.stringify(persisted.payload));
  const matchingPersistedEvent = persisted.payload.find((event) => event.id === savePayload.id);
  assert.ok(
    matchingPersistedEvent && JSON.stringify(matchingPersistedEvent).includes(originalReport),
    `saved report must be retrievable despite secondary read failures; receipt=${JSON.stringify(savePayload)}; returned_count=${Array.isArray(persisted.payload) ? persisted.payload.length : "not-an-array"}; matching_event=${JSON.stringify(matchingPersistedEvent ?? null)}; returned_ids=${JSON.stringify(Array.isArray(persisted.payload) ? persisted.payload.map((event) => ({ id: event.id, event_type: event.event_type, title: event.title })) : persisted.payload)}`
  );
  assert.ok(resilient.observed.some((item) =>
    item.status === 503 && [
      "/api/v1/care-continuity/current-care",
      "/api/v1/daily-care/intelligence/history",
      "/api/v1/open-loops",
      "/api/v1/notifications",
      "/api/v1/documents/status",
    ].includes(item.path)
  ), "the browser journey must confirm that a secondary read actually failed");

  // Original photo bytes use the same encrypted, identity-scoped queue.
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p0cAAAAASUVORK5CYII=",
    "base64",
  );
  await resilient.page.getByRole("button", { name: /Share something/i }).click();
  await resilient.page.getByRole("button", { name: /Photograph/ }).click();
  await resilient.context.setOffline(true);
  await resilient.page.locator("#daily-care-photo-file").setInputFiles({
    name: "offline-care-photo.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await resilient.page.getByRole("button", { name: "Save photograph", exact: true }).click();
  await resilient.page.getByRole("alert")
    .filter({ hasText: "photo is saved securely on this device" })
    .waitFor({ timeout: 10_000 });
  const photoQueueRows = await resilient.page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const open = indexedDB.open("solenos-durable-write-queue", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const transaction = open.result.transaction("writes", "readonly");
        const request = transaction.objectStore("writes").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      };
    });
  });
  assert.ok(photoQueueRows.some((row) => row.endpoint === "/upload"),
    "the original photo must be queued before the upload request is acknowledged");
  assert.equal(JSON.stringify(photoQueueRows).includes("offline-care-photo.png"), false,
    "the photo filename and bytes must remain inside the encrypted queue payload");
  await resilient.page.waitForTimeout(1_200);
  const photoSyncResponsePromise = resilient.page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/api/v1/upload")
    && response.request().method() === "POST"
  );
  await resilient.context.setOffline(false);
  const photoSyncResponse = await photoSyncResponsePromise;
  const photoSyncPayload = await photoSyncResponse.json();
  assert.equal(photoSyncResponse.status(), 201, JSON.stringify(photoSyncPayload));
  assert.equal(photoSyncPayload.persisted, true, JSON.stringify(photoSyncPayload));
  assert.ok(typeof photoSyncPayload.evidence_id === "string" && photoSyncPayload.evidence_id);
  await resilient.page.getByRole("status")
    .filter({ hasText: "Photograph saved with your care information." })
    .waitFor({ timeout: 15_000 });
  const retrievedPhoto = await request(
    `/api/v1/upload/${photoSyncPayload.evidence_id}`,
    { token: resilientIdentity.token },
  );
  assert.equal(retrievedPhoto.status, 200, JSON.stringify(retrievedPhoto.payload));
  assert.ok(typeof retrievedPhoto.payload === "string" && retrievedPhoto.payload.length > 0,
    "the original uploaded photo bytes must remain retrievable after offline synchronization");

  await verifyMobile(resilient.page);
  await resilient.context.close();
});

await record("Care history opens the original caregiver report and its source details", async () => {
  const history = await createBrowserPage(session, "/workspace/more");
  await history.page.getByRole("heading", { name: "More", exact: true }).waitFor({ timeout: 20_000 });

  // Recent history is shown on More, not in the primary navigation.
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
  assert.match(sourceDetails, /Related notes or documents\s+1 related note or document/,
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
    assert.equal(answer.payload.ai_generated, true,
      "the live-Qwen browser journey must receive an actual model-generated Companion answer");
    assert.equal(answer.payload.provider_status, "available", JSON.stringify(answer.payload));
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
    answer.payload.lcr_context_coverage?.direct_care_history_recall?.history_complete,
    true,
    `Direct caregiver-history lookup must finish its bounded topic scan: ${JSON.stringify(answer.payload.lcr_context_coverage?.direct_care_history_recall || {})}`,
  );
  assert.equal(
    Number(answer.payload.lcr_context_coverage?.direct_care_history_recall?.event_count || 0),
    3,
    "Companion must retrieve all three caregiver-reported sleep, lunch and dinner events",
  );
  assert.ok(
    Number(answer.payload.lcr_context_coverage?.direct_care_history_recall?.evidence_count || 0) >= 3,
    "Companion must retain the linked original evidence for the three caregiver reports",
  );
  console.log("COMPANION_PROMPT_CONTEXT_DIAGNOSTIC", JSON.stringify({
    coverage: answer.payload.lcr_context_coverage || {},
    receipt: answer.payload.retrieval_receipt || {},
  }));
  assert.equal(
    answer.payload.lcr_context_coverage?.prompt_context_complete,
    true,
    `Companion must disclose a complete prompt context for this bounded care-history question: ${JSON.stringify(answer.payload.lcr_context_coverage || {})}`,
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
    /caregiver report/i,
    "the medication recall answer must identify its source as a caregiver report",
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
  if (requireLiveQwen) {
    assert.equal(documentAnswer.payload.ai_generated, true,
      "a saved document question must use real Qwen in the live browser acceptance run");
  }
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
  const runsResponse = await request(
    `/api/v1/care-delta/runs/${identity.personId}?limit=100&offset=0`,
    { token: identity.token },
  );
  assert.equal(runsResponse.status, 200, JSON.stringify(runsResponse.payload));
  assert.ok(Array.isArray(runsResponse.payload), "saved Delta history must be a persisted list");

  const dailyEventIds = new Set(Object.values(dailyScenarioEventIdsByReport));
  const dailyEvidenceIds = new Set(Object.values(dailyScenarioEvidenceIdsByReport));
  const dailyRuns = runsResponse.payload.filter((run) =>
    dailyEventIds.has(run.source_event_id)
    && Array.isArray(run.evidence_ids)
    && run.evidence_ids.some((id) => dailyEvidenceIds.has(id))
  );
  // This browser suite intentionally has no live Qwen runtime. Source reports
  // must remain saved and retrievable, but the no-model path must not claim that
  // model-dependent Delta analysis completed or persist a synthetic result.
  assert.equal(
    dailyRuns.length,
    0,
    "without live model inference, Daily Care must not report or persist a completed Delta run",
  );

  const invalid = await request("/api/v1/care-delta/reconcile", {
    token: identity.token, method: "POST",
    body: { person_id: identity.personId, source: "critical_care_journey_e2e", content: "", persist: true },
  });
  assert.equal(invalid.status, 422);
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
let appointmentId;
let appointmentTitle = null;
const selectedAppointmentSourceId = (brief) => {
  if (brief.next_appointment?.source_id) return brief.next_appointment.source_id;
  const recorded = [...(brief.appointments || [])];
  const upcoming = recorded
    .filter(item => ["scheduled", "upcoming", "today", "rescheduled", "date_unknown", "overdue"].includes(String(item.status || "").toLowerCase()))
    .sort((a, b) => {
      const aTime = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })[0];
  if (upcoming) return upcoming.source_id;
  return recorded.find(item => ["completed", "resolved", "historical"].includes(String(item.status || "").toLowerCase()))?.source_id || null;
};
await record("09 appointment summary persistence", async () => {
  const preparationBrief = await request("/api/v1/appointment-workspaces/preparation-brief?window_days=90", {
    token: identity.token,
  });
  assert.equal(preparationBrief.status, 200, JSON.stringify(preparationBrief.payload));
  assert.equal(preparationBrief.payload.read_only, true);
  let selectedBrief = preparationBrief.payload;
  appointmentId = selectedAppointmentSourceId(selectedBrief);
  if (!appointmentId) {
    const createdAppointment = await request("/api/v1/appointments", {
      token: identity.token,
      method: "POST",
      body: {
        person_id: identity.personId,
        title: "Primary care follow-up",
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        provider: "Primary care clinician",
        healthcare_org: "E2E clinic",
        preparation_notes: "Review the caregiver's recorded follow-up.",
        status: "scheduled",
        created_by_caregiver_id: identity.caregiverId,
      },
    });
    assert.ok([200, 201].includes(createdAppointment.status), JSON.stringify(createdAppointment.payload));
    const refreshedBrief = await request("/api/v1/appointment-workspaces/preparation-brief?window_days=90", {
      token: identity.token,
    });
    assert.equal(refreshedBrief.status, 200, JSON.stringify(refreshedBrief.payload));
    selectedBrief = refreshedBrief.payload;
    appointmentId = selectedAppointmentSourceId(selectedBrief);
  }
  const selectedAppointment = selectedBrief.next_appointment?.source_id === appointmentId
    ? selectedBrief.next_appointment
    : (selectedBrief.appointments || []).find(item => item.source_id === appointmentId);
  appointmentTitle = selectedAppointment?.title || null;
  assert.ok(appointmentId, "appointment workspace must be attached to the same saved appointment selected by the workspace");
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
    appointment_id: appointmentId,
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
  assert.equal(saved.payload.appointment_id, appointmentId, "appointment notes must stay linked to the selected saved appointment");
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

// 09A. Appointment outcome: caregiver review is required before an assertion enters the LCR.
await record("09A appointment outcome requires caregiver review before LCR retrieval", async () => {
  const caregiverReport = "Caregiver reports that Mum woke twice overnight after the clinic visit.";
  const revised = await request("/api/v1/appointment-workspaces/" + encodeURIComponent(appointmentWorkspaceId), {
    token: identity.token,
    method: "PATCH",
    body: {
      expected_version: 1,
      status: "outcome_pending",
      payload: {
        summary: "Prepare for the next care review.",
        caregiver_concerns: ["Sleep pattern", "Breakfast intake"],
        evidence_ids: [evidenceId],
        source_attribution: "caregiver_reported",
        caregiverReport,
        actualVisitDate: new Date().toISOString(),
        captureStage: "after",
      },
      change_reason: "Browser acceptance test for caregiver-reviewed appointment outcomes",
      idempotency_key: unique("appointment-outcome-review"),
    },
  });
  assert.equal(revised.status, 200, JSON.stringify(revised.payload));
  const recordId = revised.payload.id;
  assert.equal(recordId, appointmentWorkspaceId);
  assert.equal(revised.payload.appointment_id, appointmentId);
  assert.equal(revised.payload.payload?.caregiverReport, caregiverReport);

  const appointmentPage = await createBrowserPage(session, "/workspace/appointments");
  await appointmentPage.page.getByRole("heading", { name: "Your appointment, supported by SolenOS" }).waitFor({ timeout: 20_000 });
  const appointmentSupportToggle = appointmentPage.page.locator(".appointment-workspace .appointment-heading .appointment-primary");
  assert.ok(await appointmentSupportToggle.count(), "appointment support toggle must be present");
  if (await appointmentSupportToggle.getAttribute("aria-expanded") !== "true") {
    await appointmentSupportToggle.click();
  }
  assert.equal(await appointmentSupportToggle.getAttribute("aria-expanded"), "true", "appointment support must be expanded before reviewing the saved outcome");
  await appointmentPage.page.getByRole("button", { name: "After", exact: true }).click();
  await appointmentPage.page.getByRole("heading", { name: "Information recorded after the appointment", exact: true }).waitFor({ timeout: 20_000 });
  const afterAppointmentNote = appointmentPage.page.getByLabel("Add anything you remember, if you want to");
  assert.equal(await afterAppointmentNote.inputValue(), caregiverReport, "the saved caregiver report must be restored into the after-appointment capture field");

  const proposal = appointmentPage.page.locator(".guided-proposal").filter({ hasText: caregiverReport }).first();
  await proposal.waitFor({ state: "visible", timeout: 20_000 });
  await proposal.getByRole("button", { name: "Accept as caregiver report", exact: true }).click();
  await appointmentPage.page.getByText(/Accepted as a caregiver-reviewed care record detail|Added to your Care Record as your report/).waitFor({ timeout: 20_000 });

  const assertions = await request(
    `/api/v1/care-continuity/assertions/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(assertions.status, 200, JSON.stringify(assertions.payload));
  const accepted = assertions.payload.find((item) =>
    item.asserted_value === caregiverReport &&
    item.assertion_status === "caregiver_reviewed" &&
    item.epistemic_state === "reported"
  );
  assert.ok(accepted, "the caregiver-approved appointment report must be retrievable as a caregiver-reviewed, reported LCR assertion");
  assert.equal(accepted.created_by_caregiver_id, identity.caregiverId);
  assert.ok(accepted.source_proposal_id, "the accepted LCR assertion must retain its appointment proposal provenance");
  assert.equal(accepted.source_conversation_id, null);
  assert.equal(accepted.source_message_id, null);
  await verifyMobile(appointmentPage.page);
  await appointmentPage.context.close();
});

// 10. Handoff: prepare a source-referenced draft and confirm it remains persisted/read-only.
let handoffDraftId;
await record("10 evidence-backed handoff", async () => {
  const requestId = unique("handoff-request");
  const handoffAppointment = await request("/api/v1/appointments", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      title: "Care coordination follow-up",
      scheduled_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Care team",
      status: "scheduled",
      created_by_caregiver_id: identity.caregiverId,
    },
  });
  assert.equal(handoffAppointment.status, 200, JSON.stringify(handoffAppointment.payload));
  const handoffBody = {
    purpose: "professional_appointment",
    audience: "professional",
    window_days: 30,
    appointment_id: handoffAppointment.payload.id,
  };
  const draft = await request("/api/v1/handoff-drafts/prepare", {
    token: identity.token, method: "POST", body: handoffBody,
    extraHeaders: { "x-request-id": requestId },
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.payload));
  assert.equal(draft.payload.draft_persisted, true);
  assert.equal(draft.payload.updates_lcr, false);
  assert.equal(draft.payload.appointment_id, handoffAppointment.payload.id);
  assert.equal(draft.payload.selected_appointment.title, "Care coordination follow-up");
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
  assert.ok(["current", "stale", "unknown"].includes(replay.payload.source_freshness?.status), "replayed drafts must disclose source freshness");
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
  const { context, page, pageErrors } = await createBrowserPage({
    ...session,
    access_token: login.payload.access_token,
    expires_at: login.payload.expires_at,
  }, "/workspace");
  await verifyMobile(page);
  assert.deepEqual(pageErrors, [], `returning caregiver browser must not throw: ${JSON.stringify(pageErrors)}`);
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

// 12b. A separately authenticated invited caregiver reads the same shared record,
// while unrelated sessions remain isolated and revocation takes effect immediately.
await record("12b invited caregiver sees the shared care record in a separate browser context", async () => {
  const invitedEmail = `shared-care-${randomUUID()}@example.test`;
  const invitation = await request("/api/v1/caregiver-access/invitations", {
    token: identity.token,
    method: "POST",
    body: { email: invitedEmail, expires_in_days: 7 },
  });
  assert.equal(invitation.status, 201, JSON.stringify(invitation.payload));
  assert.equal(invitation.payload.delivery_status, "not_sent",
    "the product must not claim an invitation email was sent when no delivery provider ran");

  const accepted = await request("/api/v1/caregiver-access/invitations/accept", {
    method: "POST",
    body: {
      token: invitation.payload.invitation_token,
      email: invitedEmail,
      password: "shared-care-invite-passphrase-2026!",
      name: "Invited family caregiver",
    },
  });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.payload));
  assert.equal(accepted.payload.person_id, identity.personId);
  assert.notEqual(accepted.payload.caregiver_id, identity.caregiverId);
  const currentCaregiverProfile = await request("/api/v1/caregiver-profiles/current", { token: accepted.payload.access_token });
  assert.equal(currentCaregiverProfile.status, 200, JSON.stringify(currentCaregiverProfile.payload));
  assert.equal(currentCaregiverProfile.payload.person_id, identity.personId);
  assert.ok(currentCaregiverProfile.payload.id);

  const sharedEvents = await request(`/api/v1/events/${encodeURIComponent(identity.personId)}`, {
    token: accepted.payload.access_token,
  });
  assert.equal(sharedEvents.status, 200, JSON.stringify(sharedEvents.payload));
  assert.ok(sharedEvents.payload.some((event) => event.id === dailyCaptureEventId),
    "the invited caregiver must retrieve the same saved care event");
  const sharedEvidence = await request(`/api/v1/evidence/${encodeURIComponent(identity.personId)}`, {
    token: accepted.payload.access_token,
  });
  assert.equal(sharedEvidence.status, 200, JSON.stringify(sharedEvidence.payload));
  assert.ok(sharedEvidence.payload.some((item) => item.id === evidenceId),
    "the invited caregiver must retrieve the same source evidence");

  const { context, page, pageErrors } = await createBrowserPage({
    access_token: accepted.payload.access_token,
    person: { id: accepted.payload.person_id },
    caregiver: { id: accepted.payload.caregiver_id },
    expires_at: accepted.payload.expires_at,
  }, "/workspace/care-continuity");
  await page.getByRole("heading", { name: "Your Care Record" }).first().waitFor({ timeout: 20_000 });
  await page.getByText(scenarioReports[0], { exact: false }).first().waitFor({ timeout: 20_000 });
  await verifyMobile(page);
  assert.deepEqual(pageErrors, [], `invited caregiver browser must not throw: ${JSON.stringify(pageErrors)}`);

  const primaryReminderBrowser = await createBrowserPage({
    access_token: identity.token,
    person: { id: identity.personId },
    caregiver: { id: identity.caregiverId },
    expires_at: session.expires_at,
  }, "/workspace/reminders");
  const primaryReminderPage = primaryReminderBrowser.page;
  await primaryReminderPage.getByRole("heading", { name: "Care reminders", exact: true }).waitFor({ timeout: 20_000 });
  const sharedReminderTitle = unique("Shared reminder — assigned caregiver");
  const reminderForm = primaryReminderPage.locator("form.care-reminder-form");
  await reminderForm.getByLabel("What needs following up?").fill(sharedReminderTitle);
  await reminderForm.getByLabel("Who is responsible?").selectOption(accepted.payload.caregiver_id);
  await reminderForm.getByRole("button", { name: "Save reminder", exact: true }).click();
  const sharedReminderItem = primaryReminderPage.locator(".care-reminder-item").filter({ hasText: sharedReminderTitle });
  await sharedReminderItem.waitFor({ timeout: 20_000 });
  let sharedReminderRows = await request(
    `/api/v1/reminders/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(sharedReminderRows.status, 200, JSON.stringify(sharedReminderRows.payload));
  let sharedReminder = sharedReminderRows.payload.find((item) => item.title === sharedReminderTitle);
  assert.ok(sharedReminder, "shared reminder must be persisted by the backend");
  assert.equal(sharedReminder.created_by_caregiver_id, identity.caregiverId);
  assert.equal(sharedReminder.assigned_to_caregiver_id, accepted.payload.caregiver_id);

  await sharedReminderItem.getByLabel(`Responsible caregiver for ${sharedReminderTitle}`)
    .selectOption(identity.caregiverId);
  await primaryReminderPage.getByRole("status").filter({ hasText: "Reminder responsibility updated and saved." })
    .waitFor({ timeout: 20_000 });
  sharedReminderRows = await request(
    `/api/v1/reminders/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  sharedReminder = sharedReminderRows.payload.find((item) => item.title === sharedReminderTitle);
  assert.equal(sharedReminder.assigned_to_caregiver_id, identity.caregiverId);
  assert.equal(sharedReminder.version, 2, "reassignment must advance the optimistic version");
  await sharedReminderItem.getByText("Responsibility history", { exact: true }).click();
  await sharedReminderItem.getByText(/assigned by/, { exact: false }).waitFor({ timeout: 10_000 });
  assert.deepEqual(primaryReminderBrowser.pageErrors, [], "shared reminder assignment must not throw browser errors");
  await primaryReminderBrowser.context.close();

  const settingsBrowser = await createBrowserPage({
    access_token: accepted.payload.access_token,
    person: { id: accepted.payload.person_id },
    caregiver: { id: accepted.payload.caregiver_id },
    expires_at: accepted.payload.expires_at,
  }, "/workspace/settings");
  const settingsPage = settingsBrowser.page;
  await settingsPage.locator("#settings-caregivers summary").click();
  await settingsPage.getByRole("heading", { name: "Your care responsibilities" }).waitFor({ timeout: 20_000 });
  await settingsPage.getByLabel("Add a care responsibility").fill("Appointment follow-up");
  await settingsPage.getByLabel("Care responsibility details (optional)").fill("Confirm the next clinic appointment.");
  await settingsPage.getByRole("button", { name: "Save responsibility", exact: true }).click();
  await settingsPage.getByRole("button", { name: "End responsibility", exact: true }).waitFor({ timeout: 20_000 });

  await settingsPage.locator("#caregiver-role-type").selectOption("appointment_coordinator");
  await settingsPage.getByRole("button", { name: "Save care role", exact: true }).click();
  await settingsPage.getByRole("button", { name: "End role", exact: true }).waitFor({ timeout: 20_000 });
  assert.deepEqual(settingsBrowser.pageErrors, [], "caregiver role and responsibility controls must not throw browser errors");
  await verifyMobile(settingsPage);

  await settingsPage.getByRole("button", { name: "End role", exact: true }).click();
  await settingsPage.getByRole("button", { name: "End role", exact: true }).waitFor({ state: "detached", timeout: 20_000 });
  await settingsPage.getByRole("button", { name: "End responsibility", exact: true }).click();
  await settingsPage.getByRole("button", { name: "End responsibility", exact: true }).waitFor({ state: "detached", timeout: 20_000 });
  await settingsPage.getByRole("heading", { name: "Your responsibility history" }).waitFor({ timeout: 20_000 });
  await settingsPage.getByText(/Appointment follow-up/i).waitFor({ timeout: 20_000 });
  const invitedProfile = await request("/api/v1/caregiver-profiles/current", { token: accepted.payload.access_token });
  assert.equal(invitedProfile.status, 200, JSON.stringify(invitedProfile.payload));
  const responsibilityHistory = await request(
    `/api/v1/caregiver-responsibilities/history/${encodeURIComponent(invitedProfile.payload.id)}?person_id=${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  assert.equal(responsibilityHistory.status, 200, JSON.stringify(responsibilityHistory.payload));
  assert(
    responsibilityHistory.payload.some((item) =>
      item.responsibility_type === "Appointment follow-up" && Boolean(item.effective_end)
    ),
    "ending a responsibility must preserve its historical record and end timestamp",
  );

  const primarySettingsBrowser = await createBrowserPage({
    access_token: identity.token,
    person: { id: identity.personId },
    caregiver: { id: identity.caregiverId },
    expires_at: session.expires_at,
  }, "/workspace/settings");
  const primarySettingsPage = primarySettingsBrowser.page;
  primarySettingsPage.on("dialog", (dialog) => dialog.accept());
  await primarySettingsPage.locator("#settings-caregivers summary").click();
  await primarySettingsPage.getByRole("heading", { name: "People with access" }).waitFor({ timeout: 20_000 });
  await primarySettingsPage.getByRole("button", { name: "Pause access", exact: true }).click();
  await primarySettingsPage.getByText(/access is paused/i).waitFor({ timeout: 20_000 });
  const suspendedBearer = await request(
    `/api/v1/evidence/${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  assert.equal(suspendedBearer.status, 401, "suspension must revoke the invitee's existing session");

  await primarySettingsPage.getByRole("button", { name: "Restore access", exact: true }).click();
  await primarySettingsPage.getByText(/access is restored/i).waitFor({ timeout: 20_000 });
  const restoredLogin = await request("/api/v1/accounts/login", {
    method: "POST",
    body: { email: invitedEmail, password: "shared-care-invite-passphrase-2026!" },
  });
  assert.equal(restoredLogin.status, 200, JSON.stringify(restoredLogin.payload));
  accepted.payload.access_token = restoredLogin.payload.access_token;
  accepted.payload.expires_at = restoredLogin.payload.expires_at;
  assert.deepEqual(primarySettingsBrowser.pageErrors, [], "caregiver suspension and restoration must not throw browser errors");
  await primarySettingsBrowser.context.close();

  // Explicit sharing is the boundary for cross-caregiver perspective comparison.
  const primaryProfile = await request("/api/v1/caregiver-profiles/current", { token: identity.token });
  assert.equal(primaryProfile.status, 200, JSON.stringify(primaryProfile.payload));
  const primaryPerspective = await request("/api/v1/caregiver-perspectives", {
    token: identity.token,
    method: "POST",
    body: {
      person_id: identity.personId,
      caregiver_id: primaryProfile.payload.id,
      claim_type: "observation",
      claim_content: "Primary caregiver reports that Mum fell yesterday.",
    },
  });
  const invitedPerspective = await request("/api/v1/caregiver-perspectives", {
    token: accepted.payload.access_token,
    method: "POST",
    body: {
      person_id: identity.personId,
      caregiver_id: currentCaregiverProfile.payload.id,
      claim_type: "observation",
      claim_content: "Invited caregiver reports that Mum did not fall.",
    },
  });
  assert.equal(primaryPerspective.status, 200, JSON.stringify(primaryPerspective.payload));
  assert.equal(invitedPerspective.status, 200, JSON.stringify(invitedPerspective.payload));

  // Session-derived network reads must work without a caller-supplied person_id.
  const privateNetworkState = await request("/api/v1/care-network-state", { token: identity.token });
  assert.equal(privateNetworkState.status, 200, JSON.stringify(privateNetworkState.payload));
  const invitedNetworkState = await request(
    `/api/v1/care-network-state/${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  assert.equal(invitedNetworkState.status, 200, JSON.stringify(invitedNetworkState.payload));
  const invitedSummaryPathOnly = await request(
    `/api/v1/multi-caregiver-summary/${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  console.log("INVITED_CAREGIVER_SUMMARY_SCOPE", JSON.stringify({
    session_person_id: accepted.payload.person_id,
    session_caregiver_id: accepted.payload.caregiver_id,
    caregiver_profile_id: currentCaregiverProfile.payload.id,
    requested_person_id: identity.personId,
    path_only_status: invitedSummaryPathOnly.status,
    path_only_error: invitedSummaryPathOnly.payload?.detail ?? null,
  }));
  assert.equal(invitedSummaryPathOnly.status, 200, JSON.stringify(invitedSummaryPathOnly.payload));
  const invitedSummary = await request(
    `/api/v1/multi-caregiver-summary/${encodeURIComponent(identity.personId)}?person_id=${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  assert.equal(invitedSummary.status, 200, JSON.stringify(invitedSummary.payload));
  await settingsPage.getByRole("button", { name: "Share care context", exact: true }).waitFor({ timeout: 20_000 });
  await settingsPage.getByLabel("Where are you based relative to the person you help?").selectOption("remote");
  await settingsPage.getByLabel("When are you usually available? (optional)").fill("Weekday evenings");
  await settingsPage.getByLabel("Availability window end").fill("Weekends by arrangement");
  await settingsPage.getByLabel("Anything else the care team should know? (optional)").fill(
    "Can help with appointment transport when arranged in advance.",
  );
  await settingsPage.getByLabel("Care context sharing confirmation").check();
  await settingsPage.getByRole("button", { name: "Share care context", exact: true }).click();
  await settingsPage.getByText(
    "Your care context was shared with caregivers who have access to this Care Record.",
    { exact: true },
  ).waitFor({ timeout: 20_000 });
  await settingsPage.getByText(
    "Can help with appointment transport when arranged in advance.",
    { exact: true },
  ).waitFor({ timeout: 20_000 });
  const sharedCareContexts = await request(
    `/api/v1/caregiver-contexts/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(sharedCareContexts.status, 200, JSON.stringify(sharedCareContexts.payload));
  assert(
    sharedCareContexts.payload.some((item) =>
      item.caregiver_id === currentCaregiverProfile.payload.id
      && item.proximity_category === "remote"
      && item.observation_window_start === "Weekday evenings"
      && item.observation_window_end === "Weekends by arrangement"
      && item.availability_notes === "Can help with appointment transport when arranged in advance."
    ),
    "an explicitly shared caregiver context must persist and be visible to another authorized caregiver",
  );

  const activityDescription = "Coordinated transport for the next appointment.";
  await settingsPage.getByLabel("What kind of activity was it?").selectOption("coordinated_appointment");
  await settingsPage.getByLabel("What did you do?").fill(activityDescription);
  await settingsPage.getByRole("button", { name: "Save activity", exact: true }).click();
  await settingsPage.getByText(activityDescription, { exact: true }).waitFor({ timeout: 20_000 });
  const savedCaregiverActivities = await request(
    `/api/v1/caregiver-activities/${encodeURIComponent(identity.personId)}?limit=30`,
    { token: accepted.payload.access_token },
  );
  assert.equal(savedCaregiverActivities.status, 200, JSON.stringify(savedCaregiverActivities.payload));
  assert(
    savedCaregiverActivities.payload.some((item) =>
      item.caregiver_id === currentCaregiverProfile.payload.id
      && item.activity_type === "coordinated_appointment"
      && item.description === activityDescription
    ),
    "caregiver activity must persist under the authenticated caregiver profile",
  );
  const sharedActivitySummary = await request(
    `/api/v1/multi-caregiver-summary?person_id=${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(sharedActivitySummary.status, 200, JSON.stringify(sharedActivitySummary.payload));
  assert(
    (sharedActivitySummary.payload.caregivers ?? []).some((caregiver) =>
      caregiver.recent_activities?.some((item) => item.description === activityDescription)
    ),
    "authorized caregivers must see the activity in the shared caregiver network",
  );
  const careRecordAfterActivity = await request(
    "/api/v1/care-continuity/current-care?limit_per_source=50",
    { token: identity.token },
  );
  assert.equal(careRecordAfterActivity.status, 200, JSON.stringify(careRecordAfterActivity.payload));
  assert(
    !(careRecordAfterActivity.payload.items ?? []).some((item) => JSON.stringify(item).includes(activityDescription)),
    "caregiver activity history must not silently become a canonical care fact",
  );

  const invitedCrossRecordSummary = await request(
    "/api/v1/multi-caregiver-summary?person_id=another-person",
    { token: accepted.payload.access_token },
  );
  assert.equal(invitedCrossRecordSummary.status, 403,
    "an invited caregiver cannot use the session-derived route to select another care recipient");
  const invitedCrossRecordState = await request(
    "/api/v1/care-network-state?person_id=another-person",
    { token: accepted.payload.access_token },
  );
  assert.equal(invitedCrossRecordState.status, 403,
    "care-network state must reject a caller-selected different care recipient");
  const crossRecordNetwork = await request(
    `/api/v1/multi-caregiver-summary?person_id=${encodeURIComponent("another-person")}`,
    { token: identity.token },
  );
  assert.equal(crossRecordNetwork.status, 403,
    "a session-derived summary must still reject a caller-selected different care recipient");
  const privateSummary = await request(`/api/v1/multi-caregiver-summary/${encodeURIComponent(identity.personId)}?person_id=${encodeURIComponent(identity.personId)}`, { token: identity.token });
  assert.equal(privateSummary.status, 200, JSON.stringify(privateSummary.payload));
  assert.equal(privateSummary.payload.perspective_conflicts.length, 0,
    "private caregiver perspectives must not create or expose network conflicts");
  const privateSharedRead = await request(
    `/api/v1/caregiver-perspectives/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(privateSharedRead.status, 200, JSON.stringify(privateSharedRead.payload));
  assert.equal(privateSharedRead.payload.length, 0,
    "private perspectives must not appear in the shared perspective endpoint");

  const primaryPromotion = await request(
    `/api/v1/caregiver-perspectives/${encodeURIComponent(primaryPerspective.payload.id)}/promote`,
    { token: identity.token, method: "POST", body: {} },
  );
  assert.equal(primaryPromotion.status, 200, JSON.stringify(primaryPromotion.payload));
  const oneSharedSummary = await request(`/api/v1/multi-caregiver-summary/${encodeURIComponent(identity.personId)}?person_id=${encodeURIComponent(identity.personId)}`, { token: identity.token });
  assert.equal(oneSharedSummary.payload.perspective_conflicts.length, 0,
    "one shared perspective is not enough to establish a cross-caregiver difference");

  const invitedPromotion = await request(
    `/api/v1/caregiver-perspectives/${encodeURIComponent(invitedPerspective.payload.id)}/promote`,
    { token: accepted.payload.access_token, method: "POST", body: {} },
  );
  assert.equal(invitedPromotion.status, 200, JSON.stringify(invitedPromotion.payload));
  const sharedSummary = await request(`/api/v1/multi-caregiver-summary/${encodeURIComponent(identity.personId)}?person_id=${encodeURIComponent(identity.personId)}`, { token: identity.token });
  assert.equal(sharedSummary.status, 200, JSON.stringify(sharedSummary.payload));
  assert.equal(sharedSummary.payload.perspective_conflicts.length, 1,
    "the conflict must appear only after both caregivers explicitly share their accounts");
  const invitedSharedSummary = await request(
    `/api/v1/multi-caregiver-summary/${encodeURIComponent(identity.personId)}?person_id=${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  assert.equal(invitedSharedSummary.status, 200, JSON.stringify(invitedSharedSummary.payload));
  assert.equal(invitedSharedSummary.payload.perspective_conflicts.length, 1,
    "every authorized caregiver must retrieve the same explicitly shared conflict");
  const sharedConflict = sharedSummary.payload.perspective_conflicts[0];
  assert.equal(sharedConflict.status, "conflicting");
  assert.deepEqual(
    new Set([sharedConflict.claim_a, sharedConflict.claim_b]),
    new Set([
      "Primary caregiver reports that Mum fell yesterday.",
      "Invited caregiver reports that Mum did not fall.",
    ]),
  );

  await settingsPage.reload();
  await settingsPage.locator("#settings-caregivers summary").click();
  await settingsPage.getByText("Different caregiver accounts", { exact: true }).waitFor({ timeout: 20_000 });
  await settingsPage.getByLabel("Perspective review explanation").fill(
    "The caregivers describe different accounts. Keep both reports separately attributed; do not choose either as an established care fact.",
  );
  await settingsPage.getByRole("button", { name: "Complete review", exact: true }).click();
  await settingsPage.getByText("Different caregiver accounts", { exact: true }).waitFor({ state: "detached", timeout: 20_000 });
  const resolvedConflictRead = await request(
    `/api/v1/perspective-conflicts/${encodeURIComponent(identity.personId)}`,
    { token: identity.token },
  );
  assert.equal(resolvedConflictRead.status, 200, JSON.stringify(resolvedConflictRead.payload));
  assert.equal(resolvedConflictRead.payload.length, 0,
    "the completed review must close the network review item without deleting either report");
  const preservedPrimaryPerspective = await request(
    `/api/v1/caregiver-perspectives/${encodeURIComponent(identity.personId)}?caregiver_id=${encodeURIComponent(primaryProfile.payload.id)}`,
    { token: identity.token },
  );
  const preservedInvitedPerspective = await request(
    `/api/v1/caregiver-perspectives/${encodeURIComponent(identity.personId)}?caregiver_id=${encodeURIComponent(currentCaregiverProfile.payload.id)}`,
    { token: accepted.payload.access_token },
  );
  assert.ok(preservedPrimaryPerspective.payload.some((item) => item.id === primaryPerspective.payload.id));
  assert.ok(preservedInvitedPerspective.payload.some((item) => item.id === invitedPerspective.payload.id));

  await settingsBrowser.context.close();
  await context.close();

  const revoked = await request(
    `/api/v1/caregiver-access/members/${encodeURIComponent(accepted.payload.caregiver_id)}`,
    { token: identity.token, method: "DELETE" },
  );
  assert.equal(revoked.status, 200, JSON.stringify(revoked.payload));
  assert.equal(revoked.payload.sessions_revoked, true);
  const afterRevocation = await request(
    `/api/v1/events/${encodeURIComponent(identity.personId)}`,
    { token: accepted.payload.access_token },
  );
  assert.equal(afterRevocation.status, 401,
    "revoking a shared caregiver must invalidate their already-issued session");
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
  await emptyPage.page.getByText("No documents added yet", { exact: true }).waitFor({ timeout: 15_000 });
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
      const appointmentSummary = page.locator(".solenos-upcoming-appointment");
      await appointmentSummary.waitFor({ state: "visible", timeout: 15_000 });
      assert.ok(observed.some((item) => item.path.includes("/appointment-workspaces/preparation-brief") && item.status === 200),
        "caregiver home did not load appointment information from the persisted backend preparation brief");
      const summaryText = await appointmentSummary.innerText();
      assert.ok(!/Appointment information is unavailable/i.test(summaryText),
        "caregiver home represented appointment retrieval as unavailable");
      if (appointmentTitle) assert.ok(summaryText.includes(appointmentTitle),
        "caregiver home did not display the appointment returned by the backend preparation brief");
    }
    if (route === "/workspace/community") await page.waitForURL("**/workspace", { timeout: 10_000 });
    await context.close();
  }

  const details = await createBrowserPage(session, "/workspace");
  await details.page.getByRole("button", { name: "More care record actions" }).click();
  await details.page.getByRole("menuitem", { name: "View record details", exact: true }).click();
  const dialog = details.page.getByRole("dialog", { name: "Care record details" });
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  const firstSavedItem = dialog.locator(".care-record-overview__item").first();
  await firstSavedItem.waitFor({ state: "visible", timeout: 15_000 });
  const temporalLabels = await firstSavedItem.locator(".care-record-overview__meta").innerText();
  assert.match(temporalLabels, /Happened:/, "the original event time must be labelled separately");
  assert.match(temporalLabels, /Saved:/, "the record time must be labelled separately");
  await details.page.waitForFunction(() => {
    const dialog = document.querySelector(".solenos-record-details-dialog");
    return dialog instanceof HTMLElement && dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').length > 0;
  }, undefined, { timeout: 15_000 });
  assert.equal(
    await details.page.locator(".solenos-chat-main").evaluate((element) => element.inert),
    true,
    "the workspace content behind care details must be inert while the modal is open",
  );
  const firstDialogControl = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').first();
  const lastDialogControl = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').last();
  await details.page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Close care record details",
    undefined,
    { timeout: 5_000 },
  );
  await lastDialogControl.focus();
  await details.page.keyboard.press("Tab");
  assert.equal(
    await details.page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    "Close care record details",
    "Tab from the last dialog control must wrap to the first control",
  );
  await details.page.keyboard.press("Shift+Tab");
  assert.equal(
    await lastDialogControl.evaluate((element) => element === document.activeElement),
    true,
    "Shift+Tab from the first dialog control must wrap to the last control",
  );
  await details.page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 5_000 });
  assert.equal(
    await details.page.getByRole("button", { name: "More care record actions" }).evaluate((element) => element === document.activeElement),
    true,
    "closing care details must return focus to the More actions trigger",
  );
  assert.equal(
    await details.page.locator(".solenos-chat-main").evaluate((element) => element.inert),
    false,
    "closing care details must restore background interaction",
  );
  await verifyMobile(details.page);
  await details.context.close();

  await record("mobile and tablet navigation drawer contains keyboard focus", async () => {
    for (const viewport of [
      { width: 900, height: 900 },
      { width: 761, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const navigation = await createBrowserPage(session, "/workspace", viewport);
      const trigger = navigation.page.getByRole("button", { name: "Open navigation", exact: true });
      await trigger.waitFor({ state: "visible", timeout: 10_000 });
      await trigger.click();
      const sidebar = navigation.page.locator("#solenos-navigation");
      await navigation.page.waitForFunction(() => {
        const element = document.getElementById("solenos-navigation");
        return element?.getAttribute("aria-modal") === "true";
      }, undefined, { timeout: 5_000 });
      assert.equal(
        await navigation.page.locator(".solenos-chat-workspace").evaluate((element) => element.inert),
        true,
        `workspace must be inert behind the navigation drawer at ${viewport.width}px`,
      );
      await navigation.page.waitForFunction(
        () => document.activeElement?.closest("#solenos-navigation") !== null,
        undefined,
        { timeout: 5_000 },
      );
      const lastNavigationControl = sidebar.locator('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').last();
      await lastNavigationControl.focus();
      await navigation.page.keyboard.press("Tab");
      await navigation.page.waitForFunction(
        () => document.activeElement?.closest("#solenos-navigation") !== null,
        undefined,
        { timeout: 5_000 },
      );
      await navigation.page.keyboard.press("Escape");
      await navigation.page.waitForFunction(
        () => document.getElementById("solenos-navigation")?.getAttribute("aria-modal") !== "true",
        undefined,
        { timeout: 5_000 },
      );
      assert.equal(
        await trigger.evaluate((element) => element === document.activeElement),
        true,
        `closing the drawer must restore focus to its trigger at ${viewport.width}px`,
      );
      await verifyMobile(navigation.page);
      await navigation.context.close();
    }
  });

  await record("Care record details distinguish denied access from service outage", async () => {
    for (const scenario of [
      { status: 403, expected: "forbidden" },
      { status: 503, expected: "unavailable" },
    ]) {
      const failedDetails = await createBrowserPage(session, "/workspace");
      await failedDetails.page.route("**/api/v1/care-continuity/current-care*", (route) =>
        route.fulfill({
          status: scenario.status,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Care record retrieval unavailable for this test." }),
        }),
      );
      await failedDetails.page.getByRole("button", { name: "More care record actions" }).click();
      await failedDetails.page.getByRole("menuitem", { name: "View record details", exact: true }).click();
      const failedDialog = failedDetails.page.getByRole("dialog", { name: "Care record details" });
      await failedDialog.locator(`.record-state--${scenario.expected}`).waitFor({ state: "visible", timeout: 15_000 });
      assert.equal(
        await failedDialog.locator(".record-state--first-empty").count(),
        0,
        "a failed care-record read must never be presented as an empty record",
      );
      await failedDetails.context.close();
    }
  });

  // A conversation must remain usable when the optional browser history pointer cannot be saved.
  // The server-side conversation list is the durable recovery path.
  const companion = await createBrowserPage(
    session,
    "/workspace/companion",
    undefined,
    { failCompanionPointerWrites: true },
  );
  const companionInput = companion.page.locator("#companion-message-input");
  if (await companionInput.isDisabled()) {
    assert.notEqual(
      process.env.SOLENOS_REQUIRE_LIVE_QWEN,
      "1",
      "Companion must be interactive when live Qwen is explicitly required",
    );
    await companion.page.getByText(/Responses are not available right now/).waitFor({ timeout: 10_000 });
    await verifyMobile(companion.page);
  } else {
    // The composer documents Enter as its primary send action; exercise that exact UI path.
    await companionInput.fill("What did the caregiver record about sleep and appetite?");
    await companionInput.press("Enter");
    await companion.page.waitForFunction(() => {
      const messages = Array.from(document.querySelectorAll(".companion-message.is-assistant"));
      return messages.length > 0 && !messages[messages.length - 1].querySelector(".companion-typing");
    }, undefined, { timeout: 210_000 });
    const assistantReply = await companion.page.locator(".companion-message.is-assistant").last().innerText();
    assert.ok(assistantReply.trim().length > 30, "Companion UI did not render the backend response");
    const pointerWriteFailures = await companion.page.evaluate(
      () => window.__solenosCompanionPointerWriteFailures || 0,
    );
    assert.ok(pointerWriteFailures >= 1, "the browser journey must exercise a failed optional Companion pointer write");
    await companion.page.getByRole("status", { name: "Care history coverage" }).waitFor({ timeout: 15_000 });
    await companion.page.getByText("How much of the saved care history was checked", { exact: true }).waitFor();
    await verifyMobile(companion.page);

    // Reload the browser and prove that the persisted conversation is retrieved
    // through the authenticated history endpoint, including the original user
    // message ID needed by the explicit "save as a care note" workflow.
    await companion.page.reload();
    const restoredMessage = companion.page.locator(".companion-message.is-user").filter({
      hasText: "What did the caregiver record about sleep and appetite?",
    }).last();
    await restoredMessage.waitFor({ timeout: 20_000 });
    await restoredMessage.getByRole("button", { name: "Save as a care note" }).waitFor({ timeout: 10_000 });
    await companion.page.getByText("How much of the saved care history was checked", { exact: true }).waitFor();

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

  await companion.page.evaluate(() => {
    window.__solenosCareRecordRefreshCount = 0;
    window.addEventListener("careRecordUpdated", () => {
      window.__solenosCareRecordRefreshCount += 1;
    });
  });
  await reviewCard.getByRole("button", { name: "Add to Care Record" }).click();
  await companion.page.getByText(
    "Your report was added to the Care Record. A healthcare professional has not confirmed it.",
    { exact: true },
  ).waitFor({ timeout: 15_000 });
  const lcrRefreshCount = await companion.page.evaluate(() => window.__solenosCareRecordRefreshCount || 0);
  assert.ok(lcrRefreshCount >= 1, "accepting a Companion report must notify mounted canonical LCR consumers");
  const afterAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(afterAcceptance.status, 200, JSON.stringify(afterAcceptance.payload));
  assert.ok(
    JSON.stringify(afterAcceptance.payload).includes(observationText),
    "the explicitly accepted Companion report must appear in the same persisted Care Record",
  );

  // Reviewed versions remain retrievable, and the caregiver can inspect the
  // append-only decision history after the pending card disappears.
  await companion.page.getByRole("button", { name: "Previous decisions" }).click();
  const reviewedCard = companion.page.locator(".companion-reviewed-care-updates .companion-care-update").filter({ hasText: observationText }).first();
  await reviewedCard.waitFor({ timeout: 15_000 });
  await reviewedCard.getByRole("button", { name: "Review history" }).click();
  await reviewedCard.getByText("accepted", { exact: true }).first().waitFor({ timeout: 15_000 });

  // A correction creates a new pending version and must not update the LCR
  // until that corrected version receives a separate explicit acceptance.
  const correctionSource = "Mum was unsettled for four evenings.";
  const correctedSource = "Mum was unsettled for two evenings.";
  const correctionContext = "Correction: Mum was unsettled for two evenings, not four.";
  const assistantCountBeforeCorrection = await companion.page.locator(".companion-message.is-assistant").count();
  await companion.page.locator("#companion-message-input").fill(correctionSource);
  await companion.page.locator("#companion-message-input").press("Enter");
  await companion.page.waitForFunction((count) => {
    const messages = Array.from(document.querySelectorAll(".companion-message.is-assistant"));
    return messages.length > count && !messages[messages.length - 1].querySelector(".companion-typing");
  }, assistantCountBeforeCorrection, { timeout: 210_000 });
  const correctionMessage = companion.page.locator(".companion-message.is-user").filter({ hasText: correctionSource }).last();
  await correctionMessage.getByRole("button", { name: "Save as a care note" }).click();
  await correctionMessage.getByRole("button", { name: "Yes, save for review" }).click();
  const correctionCard = companion.page.locator(".companion-care-update").filter({ hasText: correctionSource }).last();
  await correctionCard.waitFor({ timeout: 15_000 });
  await correctionCard.getByRole("button", { name: "Correct wording" }).click();
  await correctionCard.getByLabel("Corrected wording").fill(correctedSource);
  await correctionCard.getByLabel("Additional context (optional)").fill(correctionContext);
  await correctionCard.getByRole("button", { name: "Save correction for review" }).click();
  await companion.page.getByText(
    "Correction saved as a new review item. Nothing has been added to your Care Record yet.",
    { exact: true },
  ).waitFor({ timeout: 15_000 });
  const correctedCard = companion.page.locator(".companion-care-update").filter({ hasText: correctedSource }).last();
  await correctedCard.waitFor({ timeout: 15_000 });
  const beforeCorrectedAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(beforeCorrectedAcceptance.status, 200, JSON.stringify(beforeCorrectedAcceptance.payload));
  assert.equal(JSON.stringify(beforeCorrectedAcceptance.payload).includes(correctedSource), false);
  await correctedCard.getByRole("button", { name: "Add to Care Record" }).click();
  await companion.page.getByText(
    "Your report was added to the Care Record. A healthcare professional has not confirmed it.",
    { exact: true },
  ).waitFor({ timeout: 15_000 });
  const afterCorrectedAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(afterCorrectedAcceptance.status, 200, JSON.stringify(afterCorrectedAcceptance.payload));
  assert.ok(JSON.stringify(afterCorrectedAcceptance.payload).includes(correctedSource));
  assert.equal(JSON.stringify(afterCorrectedAcceptance.payload).includes(correctionSource), false);

  const correctedHistoryCard = companion.page.locator(".companion-reviewed-care-updates .companion-care-update").filter({ hasText: correctionSource }).first();
  await correctedHistoryCard.waitFor({ timeout: 15_000 });
  await correctedHistoryCard.getByRole("button", { name: "Review history" }).click();
  await correctedHistoryCard.getByText("corrected", { exact: true }).first().waitFor({ timeout: 15_000 });
  }
  await companion.context.close();
});

await record("Companion retry preserves one turn and recovers after a transient network failure", async () => {
  const retryCompanion = await createBrowserPage(session, "/workspace/companion");
  let messageAttempts = 0;
  await retryCompanion.page.route("**/api/v1/conversation/message", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    messageAttempts += 1;
    if (messageAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Temporary test interruption." }),
      });
      return;
    }
    await route.continue();
  });
  const retryInput = retryCompanion.page.locator("#companion-message-input");
  if (await retryInput.isDisabled()) {
    assert.notEqual(
      process.env.SOLENOS_REQUIRE_LIVE_QWEN,
      "1",
      "Companion retry must be interactive when live Qwen is explicitly required",
    );
    await retryCompanion.page.getByText(/Responses are not available right now/).waitFor({ timeout: 10_000 });
    await retryCompanion.context.close();
    return;
  }
  const retryText = "Thanks. Can we take this one question at a time?";
  await retryInput.fill(retryText);
  await retryInput.press("Enter");
  await retryCompanion.page.getByText(
    /Care Assistant is temporarily unavailable|Care Assistant could not respond/,
  ).waitFor({ timeout: 15_000 });
  assert.equal(
    await retryInput.inputValue(),
    retryText,
    "a failed send must preserve the caregiver's exact message for retry",
  );
  await retryInput.press("Enter");
  await retryCompanion.page.waitForFunction(() => {
    const messages = Array.from(document.querySelectorAll(".companion-message.is-assistant"));
    return messages.length > 0 && !messages[messages.length - 1].querySelector(".companion-typing");
  }, undefined, { timeout: 210_000 });
  assert.equal(messageAttempts, 2, "the first request must fail and the second must reach the real backend");
  assert.equal(
    await retryCompanion.page.locator(".companion-message.is-user").filter({ hasText: retryText }).count(),
    1,
    "retry must not render duplicate caregiver messages",
  );
  await retryCompanion.page.reload();
  await retryCompanion.page.locator(".companion-message.is-user").filter({ hasText: retryText }).waitFor({ timeout: 20_000 });
  assert.equal(
    await retryCompanion.page.locator(".companion-message.is-user").filter({ hasText: retryText }).count(),
    1,
    "the server-restored conversation must contain one copy of the retried turn",
  );
  await retryCompanion.context.close();
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
  assert.equal(skipQuestion.status, "open", "a new clarification question must begin open");

  const { context, page } = await createBrowserPage(session, "/workspace/care-continuity");
  // Clarification sits inside the secondary care-record details disclosure.
  // Open that container first; keep the first-screen summary compact.
  const careDetails = page.locator("details.lcr-history-details.lcr-progressive-disclosure").first();
  await careDetails.locator(":scope > summary").click();
  await page.waitForFunction(() => document.querySelector("details.lcr-history-details.lcr-progressive-disclosure")?.open === true);
  const clarificationDetails = page.locator("#lcr-clarification-workflow > details");
  await clarificationDetails.locator(":scope > summary").click();
  await page.waitForFunction(() => document.querySelector("#lcr-clarification-workflow > details")?.open === true);
  await page.getByRole("heading", { name: "Questions to check" }).waitFor({ timeout: 20_000 });
  await page.getByText(answerQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(answerQuestionText, { exact: true }).first().click();
  await page.getByRole("button", { name: "Add what you know", exact: true }).click();
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
  // The answer was saved with provenance above. The invariant is that an unlinked answer cannot be promoted; do not couple this check to optional explanatory copy.
  assert.equal(
    await page.getByRole("button", { name: "Save as caregiver update", exact: true }).count(),
    0,
    "an unlinked clarification must not offer a review action that cannot be completed",
  );

  await page.evaluate(() => window.dispatchEvent(new Event("careRecordUpdated")));
  await page.getByText(skipQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(skipQuestionText, { exact: true }).first().click();
  await page.getByText("You can leave this unanswered if you do not know.", { exact: false }).waitFor({ timeout: 10_000 });
  assert.equal(
    await page.getByRole("button", { name: "I don't know the answer yet", exact: true }).count(),
    0,
    "leaving a question unanswered must not require a status-changing action",
  );

  const questions = await request("/api/v1/uncertainty/questions/" + identity.personId, { token: identity.token });
  assert.equal(questions.status, 200, JSON.stringify(questions.payload));
  assert.equal(
    questions.payload.find((row) => row.id === skipQuestion.id)?.status,
    skipQuestion.status,
    "leaving the question unanswered must preserve its original open status",
  );
  const answeredQuestions = await request(
    "/api/v1/uncertainty/questions/" + identity.personId + "?status=answered",
    { token: identity.token },
  );
  assert.equal(answeredQuestions.status, 200, JSON.stringify(answeredQuestions.payload));
  assert.equal(answeredQuestions.payload.find((row) => row.id === answerQuestion.id)?.status, "answered");
  await page.reload({ waitUntil: "domcontentloaded" });
  // The LCR details and clarification archive intentionally collapse after
  // navigation so the first care screen stays concise. Reopen them explicitly.
  await careDetails.locator(":scope > summary").click();
  await page.waitForFunction(() => document.querySelector("details.lcr-history-details.lcr-progressive-disclosure")?.open === true);
  await clarificationDetails.locator(":scope > summary").click();
  await page.waitForFunction(() => document.querySelector("#lcr-clarification-workflow > details")?.open === true);
  await page.getByRole("heading", { name: "Questions to check" }).waitFor({ timeout: 20_000 });
  await page.getByText(skipQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText("See questions already answered", { exact: true }).click();
  await page.getByRole("button", { name: new RegExp(answerQuestionText) }).click();
  await page.getByText(exactAnswer, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(exactProvenance, { exact: false }).first().waitFor({ timeout: 15_000 });
  await page.getByText("Previous answers", { exact: true }).waitFor();
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
        title="E2E sleep evidence review",
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

  const detailResponse = await request(
    `/api/v1/change/situations/${encodeURIComponent(identity.personId)}/${encodeURIComponent(situationId)}/detail`,
    { token: identity.token },
  );
  assert.equal(detailResponse.status, 200, JSON.stringify(detailResponse.payload));
  const linkedSource = detailResponse.payload.source_records.find((row) => row.id === dailyCaptureEventId);
  assert.ok(linkedSource, `situation detail must resolve its linked persisted care event; returned sources: ${JSON.stringify(detailResponse.payload.source_records)}`);
  assert.match(linkedSource.excerpt ?? "", /restless sleep and three overnight awakenings/i,
    "the detail API must expose the caregiver-authored source sentence, not only a derived situation summary");

  const { context, page } = await createBrowserPage(session, "/workspace/care-continuity");
  await page.getByRole("button", { name: "View care history", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/workspace/timeline", { timeout: 15_000 });
  await page.getByText("How the care picture has changed", { exact: true }).click();
  await page.getByText("Care topics", { exact: true }).waitFor({ timeout: 20_000 });
  const situationCard = page.locator("article.lcr-timeline-item").filter({
    hasText: "E2E sleep evidence review",
  });
  await situationCard.waitFor({ state: "visible", timeout: 20_000 });
  await situationCard.getByRole("button", { name: "Review related notes and documents", exact: true }).click();
  await situationCard.locator(".lcr-evidence-list")
    .getByText("Caregiver reports restless sleep and three overnight awakenings.", { exact: true })
    .waitFor({ timeout: 15_000 });

  const reason = "The caregiver reports the sleep disruption is worse than the previous night.";
  await situationCard.getByLabel("Status shared by caregiver").selectOption("worsening");
  await situationCard.getByLabel("Reason for this status (required)").fill(reason);
  await situationCard.getByRole("button", { name: "Save status", exact: true }).click();
  const statusHistory = situationCard.locator("details").filter({
    hasText: "Previous status updates (1)",
  });
  await statusHistory.locator(":scope > summary").click();
  await statusHistory.getByText("Caregiver reports worsening", { exact: true }).waitFor();
  await statusHistory.getByText(reason, { exact: true }).waitFor();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("How the care picture has changed", { exact: true })
    .click();
  const reloadedCard = page.locator("article.lcr-timeline-item").filter({
    hasText: "E2E sleep evidence review",
  });
  await reloadedCard.waitFor({ state: "visible", timeout: 20_000 });
  const reloadedHistory = reloadedCard.locator("details").filter({
    hasText: "Previous status updates (1)",
  });
  await reloadedHistory.locator(":scope > summary").click();
  await reloadedHistory.getByText(reason, { exact: true }).waitFor();
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

  const privacyBrowser = await createBrowserPage(deletionSession, "/workspace/settings");
  const privacySection = privacyBrowser.page.locator("#settings-privacy:visible");
  await privacySection.waitFor({ state: "visible", timeout: 20_000 });
  const privacyDisclosure = privacySection.locator(":scope > summary");
  const privacyIsOpen = await privacySection.evaluate((element) =>
    element instanceof HTMLDetailsElement && element.open
  );
  if (!privacyIsOpen) await privacyDisclosure.click();
  await privacySection.evaluate(async (element) => {
    if (!(element instanceof HTMLDetailsElement)) throw new Error("Privacy settings must use a disclosure section");
    if (!element.open) throw new Error("Privacy settings disclosure did not open after user interaction");
  });
  const authoritySelect = privacySection.locator("#erasure-authority");
  await authoritySelect.waitFor({ state: "visible", timeout: 10_000 });
  await authoritySelect.scrollIntoViewIfNeeded();
  await authoritySelect.selectOption("self");
  await privacyBrowser.page.getByLabel(/I confirm that the authority information above is accurate/).check();
  const submitErasure = privacyBrowser.page.getByRole("button", { name: "Submit care-record erasure request", exact: true });
  await submitErasure.click();
  await privacyBrowser.page.getByText("Request received. Reference:", { exact: false }).waitFor({ timeout: 20_000 });
  await privacyBrowser.page.getByText("This is a request only.", { exact: false }).waitFor();

  const requestList = await request("/api/v1/privacy/requests", { token });
  assert.equal(requestList.status, 200, JSON.stringify(requestList.payload));
  const deletionRequests = requestList.payload.requests.filter((item) => item.request_type === "deletion");
  assert.equal(deletionRequests.length, 1, "the Settings flow must persist one care-record erasure request");
  const requestId = deletionRequests[0].id;
  assert.equal(deletionRequests[0].status, "received_pending_authority_review");

  const duplicate = await request("/api/v1/privacy/requests", {
    token,
    method: "POST",
    body: {
      request_type: "deletion",
      authority_basis: "self",
      authority_attested: true,
    },
  });
  assert.equal(duplicate.status, 409, JSON.stringify(duplicate.payload));
  assert.equal(duplicate.payload.detail.code, "deletion_request_already_open");
  assert.equal(duplicate.payload.detail.request.id, requestId);

  const privacyHistoryResponsePromise = privacyBrowser.page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/privacy/requests" && response.request().method() === "GET";
  }, { timeout: 20_000 });
  await privacyBrowser.page.reload({ waitUntil: "domcontentloaded" });
  const privacyHistoryResponse = await privacyHistoryResponsePromise;
  const privacyHistoryPayload = await privacyHistoryResponse.json();
  assert.equal(privacyHistoryResponse.status(), 200, JSON.stringify(privacyHistoryPayload));
  assert.ok(
    privacyHistoryPayload.requests?.some((item) => item.id === requestId),
    `Reloaded browser session did not retrieve its persisted erasure request. Payload=${JSON.stringify(privacyHistoryPayload)}; fetchTrace=${JSON.stringify(await privacyBrowser.page.evaluate(() => window.__solenosE2EFetchTrace ?? []))}`,
  );
  await privacyBrowser.page.getByText("Loading previous requests…", { exact: true }).waitFor({ state: "hidden", timeout: 20_000 });
  const privacyIsOpenAfterReload = await privacySection.evaluate((element) =>
    element instanceof HTMLDetailsElement && element.open
  );
  if (!privacyIsOpenAfterReload) await privacyDisclosure.click();
  await privacySection.evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement) || !element.open) {
      throw new Error("Privacy settings disclosure must be reopened after reload before checking its contents");
    }
  });
  await privacySection.getByText("Request history", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await privacySection.getByText("You already have an erasure request awaiting review.", { exact: false }).waitFor({ state: "visible" });
  assert.equal(await submitErasure.isDisabled(), true, "an open erasure request must block duplicate UI submission after reload");
  await privacyBrowser.context.close();

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
               AND metadata->'fulfilment'->>'operation' = 'deletion') AS redacted_receipts,
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

await record("16 clearing this device revokes the session and removes SolenOS browser state only", async () => {
  const cleanupSession = await newSession("local device cleanup");
  const cleanupIdentity = auth(cleanupSession);
  const { context, page } = await createBrowserPage(cleanupSession, "/workspace/settings");
  const privacySettings = page.locator("#settings-privacy");
  await privacySettings.waitFor({ state: "visible", timeout: 20_000 });
  const privacySettingsOpen = await privacySettings.evaluate((element) =>
    element instanceof HTMLDetailsElement && element.open
  );
  if (!privacySettingsOpen) await privacySettings.locator(":scope > summary").click();
  await privacySettings.evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement) || !element.open) {
      throw new Error("Privacy settings must be open before checking local device cleanup");
    }
  });
  const clearDeviceButton = privacySettings.getByRole("button", { name: "Clear saved information from this device", exact: true });
  await clearDeviceButton.waitFor({ state: "visible", timeout: 10_000 });
  await page.evaluate(() => {
    localStorage.setItem("solenos:daily-care:last-opened:synthetic:caregiver", "synthetic");
    localStorage.setItem("unrelated-test-key", "preserve");
    sessionStorage.setItem("temporary-test-key", "clear");
  });
  await clearDeviceButton.click();
  await privacySettings.getByRole("button", { name: "Clear now", exact: true }).click();
  await page.getByText("Saved SolenOS information and this browser's push subscription were cleared.", { exact: true }).waitFor({ timeout: 10_000 });

  const remaining = await page.evaluate(() => ({
    solenosKeys: Object.keys(localStorage).filter((key) => key.startsWith("solenos_") || key.startsWith("solenos:")),
    deletionMarker: localStorage.getItem("solenos_anonymous_session_revoked"),
    onboarding: localStorage.getItem("onboarding_complete"),
    unrelated: localStorage.getItem("unrelated-test-key"),
    sessionStorageCount: sessionStorage.length,
  }));
  assert.deepEqual(remaining.solenosKeys, ["solenos_anonymous_session_revoked"], JSON.stringify(remaining));
  assert.ok(remaining.deletionMarker, "device cleanup must retain a local tombstone that blocks silent record recreation");
  assert.equal(remaining.onboarding, null, JSON.stringify(remaining));
  assert.equal(remaining.unrelated, "preserve", JSON.stringify(remaining));
  assert.equal(remaining.sessionStorageCount, 0, JSON.stringify(remaining));

  const revoked = await request(`/api/v1/persons/${encodeURIComponent(cleanupIdentity.personId)}`, { token: cleanupIdentity.token });
  assert.equal(revoked.status, 401, "clearing the device must revoke the server-issued anonymous session");
  await page.waitForURL((url) => url.pathname === "/start", { timeout: 10_000 });
  await context.close();
});


await record("17 saved Care History review actions preserve caregiver choice on mobile", async () => {
  const reviewSession = await newSession("suggested detail review UI");
  const { context, page, pageErrors } = await createBrowserPage(
    reviewSession,
    "/workspace/daily-care",
    { width: 390, height: 844 },
  );
  const analysisId = "e2e-review-analysis";
  const candidates = [
    { subject: "sleep", observation: "Mum slept poorly last night.", source_quote: "Mum slept poorly last night.", review_status: "pending_review" },
    { subject: "appetite", observation: "Mum ate very little at lunch.", source_quote: "Mum ate very little at lunch.", review_status: "pending_review" },
    { subject: "mood", observation: "Mum seemed unsettled this morning.", source_quote: "Mum seemed unsettled this morning.", review_status: "pending_review" },
  ];
  const decisions = [];
  await page.route("**/api/v1/care-continuity/current-care**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [{
      id: "e2e-daily-care-source",
      title: "Daily Care update",
      description: "A saved update is ready for review.",
      source_type: "caregiver_report",
      event_type: "natural_language_update",
    }] }),
  }));
  await page.route("**/api/v1/daily-care/intelligence/history**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      records: [{
        id: "e2e-daily-care-source",
        source_id: "e2e-daily-care-source",
        source_type: "care_event",
        title: "Daily Care update",
        description: "A saved update is ready for review.",
        event_type: "natural_language_update",
        recorded_at: new Date().toISOString(),
        capture_processing: {
          analysis_id: analysisId,
          extraction_status: "available",
          job_status: "completed",
          review_required: true,
          message: "Your original note is saved. Check these details before adding them to your Care Record.",
        },
      }],
      page: { has_more: false },
    }),
  }));
  await page.route("**/api/v1/open-loops**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/notifications**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/documents/status**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route(`**/api/v1/capture/analyses/${analysisId}**`, async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ analysis_id: analysisId, extraction_status: "available", candidates: { observations: candidates }, review_required: true }),
      });
    }
    const body = route.request().postDataJSON();
    const candidate = candidates[body.candidate_index];
    assert.ok(candidate, "review action must address an existing candidate");
    assert.equal(body.expected_source_quote, candidate.source_quote ?? "");
    assert.equal(body.expected_subject, candidate.subject ?? "");
    assert.equal(body.expected_observation, candidate.observation ?? "");
    assert.equal(body.expected_corrected_subject, candidate.corrected_subject ?? "");
    assert.equal(body.expected_corrected_observation, candidate.corrected_observation ?? "");
    decisions.push({ ...body });
    if (body.decision === "correct") {
      candidate.corrected_subject = body.corrected_subject;
      candidate.corrected_observation = body.corrected_observation;
      candidate.review_status = "corrected_pending_approval";
    } else if (body.decision === "accept") {
      candidate.review_status = "accepted_by_caregiver";
    } else {
      candidate.review_status = "rejected_by_caregiver";
    }
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        analysis_id: analysisId,
        candidate: { ...candidate },
        review_decision: body.decision,
        written_to_lcr: body.decision === "accept",
        message: body.decision === "accept"
          ? "The reviewed detail was added to the care record."
          : body.decision === "correct"
            ? "Correction saved. It still needs approval before it becomes part of the care record."
            : "Suggestion dismissed. No care-record detail was added.",
      }),
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Updates to check", exact: true }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Review suggested details", exact: true }).click();
  const review = page.getByRole("region", { name: "Review suggested care details" });
  await review.waitFor({ state: "visible", timeout: 10_000 });
  await review.getByRole("button", { name: "Close review", exact: true }).click();
  await page.goto(new URL("/workspace/timeline", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Care history", exact: true }).waitFor({ timeout: 20_000 });
  await page.locator(".timeline-event-toggle").first().click();
  await page.getByRole("button", { name: "Review suggested details", exact: true }).click();
  await review.waitFor({ state: "visible", timeout: 10_000 });
  await review.getByText("From your note", { exact: true }).first().waitFor();
  await review.getByRole("button", { name: "Accept and add to care record", exact: true }).nth(0).click();
  await review.getByText("Accepted and added to the care record", { exact: true }).waitFor();
  await review.getByRole("button", { name: "Correct", exact: true }).nth(0).click();
  const subject = review.getByRole("textbox", { name: "Suggested detail subject 2", exact: true });
  await subject.fill("Eating");
  await review.getByRole("textbox", { name: "Suggested detail observation 2", exact: true }).fill("Mum ate a small amount at lunch.");
  await review.getByRole("button", { name: "Save correction", exact: true }).click();
  await review.getByText("Correction saved — waiting for approval", { exact: true }).waitFor();
  await review.getByText("Correction saved. It still needs approval before it becomes part of the care record.", { exact: true }).waitFor();
  const thirdCandidate = review.locator("article").nth(2);
  await thirdCandidate.getByRole("button", { name: "Correct", exact: true }).click();
  await thirdCandidate.getByRole("textbox", { name: "Suggested detail subject 3", exact: true }).fill("Unsaved subject change");
  await thirdCandidate.getByRole("textbox", { name: "Suggested detail observation 3", exact: true }).fill("Unsaved observation change.");
  await thirdCandidate.getByRole("button", { name: "Cancel", exact: true }).click();
  await thirdCandidate.getByText("mood", { exact: true }).waitFor();
  await thirdCandidate.getByText("Mum seemed unsettled this morning.", { exact: true }).first().waitFor();
  await thirdCandidate.getByRole("button", { name: "Dismiss", exact: true }).click();
  await thirdCandidate.getByText("Dismissed", { exact: true }).waitFor();
  assert.deepEqual(decisions.map((item) => item.decision), ["accept", "correct", "reject"]);
  assert.equal(decisions[1].corrected_subject, "Eating");
  assert.equal(decisions[1].corrected_observation, "Mum ate a small amount at lunch.");
  assert.equal(candidates[1].review_status, "corrected_pending_approval", "correction must not silently become an accepted LCR item");
  assert.equal(candidates[2].review_status, "rejected_by_caregiver", "dismissal must remain distinct from acceptance");
  await verifyMobile(page);
  assert.deepEqual(pageErrors, [], `suggested-detail review must not throw browser errors: ${JSON.stringify(pageErrors)}`);
  await context.close();
});

const responsiveViewports = [
  { name: "small phone", width: 320, height: 568 },
  { name: "compact phone", width: 360, height: 640 },
  { name: "standard phone", width: 390, height: 844 },
  { name: "large phone", width: 430, height: 932 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "small desktop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide desktop", width: 1920, height: 1080 },
];
const responsiveRoutes = [
  "/workspace",
  "/workspace/daily-care",
  "/workspace/appointments",
  "/workspace/open-loops",
  "/workspace/more",
  "/workspace/timeline",
  "/workspace/companion",
  "/workspace/documents",
  "/workspace/reminders",
  "/workspace/handoffs",
  "/workspace/notifications",
  "/workspace/care-continuity",
  "/workspace/settings",
];
let responsiveChecks = 0;
for (const viewport of responsiveViewports) {
  const responsive = await createBrowserPage(session, "/workspace", {
    width: viewport.width,
    height: viewport.height,
  });
  try {
    for (const route of responsiveRoutes) {
      await responsive.page.goto(new URL(route, frontend).toString(), { waitUntil: "domcontentloaded" });
      await responsive.page.locator("main").first().waitFor({ state: "visible", timeout: 20_000 });
      await responsive.page.waitForTimeout(200);
      const metrics = await responsive.page.evaluate(() => {
        const main = document.querySelector("main");
        const rect = main?.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body?.scrollWidth ?? 0,
          mainPresent: Boolean(main),
          mainLeft: rect?.left ?? null,
          mainRight: rect?.right ?? null,
          mainWidth: rect?.width ?? null,
          title: document.title,
        };
      });
      assert.ok(metrics.mainPresent, `Workspace route has no main content: ${route}`);
      assert.ok(
        metrics.documentWidth <= viewport.width + 1 && metrics.bodyWidth <= viewport.width + 1,
        `Horizontal overflow at ${viewport.name} (${viewport.width}x${viewport.height}) on ${route}: ${JSON.stringify(metrics)}`,
      );
      assert.ok(
        metrics.mainLeft !== null && metrics.mainLeft >= -1 &&
        metrics.mainRight !== null && metrics.mainRight <= viewport.width + 1 &&
        metrics.mainWidth !== null && metrics.mainWidth <= viewport.width + 1,
        `Main content exceeds the viewport at ${viewport.name} on ${route}: ${JSON.stringify(metrics)}`,
      );
      responsiveChecks += 1;
    }
    assert.deepEqual(
      responsive.pageErrors,
      [],
      `Responsive route rendering raised browser errors at ${viewport.name}: ${JSON.stringify(responsive.pageErrors)}`,
    );
  } finally {
    await responsive.context.close();
  }
}
process.stdout.write(
  `✓ Responsive workspace audit: ${responsiveChecks} route/viewport combinations across ${responsiveViewports.length} viewport sizes (320×568 through 1920×1080).\n`,
);

process.stdout.write(`\nCompleted ${results.length} critical journey checks.\n`);
await browser.close();
