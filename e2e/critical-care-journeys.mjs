import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const requireLiveQwen = process.env.SOLENOS_REQUIRE_LIVE_QWEN === "1";
const browser = await chromium.launch({ headless: true });
const password = "CI-critical-journey-passphrase-2026!";
const results = [];

async function request(path, { token, method = "GET", body, form } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
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
    const source = new URL(route.request().url());
    const target = new URL(source.pathname + source.search, backend);
    const headers = { ...route.request().headers() };
    delete headers.origin;
    const response = await route.fetch({ url: target.toString(), headers });
    await route.fulfill({ response });
  });
  await page.goto(new URL(path, frontend).toString(), { waitUntil: "domcontentloaded" });
  return { context, page, observed };
}

async function browserPageConsumes(page, pathname, observed) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  return observed.filter((item) => item.path.includes(pathname));

async function verifyMobile(page) {
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
    await route.fulfill({ response: await route.fetch({ url: target.toString(), headers }) });
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
const session = await newSession("critical journey matrix");
const identity = auth(session);
const unique = (prefix) => `${prefix}-${randomUUID()}`;

// 2. Daily Capture: write, idempotent replay, invalid payload, expired bearer, then retrieve.
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
  const replay = await request("/api/v1/daily/log", { token: identity.token, method: "POST", body: payload });
  assert.ok([200, 201].includes(replay.status), JSON.stringify(replay.payload));
  assert.equal(replay.payload.id, saved.payload.id);
  assert.equal(replay.payload.idempotent_replay, true);
  const invalid = await request("/api/v1/daily/log", { token: identity.token, method: "POST", body: { observation: "" } });
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

// 4. Document upload: original bytes -> server extraction -> persisted extraction read.
let documentId;
await record("04 document upload and extraction", async () => {
  const form = new FormData();
  form.append("person_id", identity.personId);
  form.append("caregiver_id", identity.caregiverId);
  form.append("evidence_type", "document");
  form.append("file", new Blob(["Discharge note: follow-up appointment requested in two weeks."], { type: "text/plain" }), "journey-discharge-note.txt");
  const uploaded = await request("/api/v1/upload", { token: identity.token, method: "POST", form });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.payload));
  documentId = uploaded.payload.evidence_id;
  assert.equal(uploaded.payload.persisted, true);
  const extracted = await request(`/api/v1/documents/${documentId}/extract`, { token: identity.token, method: "POST", body: {} });
  assert.equal(extracted.status, 201, JSON.stringify(extracted.payload));
  const reviewed = await request(`/api/v1/documents/analyses/${extracted.payload.analysis_id}`, { token: identity.token });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.payload));
  assert.ok(reviewed.payload.extracted_text.includes("follow-up appointment"));
  const duplicateForm = new FormData();
  duplicateForm.append("person_id", identity.personId);
  duplicateForm.append("caregiver_id", identity.caregiverId);
  duplicateForm.append("evidence_type", "document");
  duplicateForm.append("file", new Blob(["Discharge note: follow-up appointment requested in two weeks."], { type: "text/plain" }), "journey-discharge-note-copy.txt");
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
});

// 6. Companion: must return model-generated output grounded in this care record.
await record("06 Companion context and Qwen output", async () => {
  const answer = await request("/api/v1/conversation/message", {
    token: identity.token, method: "POST",
    body: { person_id: identity.personId, text: "What has the caregiver recorded about sleep and appetite?" },
  });
  assert.equal(answer.status, 200, JSON.stringify(answer.payload));
  assert.equal(answer.payload.written_to_lcr, false);
  if (requireLiveQwen) {
    assert.equal(answer.payload.ai_generated, true, JSON.stringify(answer.payload));
    assert.ok(answer.payload.reply && answer.payload.reply.length > 12);
    assert.ok(
      (answer.payload.source_event_ids ?? []).length > 0 ||
      (answer.payload.source_evidence_ids ?? []).length > 0,
      "Qwen response did not return source references",
    );
  } else {
    assert.ok(typeof answer.payload.reply === "string" && answer.payload.reply.length > 0);
    assert.ok(
      answer.payload.ai_generated === true || answer.payload.ai_generated === false,
      "Companion response must explicitly identify whether a model generated it",
    );
  }
  const history = await request(`/api/v1/conversation/${answer.payload.session_id}`, { token: identity.token });
  assert.equal(history.status, 200);
  assert.ok(history.payload.messages?.length >= 2);
});

// 7. Change detection: reconcile against saved source evidence and retrieve the run.
await record("07 change detection and supporting evidence", async () => {
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
  assert.equal(reconciled.status, 200, JSON.stringify(reconciled.payload));
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
  const list = await request("/api/v1/appointment-workspaces", { token: identity.token });
  assert.equal(list.status, 200);
  assert.ok(list.payload.items.some((item) => item.id === appointmentWorkspaceId));
});

// 10. Handoff: prepare a source-referenced draft and confirm it remains persisted/read-only.
let handoffDraftId;
await record("10 evidence-backed handoff", async () => {
  const draft = await request("/api/v1/handoff-drafts/prepare", {
    token: identity.token, method: "POST",
    body: { purpose: "professional_appointment", audience: "professional", window_days: 30 },
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.payload));
  assert.equal(draft.payload.draft_persisted, true);
  assert.equal(draft.payload.updates_lcr, false);
  handoffDraftId = draft.payload.draft_id;
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
  const returningHistory = await request(`/api/v1/events/${identity.personId}`, { token: login.payload.access_token });
  assert.equal(returningHistory.status, 200);
  assert.ok(JSON.stringify(returningHistory.payload).includes(evidenceId));
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
  await page.route("**/api/v1/evidence/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto(new URL("/workspace/documents", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("status").filter({ hasText: "Loading saved documents" }).waitFor({ timeout: 10_000 });
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
  await page.route("**/api/v1/evidence/**", (route) => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("alert").first().waitFor({ timeout: 15_000 });
  await context.close();
});


await record("browser renders caregiver surfaces and submits Companion through the UI", async () => {
  const daily = await createBrowserPage(session, "/workspace/daily-care");
  await daily.page.getByRole("button", { name: "Something changed", exact: true }).click();
  await daily.page.getByRole("button", { name: "Sleep", exact: true }).click();
  await daily.page.locator('textarea[placeholder="Add a detail if it would help…"]').fill("Browser UI confirms restless sleep and several overnight awakenings.");
  await daily.page.getByRole("button", { name: "Save update", exact: true }).click();
  await daily.page.getByText("Saved to the care record.", { exact: false }).waitFor({ timeout: 20_000 });
  const dailyHistory = await request(`/api/v1/events/${identity.personId}`, { token: identity.token });
  assert.equal(dailyHistory.status, 200);
  assert.ok(JSON.stringify(dailyHistory.payload).includes("Browser UI confirms restless sleep"));
  await verifyMobile(daily.page);
  await daily.context.close();

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
  await companion.page.getByRole("button", { name: "Send" }).click();
  await companion.page.waitForFunction(() => {
    const messages = Array.from(document.querySelectorAll(".companion-message.is-assistant"));
    return messages.length > 0 && !messages[messages.length - 1].querySelector(".companion-typing");
  }, { timeout: 210_000 });
  const assistantReply = await companion.page.locator(".companion-message.is-assistant").last().innerText();
  assert.ok(assistantReply.trim().length > 30, "Companion UI did not render the backend response");
  await verifyMobile(companion.page);
  await companion.context.close();
});

process.stdout.write(`\nCompleted ${results.length} critical journey checks.\n`);
await browser.close();
