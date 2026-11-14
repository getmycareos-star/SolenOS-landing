import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const requireLiveQwen = process.env.SOLENOS_REQUIRE_LIVE_QWEN === "1";
const browser = await chromium.launch({ headless: true });
const password = "CI-critical-journey-passphrase-2026!";
const results = [];
let dailyScenarioEventIdsByReport = {};
let dailyScenarioEvidenceIdsByReport = {};

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

await record("01b visible Follow-ups button and mobile navigation", async () => {
  const { context, page } = await createBrowserPage(
    session,
    "/workspace/daily-care",
    { width: 390, height: 844 },
  );
  const viewFollowups = page.getByRole("button", { name: "View follow-ups", exact: true });
  await viewFollowups.waitFor({ state: "visible", timeout: 20_000 });
  await viewFollowups.click();
  await page.getByRole("heading", { name: "Follow-ups and questions", exact: true })
    .waitFor({ timeout: 20_000 });
  await verifyMobile(page);
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "Follow-ups", exact: true })
    .waitFor({ state: "visible", timeout: 10_000 });
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
await record("Daily Care Scenario 01 saves immediately and projects all four reports into LCR", async () => {
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
  const scenarioReports = [
    "Mum slept poorly last night and seemed more unsettled this morning.",
    "Mum barely touched her lunch today. She drank some water, though.",
    "I think the doctor changed Mum's medication yesterday, but I can't remember the new dose.",
    "Mum was calmer this evening. She ate a little more at dinner and is now resting.",
  ];

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
  await daily.page.getByRole("heading", { name: "Existing follow-ups", exact: true }).waitFor({ timeout: 15_000 });
  await daily.page.getByText("Contact the clinic about the appointment", { exact: true }).waitFor({ timeout: 15_000 });
  const dailyCaptureJobs = [];
  for (const [index, report] of scenarioReports.entries()) {
    dailyCaptureJobs.push(await saveFreeTextUpdate(report, index === 2 ? async () => {
      await daily.page.getByText(/The existing reviewed medication record lists: Metformin — 500 mg/i).waitFor({ timeout: 15_000 });
    } : undefined));
  }

  const waitForDailyCaptureJob = async ({ jobId }) => {
    const deadline = Date.now() + 300_000;
    let latest = null;
    while (Date.now() < deadline) {
      const status = await request(`/api/v1/assistant/jobs/${jobId}`, { token: identity.token });
      assert.equal(status.status, 200, JSON.stringify(status.payload));
      latest = status.payload;
      if (latest.status === "completed") {
        assert.equal(latest.daily_capture?.projection_status, "verified", JSON.stringify(latest));
        return latest;
      }
      assert.notEqual(latest.status, "failed", JSON.stringify(latest));
      assert.notEqual(latest.status, "cancelled", JSON.stringify(latest));
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    assert.fail(`Daily Care extraction job ${jobId} did not finish within 300 seconds: ${JSON.stringify(latest)}`);
  };
  const completedCaptureJobs = await Promise.all(dailyCaptureJobs.map(waitForDailyCaptureJob));
  assert.equal(completedCaptureJobs.length, 4);
  assert.ok(completedCaptureJobs.every((job) => job.daily_capture?.projection_status === "verified"));
  const minimumSourceObservations = [2, 2, 1, 3];
  completedCaptureJobs.forEach((job, index) => {
    assert.ok(
      Number(job.daily_capture?.source_grounded_observations_projected || 0) >= minimumSourceObservations[index],
      `Daily Care report ${index + 1} projected fewer than ${minimumSourceObservations[index]} independently supported observations: ${JSON.stringify(job.daily_capture)}`,
    );
  });
  const morningAnalysis = await request(
    `/api/v1/capture/analyses/${encodeURIComponent(completedCaptureJobs[0].daily_capture.analysis_id)}`,
    { token: identity.token },
  );
  assert.equal(morningAnalysis.status, 200, JSON.stringify(morningAnalysis.payload));
  assert.ok(
    morningAnalysis.payload.candidates.observations.some((item) =>
      item.extraction_origin === "deterministic_exact_clause_supplement"
      && /unsettled/i.test(item.observation || "")
    ),
    "the persisted Daily Care review analysis must retain the independently extracted unsettled clause",
  );
  const eveningAnalysis = await request(
    `/api/v1/capture/analyses/${encodeURIComponent(completedCaptureJobs[3].daily_capture.analysis_id)}`,
    { token: identity.token },
  );
  assert.equal(eveningAnalysis.status, 200, JSON.stringify(eveningAnalysis.payload));
  assert.ok(
    eveningAnalysis.payload.candidates.observations.some((item) =>
      item.extraction_origin === "deterministic_exact_clause_supplement"
      && /now resting/i.test(item.observation || "")
    ),
    "the persisted Daily Care review analysis must retain the independently extracted resting clause",
  );

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

  // Verify transfer of extracted details, not only the four parent source events.
  const projectedObservations = scenarioEvents.flatMap((event) =>
    lcrRowsByEvent.get(event.id)?.derived_observations || []
  );
  assert.equal(
    new Set(projectedObservations.map((item) => item.id)).size,
    projectedObservations.length,
    "LCR must not duplicate extracted observations",
  );
  const observationsBySource = new Map(scenarioReports.map((report) => [report, []]));
  for (const observation of projectedObservations) {
    const sourceReport = scenarioReports.find((report) =>
      typeof observation.source_passage === "string"
      && report.includes(observation.source_passage)
      && report.slice(observation.source_span_start, observation.source_span_end) === observation.source_passage
    );
    assert.ok(sourceReport, "every LCR observation must retain an exact, correctly positioned passage from its original caregiver report");
    assert.ok(observation.value_text && sourceReport.includes(observation.value_text),
      "an extracted observation must be a verbatim substring of its original report");
    assert.equal(
      sourceReport.slice(observation.source_span_start, observation.source_span_end),
      observation.source_passage,
      "LCR source positions must resolve to the original report",
    );
    observationsBySource.get(sourceReport).push(observation);
    if (sourceReport === scenarioReports[0]) {
      assert.match(observation.value_text, /sleep|slept|unsettled/i, "the morning report must not gain unrelated extracted details");
    } else if (sourceReport === scenarioReports[1]) {
      assert.match(observation.value_text, /lunch|water/i, "the lunch report must not gain unrelated extracted details");
    } else if (sourceReport === scenarioReports[2]) {
      assert.equal(observation.epistemic_status, "uncertain",
        "any extracted medication-change statement must remain tentative");
    } else if (sourceReport === scenarioReports[3]) {
      assert.match(observation.value_text, /calmer|dinner|rest/i, "the evening report must not gain unrelated extracted details");
    }
  }

  const findObservation = (report, pattern) =>
    observationsBySource.get(report).find((item) => pattern.test(item.value_text));
  const sleepObservation = findObservation(scenarioReports[0], /sleep.*poor|slept.*poor/i);
  const unsettledObservation = findObservation(scenarioReports[0], /unsettled/i);
  const lunchObservation = findObservation(scenarioReports[1], /barely.*lunch|lunch.*barely/i);
  const waterObservation = findObservation(scenarioReports[1], /drank.*water|water.*drank/i);
  const calmerObservation = findObservation(scenarioReports[3], /calmer/i);
  const dinnerObservation = findObservation(scenarioReports[3], /ate.*dinner|dinner.*ate/i);
  const restingObservation = findObservation(scenarioReports[3], /resting/i);
  for (const [label, observation] of [
    ["poor sleep", sleepObservation],
    ["unsettled morning", unsettledObservation],
    ["limited lunch", lunchObservation],
    ["water intake", waterObservation],
    ["calmer evening", calmerObservation],
    ["dinner", dinnerObservation],
    ["resting", restingObservation],
  ]) {
    assert.ok(observation, `LCR is missing the source-grounded ${label} observation`);
    assert.ok(observation.source_passage);
    assert.ok(Number.isInteger(observation.source_span_start));
    assert.ok(Number.isInteger(observation.source_span_end));
  }
  assert.equal(unsettledObservation.epistemic_status, "uncertain");
  assert.equal(unsettledObservation.hedge_marker, "seemed");
  assert.equal(waterObservation.epistemic_status, "reported");
  for (const [label, observation, timeWording] of [
    ["poor sleep", sleepObservation, "last night"],
    ["unsettled morning", unsettledObservation, "this morning"],
    ["limited lunch", lunchObservation, "today"],
    ["calmer evening", calmerObservation, "this evening"],
    ["dinner", dinnerObservation, "at dinner"],
    ["resting", restingObservation, "now"],
  ]) {
    assert.ok(observation.context?.includes(timeWording), `LCR lost the source time wording for ${label}`);
  }
  for (const medicationObservation of observationsBySource.get(scenarioReports[2])) {
    assert.equal(medicationObservation.epistemic_status, "uncertain");
    if (/changed|change|adjusted|increased|decreased/i.test(medicationObservation.value_text)) {
      assert.ok(medicationObservation.context?.includes("yesterday"));
    }
  }
  assert.ok(
    projectedObservations.every((item) =>
      item.epistemic_status === "uncertain" || !/\\b\\d+(?:\\.\\d+)?\\s*(?:mg|mcg|ml)\\b/i.test(item.value_text)
    ),
    "an unconfirmed medication report must never create a confirmed dose",
  );

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

  await daily.page.getByText("Needs confirmation", { exact: true }).waitFor({ timeout: 15_000 });
  await daily.page.getByText(scenarioReports[2], { exact: false }).first().waitFor({ timeout: 15_000 });
  await daily.page.reload({ waitUntil: "domcontentloaded" });
  await daily.page.getByText("Needs confirmation", { exact: true }).waitFor({ timeout: 15_000 });
  await daily.page.getByText("Contact the clinic about the appointment", { exact: true }).waitFor({ timeout: 15_000 });
  for (const report of scenarioReports) {
    await daily.page.getByText(report, { exact: false }).first().waitFor({ timeout: 15_000 });
  }
  await verifyMobile(daily.page);
  await daily.context.close();

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
  assert.ok(
    (questionAnswer.payload.source_lcr_context_ids || []).includes(caregiverQuestionId),
    "Companion must retrieve the source-validated caregiver question from the LCR question queue",
  );
  assert.ok(
    questionAnswer.payload.lcr_context_coverage?.sources?.caregiver_question_queue?.selected_for_answer > 0,
    "Companion must report that the validated caregiver question was actually supplied to Qwen",
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
  if (requireLiveQwen) assert.equal(overwhelmedAnswer.payload.ai_generated, true);
  const overloadReply = String(overwhelmedAnswer.payload.reply || "").trim();
  const overloadSentences = overloadReply.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  assert.ok(overloadReply.length > 0 && overloadReply.length <= 700, "Companion must keep an overwhelmed-caregiver response brief");
  assert.ok(overloadSentences.length <= 3, "Companion must not overwhelm the caregiver with a long response");
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
