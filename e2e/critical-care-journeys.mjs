import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const requireLiveQwen = process.env.SOLENOS_REQUIRE_LIVE_QWEN === "1";
const browser = await chromium.launch({ headless: true });
const password = "CI-critical-journey-passphrase-2026!";
const results = [];

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
    const response = await route.fetch({ url: target.toString(), headers, timeout: 210000 });
    await route.fulfill({ response });
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
    const response = await route.fetch({ url: target.toString(), headers, timeout: 210000 }).catch((error) => {
      if (page.isClosed()) return null;
      throw error;
    });
    if (response) await route.fulfill({ response });
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
  assert.equal(intelligence.status, 201, JSON.stringify(intelligence.payload));
  assert.ok(intelligence.payload.observations.length > 0, "Qwen did not produce a reviewable document candidate");
  assert.equal(intelligence.payload.written_to_lcr, false);
  const beforeAcceptance = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(beforeAcceptance.status, 200, JSON.stringify(beforeAcceptance.payload));
  assert.ok(!beforeAcceptance.payload.items.some((item) => JSON.stringify(item).includes(documentId)), "unreviewed document candidate appeared in the LCR");
  const accepted = await request("/api/v1/documents/intelligence/" + intelligence.payload.analysis_id + "/review", { token: identity.token, method: "POST", body: { candidate_index: 0, decision: "accept" } });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.payload));
  assert.equal(accepted.payload.written_to_lcr, true);
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
  const daily = await createBrowserPage(session, "/workspace/daily-care");
  const saveFreeTextUpdate = async (text) => {
    await daily.page.getByRole("button", { name: "Share something", exact: true }).click();
    await daily.page.getByRole("button", { name: /Something happened/ }).click();
    await daily.page.locator("#daily-capture-original-words").fill(text);
    await daily.page.getByRole("button", { name: "Save to care record", exact: true }).click();
    await daily.page.getByText(/^Saved\./).last().waitFor({ timeout: 20_000 });
    await daily.page.getByRole("button", { name: "Close capture", exact: true }).click();
  };
  const scenarioReports = [
    "Mum slept poorly last night and seemed more unsettled this morning.",
    "Mum barely touched her lunch today. She drank some water, though.",
    "I think the doctor changed Mum's medication yesterday, but I can't remember the new dose.",
    "Mum was calmer this evening. She ate a little more at dinner and is now resting.",
  ];
  const openLoopsBefore = await request("/api/v1/open-loops?limit=100&status=open", { token: identity.token });
  assert.equal(openLoopsBefore.status, 200, JSON.stringify(openLoopsBefore.payload));
  const openLoopIdsBefore = (openLoopsBefore.payload.items || []).map((item) => item.id).sort();
  for (const report of scenarioReports) await saveFreeTextUpdate(report);

  const dailyHistory = await request(`/api/v1/events/${identity.personId}`, { token: identity.token });
  assert.equal(dailyHistory.status, 200);
  const scenarioEvents = dailyHistory.payload.filter((row) =>
    scenarioReports.some((report) => JSON.stringify(row).includes(report))
  );
  assert.equal(scenarioEvents.length, 4, "all four original caregiver reports must remain independently retrievable");
  assert.equal(new Set(scenarioEvents.map((row) => row.id)).size, 4, "each report must have its own persisted event");
  assert.ok(scenarioEvents.every((row) => Array.isArray(row.evidence_ids) && row.evidence_ids.length === 1));

  const dailyEvidence = await request(`/api/v1/evidence/${identity.personId}`, { token: identity.token });
  assert.equal(dailyEvidence.status, 200);
  for (const reportEvent of scenarioEvents) {
    const source = dailyEvidence.payload.find((item) => item.id === reportEvent.evidence_ids[0]);
    assert.ok(source, "each natural-language update must have a retrievable source evidence record");
    assert.ok(JSON.stringify(source).includes(scenarioReports.find((report) => JSON.stringify(reportEvent).includes(report))));
  }

  const dailyLcr = await request("/api/v1/care-continuity/current-care?limit_per_source=50", { token: identity.token });
  assert.equal(dailyLcr.status, 200, JSON.stringify(dailyLcr.payload));
  for (const reportEvent of scenarioEvents) {
    const lcrRow = dailyLcr.payload.items.find((item) => item.id === reportEvent.id);
    assert.ok(lcrRow, "each saved report must be available through the existing LCR projection");
    assert.deepEqual(lcrRow.evidence_ids, reportEvent.evidence_ids);
    assert.equal(lcrRow.source_type, "caregiver_report");
  }

  const openLoopsAfter = await request("/api/v1/open-loops?limit=100&status=open", { token: identity.token });
  assert.equal(openLoopsAfter.status, 200, JSON.stringify(openLoopsAfter.payload));
  assert.deepEqual(
    (openLoopsAfter.payload.items || []).map((item) => item.id).sort(),
    openLoopIdsBefore,
    "natural-language observations and missing optional details must not manufacture follow-up tasks",
  );

  await daily.page.getByText("Needs confirmation", { exact: true }).waitFor({ timeout: 15_000 });
  await daily.page.getByText(scenarioReports[2], { exact: false }).first().waitFor({ timeout: 15_000 });
  await daily.page.reload({ waitUntil: "domcontentloaded" });
  await daily.page.getByText("Needs confirmation", { exact: true }).waitFor({ timeout: 15_000 });
  for (const report of scenarioReports) {
    await daily.page.getByText(report, { exact: false }).first().waitFor({ timeout: 15_000 });
  }
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
  }, undefined, { timeout: 210_000 });
  const assistantReply = await companion.page.locator(".companion-message.is-assistant").last().innerText();
  assert.ok(assistantReply.trim().length > 30, "Companion UI did not render the backend response");
  await verifyMobile(companion.page);
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
        necessity: "not_assessed",
        evidence_ids: [source.id],
        context: [{ source_kind: "critical_care_journey", source_id: source.id }],
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.payload));
    return created.payload;
  };
  const answerQuestion = await createQuestion(answerQuestionText);
  const skipQuestion = await createQuestion(skipQuestionText);

  const { context, page } = await createBrowserPage(session, "/workspace");
  await page.getByRole("heading", { name: "Care details that need checking" }).waitFor({ timeout: 20_000 });
  await page.getByText(answerQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(answerQuestionText, { exact: true }).first().click();
  const exactAnswer = "I observed this on " + tag + ".";
  const exactProvenance = "I was present and recorded it in the care note.";
  await page.getByLabel("Your answer").fill(exactAnswer);
  await page.getByLabel("Who provided this answer, and how do they know?").fill(exactProvenance);
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
  await page.getByRole("heading", { name: "Care details that need checking" }).waitFor({ timeout: 20_000 });
  await page.getByText(skipQuestionText, { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText("View answered and closed questions", { exact: true }).click();
  await page.getByRole("button", { name: new RegExp(answerQuestionText) }).click();
  await page.getByText(exactAnswer, { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText(exactProvenance, { exact: false }).waitFor({ timeout: 15_000 });
  await page.getByText("Earlier answers", { exact: true }).waitFor();
  await verifyMobile(page);
  await context.close();
});

process.stdout.write(`\nCompleted ${results.length} critical journey checks.\n`);
await browser.close();
