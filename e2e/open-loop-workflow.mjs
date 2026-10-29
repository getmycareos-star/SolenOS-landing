import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // Exercise the real Next.js UI while forwarding its same-origin API calls to
  // the real FastAPI process. No mocked API responses or sample care records.
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const target = new URL(requestUrl.pathname + requestUrl.search, backend);
    const headers = { ...request.headers() };
    delete headers.origin;
    const response = await route.fetch({ url: target.toString(), headers });
    await route.fulfill({ response });
  });

  await page.goto(new URL("/workspace/open-loops", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Open Loops" }).waitFor();
  await page.getByText("No items in this view").waitFor({ timeout: 15_000 }).catch(() => {});
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
  if (!session.token || !session.personId || !session.caregiverId) {
    throw new Error("The frontend did not establish a server-issued anonymous care session.");
  }
  const sourceResponse = await fetch(new URL("/api/v1/evidence", backend), {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      person_id: session.personId,
      uploaded_by_caregiver_id: session.caregiverId,
      type: "document",
      evidence_kind: "documented_record",
      epistemic_status: "unverified",
      source_text: "Synthetic CI-only source record for professional response verification.",
      source_type: "ci_e2e_fixture",
      ingestion_key: "ui-e2e-source-record-0001",
    }),
  });
  if (!sourceResponse.ok) {
    throw new Error(`Could not seed synthetic source evidence: HTTP ${sourceResponse.status} ${await sourceResponse.text()}`);
  }
  const sourceEvidence = await sourceResponse.json();
  const sourceEvidenceId = sourceEvidence.id;
  if (!sourceEvidenceId) throw new Error("The backend did not return the created source evidence ID.");

  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    if (message.startsWith("Record the actual response received")) {
      await dialog.accept("CI-only response: appointment date confirmed for the synthetic test.");
    } else if (message.startsWith("Select an existing source record")) {
      await dialog.accept(sourceEvidenceId);
    } else if (message.startsWith("Record the explicit reconciliation decision")) {
      await dialog.accept("CI-only reconciliation: the reports concern different dates; neither report is discarded.");
    } else {
      await dialog.dismiss();
    }
  });

  await page.getByLabel("Type").selectOption("professional_input");

  const handoffTitle = "CI E2E professional callback";
  await page.getByLabel("Short title").fill(handoffTitle);
  await page.getByLabel("Context and what is known").fill(
    "Synthetic test only. The care team has not yet confirmed the appointment date."
  );
  await page.getByRole("button", { name: "Save open loop" }).click();
  const handoff = page.locator("article").filter({
    has: page.getByRole("heading", { name: handoffTitle }),
  });
  await handoff.waitFor({ timeout: 15_000 });

  await handoff.getByRole("button", { name: "Record response" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await handoff.getByRole("button", { name: "View audit history" }).click();
  await handoff.getByText("response recorded", { exact: false }).waitFor({ timeout: 10_000 });

  const conflictTitle = "CI E2E conflicting reports";
  await page.getByLabel("Type").selectOption("contradiction");
  await page.getByLabel("Short title").fill(conflictTitle);
  await page.getByLabel("Context and what is known").fill(
    "Synthetic test only. Two reports disagree; the discrepancy must remain visible until explicitly reconciled."
  );
  await page.getByRole("button", { name: "Save open loop" }).click();
  const conflict = page.locator("article").filter({
    has: page.getByRole("heading", { name: conflictTitle }),
  });
  await conflict.waitFor({ timeout: 15_000 });

  await conflict.getByRole("button", { name: "Record reconciliation" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "View audit history" }).click();
  await conflict.getByText("contradiction reconciled", { exact: false }).waitFor({ timeout: 10_000 });

  // Reload proves the UI rehydrates saved state from the API rather than only
  // displaying optimistic component state.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: handoffTitle }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: conflictTitle }).waitFor({ timeout: 15_000 });
  const reloadedHandoff = page.locator("article").filter({
    has: page.getByRole("heading", { name: handoffTitle }),
  });
  await reloadedHandoff.getByRole("button", { name: "View audit history" }).click();
  await reloadedHandoff.getByText("response recorded", { exact: false }).waitFor({ timeout: 10_000 });
  const reloadedConflict = page.locator("article").filter({
    has: page.getByRole("heading", { name: conflictTitle }),
  });
  await reloadedConflict.getByRole("button", { name: "View audit history" }).click();
  await reloadedConflict.getByText("contradiction reconciled", { exact: false }).waitFor({ timeout: 10_000 });
  console.log("PASS: real frontend Open Loop create, evidence-grounded professional response, conflict reconciliation, durable audit history, and reload hydration.");
} finally {
  await browser.close();
}
