import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const timeoutMs = Number(process.env.DOCUMENT_TEST_TIMEOUT_MS ?? 120_000);
const browser = await chromium.launch({ headless: true });
const activeContexts = new Set();

async function closeContext(context) {
  for (const page of context.pages()) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
  await context.close().catch(() => {});
  activeContexts.delete(context);
}
const sourceText = [
  "Discharge note.",
  "Patient walked 20 metres with a frame on 12 October during the physiotherapy session.",
  "The patient ate half of lunch during the observation period.",
  "The caregiver reported that the patient slept poorly last night.",
].join("\n");
const filename = `synthetic-document-continuity-${randomUUID()}.txt`;

async function request(path, { token, method = "GET", body, form } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const attempts = method === "GET" ? 5 : 1;
  let result = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(new URL(path, backend), {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
    result = { status: response.status, payload, response };
    if (![429, 502, 503, 504].includes(response.status) || attempt === attempts) return result;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * attempt, 5_000)));
  }
  return result;
}

async function newSession() {
  let created = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    created = await request("/api/v1/sessions/anonymous", {
      method: "POST",
      body: { caregiver_name: "Synthetic document continuity browser test" },
    });
    if (created.status === 201) return created.payload;
    if (![429, 502, 503, 504].includes(created.status) || attempt === 6) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(2_000 * attempt, 10_000)));
  }
  assert.equal(created?.status, 201, JSON.stringify(created?.payload));
  return created.payload;
}

async function openDocuments(session) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  activeContexts.add(context);
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
  page.setDefaultTimeout(20_000);
  await page.route("**/api/**", async (route) => {
    const source = new URL(route.request().url());
    const target = new URL(source.pathname + source.search, backend);
    const headers = { ...route.request().headers() };
    delete headers.origin;
    const response = await route.fetch({ url: target.toString(), headers, timeout: 210_000 });
    await route.fulfill({ response });
  });
  await page.goto(new URL("/workspace/documents", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /documents/i }).first().waitFor();
  return { context, page };
}

async function pollDocument(session, evidenceId) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const result = await request("/api/v1/documents/intelligence", { token: session.access_token });
    if ([429, 502, 503, 504].includes(result.status)) {
      last = result.payload;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      continue;
    }
    assert.equal(result.status, 200, JSON.stringify(result.payload));
    last = result.payload;
    const analysis = (last.items || []).find((item) => item.source_evidence_id === evidenceId);
    if (analysis?.intelligence_status === "available") return analysis;
    const job = (last.processing_jobs || []).find((item) => item.evidence_id === evidenceId);
    if (job?.status === "failed") {
      throw new Error(`Deterministic document test job failed: ${job.error_code || "no error code"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Deterministic document test analysis timed out. Last response: ${JSON.stringify(last).slice(0, 1800)}`);
}

