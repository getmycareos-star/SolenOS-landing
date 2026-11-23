import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const timeoutMs = Number(process.env.DOCUMENT_QWEN_TIMEOUT_MS ?? 360_000);
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
  assert.equal(analysis.model_provenance?.provider, "private_ollama", "the saved analysis must identify the real private Ollama provider");
  assert.equal(analysis.model_provenance?.model_tag, process.env.OLLAMA_MODEL ?? "qwen3.5:4b", "the saved analysis must identify the configured Qwen model");
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
  const candidateIndex = typeof candidate.candidate_index === "number"
    ? candidate.candidate_index
    : analysis.observations.indexOf(candidate);
  assert.ok(candidateIndex >= 0, "the selected source-grounded candidate must retain its persisted candidate index");
  await page.getByTestId(`accept-document-candidate-${candidateIndex}`).click();
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
  assert.ok(reloadedHistory.payload.items.some((item) =>
    item.decision === "accept" && item.resulting_assertion_id === acceptedEvent.resulting_assertion_id,
  ), "the accepted decision must still be present after a fresh browser session");

  await closeContext(reopened.context);

  // Follow the accepted document assertion through the actual Companion UI.
  // Use a fresh browser context so the answer cannot reuse the review response.
  const companionContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  activeContexts.add(companionContext);
  await companionContext.addInitScript((identity) => {
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
  const companionPage = await companionContext.newPage();
  companionPage.setDefaultTimeout(timeoutMs);
  await companionPage.route("**/api/**", async (route) => {
    const source = new URL(route.request().url());
    const target = new URL(source.pathname + source.search, backend);
    const headers = { ...route.request().headers() };
    delete headers.origin;
    const response = await route.fetch({ url: target.toString(), headers, timeout: timeoutMs });
    await route.fulfill({ response });
  });
  await companionPage.goto(new URL("/workspace/companion", frontend).toString(), { waitUntil: "domcontentloaded" });
  await companionPage.getByRole("heading", { name: "Care Assistant", exact: true }).waitFor();
  const composer = companionPage.getByLabel("Your message");
  await companionPage.waitForFunction(() => {
    const input = document.querySelector("#companion-message-input");
    return Boolean(input && !input.disabled);
  }, null, { timeout: timeoutMs });
  await composer.fill("How far did the person walk, and what support did the document mention?");
  await companionPage.getByRole("button", { name: "Send", exact: true }).click();
  const companionReply = companionPage.locator(".companion-message.is-assistant .companion-bubble p").last();
  await companionReply.waitFor({ state: "visible", timeout: timeoutMs });
  const companionReplyText = (await companionReply.textContent()) || "";
  assert.match(companionReplyText, /20\s*(?:metres?|meters?)/i,
    "a fresh Companion question must retrieve the accepted document-backed mobility detail");
  assert.match(companionReplyText, /frame/i,
    "the Companion must preserve the support detail from the accepted source");
  await companionPage.getByRole("region", { name: "What this answer is based on" }).waitFor({ timeout: timeoutMs });
  await companionPage.getByText("Caregiver report", { exact: true }).first().waitFor({ timeout: timeoutMs });
  await closeContext(companionContext);
  process.stdout.write("PASS real Qwen extraction, browser caregiver acceptance, PostgreSQL LCR persistence, and original-source retrieval\n");
} finally {
  for (const context of [...activeContexts]) await closeContext(context);
  await browser.close();
}
