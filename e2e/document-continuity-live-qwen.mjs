import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const timeoutMs = Number(process.env.DOCUMENT_QWEN_TIMEOUT_MS ?? 360_000);
const browser = await chromium.launch({ headless: true });
const sourceText = [
  "Synthetic CI discharge note. This is fictional test content, not a real person's record.",
  "On 12 October, the patient walked 20 metres with a frame during the physiotherapy session.",
  "The patient ate half of lunch during the observation period.",
  "The caregiver reported that the patient slept poorly last night.",
].join("\n");
const filename = `synthetic-document-continuity-${randomUUID()}.txt`;

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

async function newSession() {
  const created = await request("/api/v1/sessions/anonymous", {
    method: "POST",
    body: { caregiver_name: "Synthetic document continuity browser test" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.payload));
  return created.payload;
}

async function openDocuments(session) {
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
    assert.equal(result.status, 200, JSON.stringify(result.payload));
    last = result.payload;
    const analysis = (last.items || []).find((item) => item.source_evidence_id === evidenceId);
    if (analysis?.intelligence_status === "available") return analysis;
    const job = (last.processing_jobs || []).find((item) => item.evidence_id === evidenceId);
    if (job?.status === "failed") {
      throw new Error(`Live Qwen document job failed: ${job.error_code || "no error code"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Live Qwen document analysis timed out. Last response: ${JSON.stringify(last).slice(0, 1800)}`);
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
    assert.equal(listed.status, 200, JSON.stringify(listed.payload));
    evidence = listed.payload.find((item) => item.filename === filename || item.extra_metadata?.filename === filename);
    if (evidence?.id) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(evidence?.id, "the actual browser upload must create a persisted original document");
  const evidenceId = evidence.id;

  // Queue real background OCR/extraction and real Ollama/Qwen interpretation.
  await page.getByRole("button", { name: "Read document", exact: true }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Read document", exact: true }).click();
  const analysis = await pollDocument(session, evidenceId);
  assert.equal(analysis.extraction_status, "available");
  assert.equal(analysis.intelligence_status, "available");
  assert.ok(analysis.model_provenance?.model_tag, "the saved analysis must identify the model that generated it");
  assert.ok(analysis.model_provenance?.provider, "the saved analysis must identify its inference provider");
  assert.ok(Array.isArray(analysis.observations) && analysis.observations.length > 0,
    "real Qwen inference must produce at least one reviewable source-grounded candidate");

  const candidate = analysis.observations.find((item) =>
    typeof item.source_quote === "string" &&
    item.source_quote.includes("walked 20 metres") &&
    item.source_quote.length > 0 &&
    item.observation && item.source_quote.includes(item.observation) &&
    item.subject && item.source_quote.toLowerCase().includes(item.subject.toLowerCase()),
  );
  assert.ok(candidate, `Qwen must return a verbatim, attributable mobility observation. Candidates: ${JSON.stringify(analysis.observations).slice(0, 2400)}`);

  const extracted = await request(`/api/v1/documents/analyses/${encodeURIComponent(analysis.analysis_id)}`, {
    token: session.access_token,
  });
  assert.equal(extracted.status, 200, JSON.stringify(extracted.payload));
  assert.ok(extracted.payload.extracted_text.includes(candidate.source_quote),
    "the candidate quotation must be present in the persisted extraction");

  // The candidate is now shown by the real review component. Accept it through the browser.
  await page.getByText(candidate.source_quote, { exact: true }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add to Care Record", exact: true }).first().click();
  await page.getByText("Added to Care Record", { exact: true }).waitFor({ timeout: 30_000 });

  const history = await request(
    `/api/v1/documents/intelligence/${encodeURIComponent(analysis.analysis_id)}/review-history`,
    { token: session.access_token },
  );
  assert.equal(history.status, 200, JSON.stringify(history.payload));
  const acceptedEvent = (history.payload.items || []).find((item) =>
    item.decision === "accept" && item.after?.source_quote === candidate.source_quote,
  );
  assert.ok(acceptedEvent?.resulting_assertion_id,
    "browser acceptance must append a durable review event linked to the resulting LCR assertion");

  const assertions = await request(
    `/api/v1/care-continuity/assertions/${encodeURIComponent(session.person.id)}`,
    { token: session.access_token },
  );
  assert.equal(assertions.status, 200, JSON.stringify(assertions.payload));
  const assertion = assertions.payload.find((item) => item.id === acceptedEvent.resulting_assertion_id);
  assert.ok(assertion, "the accepted assertion must be retrievable from the Living Care Record");
  assert.ok((assertion.evidence_ids || []).includes(evidenceId),
    "the accepted assertion must retain the exact original document evidence ID");

  const original = await request(`/api/v1/upload/${encodeURIComponent(evidenceId)}`, {
    token: session.access_token,
  });
  assert.equal(original.status, 200, "the original uploaded document must remain retrievable");
  assert.equal(await original.response.text(), sourceText, "the original document bytes must remain unchanged");

  // A new browser context proves that the decision survives beyond the upload/review page state.
  await context.close();
  const reopened = await openDocuments(session);
  await reopened.page.getByText("Added to Care Record", { exact: true }).waitFor({ timeout: 30_000 });
  const reloadedHistory = await request(
    `/api/v1/documents/intelligence/${encodeURIComponent(analysis.analysis_id)}/review-history`,
    { token: session.access_token },
  );
  assert.equal(reloadedHistory.status, 200, JSON.stringify(reloadedHistory.payload));
  assert.ok(reloadedHistory.payload.items.some((item) =>
    item.decision === "accept" && item.resulting_assertion_id === acceptedEvent.resulting_assertion_id,
  ), "the accepted decision must still be present after a fresh browser session");

  await reopened.context.close();
  process.stdout.write("PASS real Qwen extraction, browser caregiver acceptance, PostgreSQL LCR persistence, and original-source retrieval\n");
} finally {
  await browser.close();
}