try {
  const session = await newSession();
  const { context, page } = await openDocuments(session);

  // Upload through the real Documents UI, not a direct API fixture.
  await page.locator('input[type="file"]').first().setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from(sourceText, "utf8"),
  });
  await page.getByRole("heading", { name: "Save your files", exact: true }).waitFor();
  await page.getByRole("button", { name: "Save files", exact: true }).click();

  let evidence = null;
  const uploadStarted = Date.now();
  while (Date.now() - uploadStarted < 30_000) {
    const listed = await request(`/api/v1/evidence/${encodeURIComponent(session.person.id)}`, {
      token: session.access_token,
    });
    if ([429, 502, 503, 504].includes(listed.status)) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    assert.equal(listed.status, 200, JSON.stringify(listed.payload));
    evidence = listed.payload.find((item) => {
      let metadata = item.extra_metadata;
      if (typeof metadata === "string") { try { metadata = JSON.parse(metadata); } catch { metadata = {}; } }
      return metadata?.filename === filename;
    });
    if (evidence?.id) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(evidence?.id, "the actual browser upload must create a persisted original document");
  const evidenceId = evidence.id;

  // Reload so the Documents page and review panel receive the persisted upload.
  // The backend may already have queued background reading; otherwise the caregiver
  // starts it from the review panel. Both are valid real-user paths.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /documents/i }).first().waitFor();
  await page.getByText(filename, { exact: true }).first().waitFor({ timeout: 30_000 });

  const readButton = page.getByRole("button", { name: "Read document", exact: true });
  const readButtonVisible = await readButton.isVisible().catch(() => false);
  if (readButtonVisible) {
    await readButton.click();
  } else {
    await page.getByText(/SolenOS is reading this document in the background/).waitFor({ timeout: 30_000 });
  }

  const analysis = await pollDocument(session, evidenceId);
  assert.equal(analysis.extraction_status, "available");
  assert.equal(analysis.intelligence_status, "available");
  assert.equal(analysis.review_required, true, "new model candidates must require caregiver review");
  assert.equal(analysis.written_to_lcr, false, "model output must not write care facts before caregiver acceptance");
  assert.equal(analysis.model_provenance?.provider, "unavailable_or_test_stub", "the saved analysis must identify the real test-only inference stub provider");
  assert.equal(analysis.model_provenance?.model_tag, null,
    "the saved analysis must not claim a configured model when deterministic test inference is used");
  assert.ok(Array.isArray(analysis.observations) && analysis.observations.length === 3,
    "the deterministic test extractor must produce three source-grounded review candidates");

  const mobilityCandidate = analysis.observations.find((item) =>
    typeof item.source_quote === "string" && item.source_quote.includes("walked 20 metres"),
  );
  const nutritionCandidate = analysis.observations.find((item) =>
    typeof item.source_quote === "string" && item.source_quote.includes("ate half of lunch"),
  );
  const sleepCandidate = analysis.observations.find((item) =>
    typeof item.source_quote === "string" && item.source_quote.includes("slept poorly"),
  );
  assert.ok(mobilityCandidate && nutritionCandidate && sleepCandidate,
    `The deterministic extractor must return the three verbatim test observations. Candidates: ${JSON.stringify(analysis.observations).slice(0, 2400)}`);

  const candidateIndexFor = (candidate) => typeof candidate.candidate_index === "number"
    ? candidate.candidate_index
    : analysis.observations.indexOf(candidate);
  const mobilityIndex = candidateIndexFor(mobilityCandidate);
  const nutritionIndex = candidateIndexFor(nutritionCandidate);
  const sleepIndex = candidateIndexFor(sleepCandidate);
  assert.ok([mobilityIndex, nutritionIndex, sleepIndex].every((index) => index >= 0),
    "each source-grounded candidate must retain its persisted index");

  const extracted = await request(`/api/v1/documents/analyses/${encodeURIComponent(analysis.analysis_id)}`, {
    token: session.access_token,
  });
  assert.equal(extracted.status, 200, JSON.stringify(extracted.payload));
  for (const candidate of [mobilityCandidate, nutritionCandidate, sleepCandidate]) {
    assert.ok(extracted.payload.extracted_text.includes(candidate.source_quote),
      "every reviewable quotation must be present in the persisted extraction");
  }

  // Accept one candidate, correct and explicitly approve another, and reject the third.
  const mobilityCard = page.getByTestId(`document-candidate-${mobilityIndex}`);
  await mobilityCard.getByText(mobilityCandidate.source_quote, { exact: true }).waitFor({ timeout: 30_000 });
  await mobilityCard.getByTestId(`accept-document-candidate-${mobilityIndex}`).click();
  await mobilityCard.getByText("Added to Care Record", { exact: true }).waitFor({ timeout: 30_000 });

  assert.notEqual(nutritionCandidate.observation, nutritionCandidate.source_quote, "the test correction must repair a shortened model summary using the preserved source wording");
  const correctedObservation = nutritionCandidate.source_quote;
  const correctedSubject = "Caregiver note";
  assert.ok(!correctedObservation.toLowerCase().includes(correctedSubject.toLowerCase()),
    "caregivers must be able to add a plain-language label without altering the original quotation");
  const nutritionCard = page.getByTestId(`document-candidate-${nutritionIndex}`);
  const preservedWording = nutritionCard.getByLabel("Text SolenOS read from the document");
  assert.equal(await preservedWording.inputValue(), correctedObservation);
  assert.equal(await preservedWording.getAttribute("readonly"), "");
  await nutritionCard.getByLabel("Short label for this detail").fill(correctedSubject);
  await nutritionCard.getByTestId(`correct-document-candidate-${nutritionIndex}`).click();
  await nutritionCard.getByText("Correction saved — waiting for approval", { exact: true }).waitFor({ timeout: 30_000 });
  await nutritionCard.getByTestId(`accept-document-candidate-${nutritionIndex}`).click();
  await nutritionCard.getByText("Added to Care Record", { exact: true }).waitFor({ timeout: 30_000 });

  const sleepCard = page.getByTestId(`document-candidate-${sleepIndex}`);
  await sleepCard.getByTestId(`reject-document-candidate-${sleepIndex}`).click();
  await sleepCard.getByText("You chose not to add this detail to your Care Record.", { exact: true }).waitFor({ timeout: 30_000 });

  const history = await request(
    `/api/v1/documents/intelligence/${encodeURIComponent(analysis.analysis_id)}/review-history`,
    { token: session.access_token },
  );
  assert.equal(history.status, 200, JSON.stringify(history.payload));
  const reviewItems = history.payload.items || [];
  const mobilityAccepted = reviewItems.find((item) =>
    item.decision === "accept" && item.after?.source_quote === mobilityCandidate.source_quote,
  );
  const nutritionCorrected = reviewItems.find((item) =>
    item.decision === "correct" && item.after?.source_quote === nutritionCandidate.source_quote &&
    item.after?.subject === correctedSubject && item.after?.observation === correctedObservation,
  );
  const nutritionAccepted = reviewItems.find((item) =>
    item.decision === "accept" && item.after?.source_quote === nutritionCandidate.source_quote &&
    item.after?.observation === correctedObservation,
  );
  const sleepRejected = reviewItems.find((item) =>
    item.decision === "reject" && item.after?.source_quote === sleepCandidate.source_quote,
  );
  assert.ok(mobilityAccepted?.resulting_assertion_id,
    "browser acceptance must append a durable review event linked to the resulting LCR assertion");
  assert.ok(nutritionCorrected && nutritionAccepted?.resulting_assertion_id,
    "the corrected wording must be saved for review and only promoted after explicit approval");
  assert.ok(sleepRejected && !sleepRejected.resulting_assertion_id,
    "rejection must persist without creating an authoritative LCR assertion");

  const assertions = await request(
    `/api/v1/care-continuity/assertions/${encodeURIComponent(session.person.id)}`,
    { token: session.access_token },
  );
  assert.equal(assertions.status, 200, JSON.stringify(assertions.payload));
  const mobilityAssertion = assertions.payload.find((item) => item.id === mobilityAccepted.resulting_assertion_id);
  const nutritionAssertion = assertions.payload.find((item) => item.id === nutritionAccepted.resulting_assertion_id);
  assert.ok(mobilityAssertion && (mobilityAssertion.evidence_ids || []).includes(evidenceId),
    "the accepted mobility assertion must retain the exact original document evidence ID");
  assert.ok(nutritionAssertion && (nutritionAssertion.evidence_ids || []).includes(evidenceId),
    "the corrected and approved assertion must retain the exact original document evidence ID");
  assert.ok(!JSON.stringify(assertions.payload).includes(sleepCandidate.observation),
    "the rejected observation must never become an authoritative LCR fact");

  const original = await request(`/api/v1/upload/${encodeURIComponent(evidenceId)}`, {
    token: session.access_token,
  });
  assert.equal(original.status, 200, "the original uploaded document must remain retrievable");
  assert.equal(original.payload, sourceText, "the original document bytes must remain unchanged");

  // A new browser context proves that the decision survives beyond the upload/review page state.
  await closeContext(context);
  const reopened = await openDocuments(session);
  await reopened.page.getByText("Added to Care Record", { exact: true }).waitFor({ timeout: 30_000 });
  const reloadedHistory = await request(
    `/api/v1/documents/intelligence/${encodeURIComponent(analysis.analysis_id)}/review-history`,
    { token: session.access_token },
  );
  assert.equal(reloadedHistory.status, 200, JSON.stringify(reloadedHistory.payload));
  const persistedDecisions = reloadedHistory.payload.items || [];
  assert.ok(persistedDecisions.some((item) =>
    item.decision === "accept" && item.resulting_assertion_id === mobilityAccepted.resulting_assertion_id,
  ), "the accepted mobility decision must survive a fresh browser session");
  assert.ok(persistedDecisions.some((item) =>
    item.decision === "correct" && item.after?.observation === correctedObservation,
  ), "the saved correction must survive a fresh browser session");
  assert.ok(persistedDecisions.some((item) =>
    item.decision === "reject" && item.after?.source_quote === sleepCandidate.source_quote,
  ), "the rejected decision must survive a fresh browser session");

  await closeContext(reopened.context);
  process.stdout.write("PASS deterministic document extraction, browser acceptance/correction/rejection, PostgreSQL LCR persistence, and original-source integrity\n");
} finally {
  for (const context of [...activeContexts]) await closeContext(context);
  await browser.close();
}
