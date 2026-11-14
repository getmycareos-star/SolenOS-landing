import { chromium } from "playwright";
import assert from "node:assert/strict";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // The UI talks to the real FastAPI process. Only the initial system-owned
  // follow-up is seeded through the API; caregiver interaction is browser-driven.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const target = new URL(requestUrl.pathname + requestUrl.search, backend);
    const headers = { ...request.headers() };
    delete headers.origin;
    const response = await route.fetch({ url: target.toString(), headers });
    await route.fulfill({ response });
  });

  await page.goto(new URL("/workspace/open-loops", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Follow-ups", exact: true }).waitFor();
  await page.waitForFunction(() => Boolean(
    localStorage.getItem("solenos_anonymous_access_token") &&
    localStorage.getItem("solenos_backend_person_id") &&
    localStorage.getItem("solenos_backend_caregiver_id")
  ), { timeout: 15_000 });

  const session = await page.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.ok(session.token && session.personId && session.caregiverId, "a server-issued person-scoped caregiver session is required");

  const title = "CI E2E system-managed appointment follow-up";
  const createResponse = await fetch(new URL("/api/v1/open-loops", backend), {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      loop_type: "follow_up",
      title,
      description: "Synthetic CI record. The appointment outcome has not yet been confirmed.",
      source_type: "ci_followup_e2e",
      uncertainty: "unknown",
      evidence: [],
      idempotency_key: crypto.randomUUID(),
    }),
  });
  assert.equal(createResponse.status, 201, `system follow-up seed failed: ${await createResponse.text()}`);
  const seededLoop = await createResponse.json();
  assert.ok(seededLoop.id, "the backend must return the persisted follow-up ID");
  assert.equal(seededLoop.status, "open");

  await page.reload({ waitUntil: "domcontentloaded" });
  const card = page.locator("article.followup-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  await card.waitFor({ timeout: 20_000 });
  await card.getByRole("button", { name: "Share an update" }).click();
  await card.getByLabel(/Share what has changed/).fill(
    "CI-only caregiver report: I contacted the clinic and was told the appointment date is still being checked."
  );
  await card.getByRole("button", { name: "Share update" }).click();

  await page.getByRole("status").filter({
    hasText: "Your update was saved as a caregiver report. SolenOS has not marked the matter resolved.",
  }).waitFor({ timeout: 15_000 });

  const persistedResponse = await fetch(new URL("/api/v1/open-loops?limit=100", backend), {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(persistedResponse.status, 200, "the updated follow-up must remain retrievable");
  const persisted = await persistedResponse.json();
  const saved = (persisted.items ?? []).find((item) => item.id === seededLoop.id);
  assert.ok(saved, "the original system-managed follow-up must still exist");
  assert.equal(saved.status, "open", "a caregiver report must not close or resolve the follow-up");
  assert.equal(saved.outcome_status, "outcome_reported", "the update must remain explicitly reported, not verified");
  assert.ok(
    (saved.outcome_evidence ?? []).some((item) =>
      item.text === "CI-only caregiver report: I contacted the clinic and was told the appointment date is still being checked."
    ),
    "the caregiver's exact update must be durably recorded",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = page.locator("article.followup-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  await afterReload.waitFor({ timeout: 20_000 });
  assert.ok(await afterReload.isVisible(), "the unresolved follow-up must remain visible after a fresh page load");

  console.log("PASS: visible Follow-ups page loads the persisted care assessment");
  console.log("PASS: caregiver update is written to the existing person-scoped follow-up");
  console.log("PASS: caregiver-reported update remains unverified and does not close the follow-up");
  console.log("PASS: unresolved follow-up remains visible after reload");
} finally {
  await browser.close();
}
