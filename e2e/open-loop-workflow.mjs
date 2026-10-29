import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let isolateConflictUiRequests = false;

try {
  // Exercise the real Next.js UI while forwarding its same-origin API calls to
  // the real FastAPI process. No mocked API responses or sample care records.
  // Simulate a lost response only after the first create request really commits,
  // then require the caregiver's retry to converge on the original record.
  let simulatedLostCreateResponse = false;
  await page.route("**/api/v1/**", async (route) => {
    try {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (isolateConflictUiRequests) {
        const requestPath = requestUrl.pathname;
        const isConflictFlowRequest =
          requestPath.includes("/uncertainty/contradictions") ||
          requestPath.includes("/care-continuity/evidence") ||
          requestPath.includes("/sessions/");
        // Abort unrelated workspace background calls rather than mock them. The
        // conflict panel's session, evidence, conflict, and history requests remain real API calls.
        if (!isConflictFlowRequest) {
          await route.abort("blockedbyclient");
          return;
        }
      }
      const target = new URL(requestUrl.pathname + requestUrl.search, backend);
      const headers = { ...request.headers() };
      delete headers.origin;
      const response = await route.fetch({ url: target.toString(), headers });
      if (
        !simulatedLostCreateResponse &&
        request.method() === "POST" &&
        requestUrl.pathname === "/api/v1/open-loops"
      ) {
        simulatedLostCreateResponse = true;
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ detail: "CI-only simulated lost response after backend commit" }),
        });
        return;
      }
      await route.fulfill({ response });
    } catch (error) {
      // Background refreshes can still be in flight when a page navigates or
      // the test context is torn down. Ignore only those teardown races; real
      // API failures remain test failures.
      const message = String(error);
      if (/Request context disposed|Target closed|Target page, context or browser has been closed/i.test(message)) {
        return;
      }
      throw error;
    }
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

  const relatedSourceResponse = await fetch(new URL("/api/v1/evidence", backend), {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      person_id: session.personId,
      uploaded_by_caregiver_id: session.caregiverId,
      type: "report",
      evidence_kind: "caregiver_report",
      epistemic_status: "unverified",
      source_text: "CI-only forwarded report derived from the original appointment message.",
      source_type: "ci_e2e_fixture",
      original_source_reference: "ci-e2e-original-message-0001",
      ingestion_key: "ui-e2e-related-source-0002",
    }),
  });
  if (!relatedSourceResponse.ok) {
    throw new Error(`Could not seed related source evidence: HTTP ${relatedSourceResponse.status} ${await relatedSourceResponse.text()}`);
  }
  const relatedSourceEvidence = await relatedSourceResponse.json();
  const relatedEvidenceId = relatedSourceEvidence.id;
  if (!relatedEvidenceId) throw new Error("The backend did not return the related evidence ID.");

  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    if (message.startsWith("Record the actual response received")) {
      await dialog.accept("CI-only response: appointment date confirmed for the synthetic test.");
    } else if (message.startsWith("Select an existing source record")) {
      await dialog.accept(sourceEvidenceId);
    } else if (message.startsWith("Record the action actually taken")) {
      await dialog.accept("CI-only action: asked the care team to confirm the conflicting reports.");
    } else if (message.startsWith("Record the outcome that was reported")) {
      await dialog.accept("CI-only reported outcome: the care team confirmed the reports refer to different dates.");
    } else if (message.startsWith("Describe the verification actually performed")) {
      await dialog.accept("CI-only verification: compared the recorded source references and explicit reconciliation.");
    } else if (message.startsWith("What explicit criterion was used to verify the outcome")) {
      await dialog.accept("Both source references were reviewed and the date discrepancy was explicitly reconciled.");
    } else if (message.startsWith("Record the explicit reconciliation decision")) {
      await dialog.accept("CI-only reconciliation: the reports concern different dates; neither report is discarded.");
    } else if (message.startsWith("Describe the evidence supporting closure")) {
      await dialog.accept("CI-only closure review after source-backed professional response.");
    } else if (message.startsWith("Why is this closed or cancelled loop being reopened")) {
      await dialog.accept("CI-only reopening check after the lifecycle round trip.");
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
  await page.getByRole("alert").filter({ hasText: "The loop was not saved" }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Save open loop" }).click();
  const handoff = page.locator("article").filter({
    has: page.getByRole("heading", { name: handoffTitle }),
  });
  await handoff.waitFor({ timeout: 15_000 });
  const savedLoopsResponse = await fetch(new URL("/api/v1/open-loops", backend), {
    headers: { authorization: `Bearer ${session.token}` },
  });
  if (!savedLoopsResponse.ok) throw new Error(`Could not verify persisted Open Loops: HTTP ${savedLoopsResponse.status}`);
  const savedLoops = await savedLoopsResponse.json();
  const handoffMatches = (savedLoops.items ?? []).filter((item) => item.title === handoffTitle);
  if (handoffMatches.length !== 1) {
    throw new Error(`Create retry produced ${handoffMatches.length} matching persisted loops; expected exactly one.`);
  }

  await handoff.getByRole("button", { name: "Record response" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await handoff.getByRole("button", { name: "View audit history" }).click();
  await handoff.getByText("response recorded", { exact: false }).waitFor({ timeout: 10_000 });

  await handoff.getByRole("button", { name: "Attempt closure" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  // Closed records leave the default Open filter. Switch to All statuses to
  // verify the persisted terminal state and exercise the explicit reopen path.
  await page.getByLabel("Filter open loops").selectOption("all");
  await handoff.getByText(/professional input · closed/i).waitFor({ timeout: 10_000 });
  await handoff.getByRole("button", { name: "Reopen with reason" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await handoff.getByText(/professional input · open/i).waitFor({ timeout: 10_000 });

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

  await conflict.getByRole("button", { name: "Record action" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "Record reconciliation" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "Record outcome" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "Verify outcome" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "Attempt closure" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByText(/contradiction · closed/i).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "View audit history" }).click();
  for (const eventName of ["action recorded", "contradiction reconciled", "outcome reported", "outcome verified", "closure verified"]) {
    await conflict.getByText(eventName, { exact: true }).first().waitFor({ timeout: 10_000 });
  }

  // Reload proves the UI rehydrates saved state from the API rather than only
  // displaying optimistic component state.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByLabel("Filter open loops").selectOption("all");
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

  // Exercise persisted conflict handling through the actual LCR UI and API.
  // The partial resolution must preserve its unresolved remainder; reopening must
  // append a new audit event without erasing the earlier partial-resolution event.
  const conflictResponse = await fetch(new URL("/api/v1/uncertainty/contradictions", backend), {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      person_id: session.personId,
      subject_type: "medication",
      subject_id: "ci-medication-status",
      field: "status",
      description: "CI-only conflicting medication status reports; neither source is assumed authoritative.",
      evidence_ids: [sourceEvidenceId, relatedEvidenceId],
    }),
  });
  if (!conflictResponse.ok) {
    throw new Error(`Could not seed persisted conflict: HTTP ${conflictResponse.status} ${await conflictResponse.text()}`);
  }
  const persistedConflict = await conflictResponse.json();
  if (!persistedConflict.id) throw new Error("Backend did not return the persisted conflict ID.");

  isolateConflictUiRequests = true;
  await page.evaluate(() => {
    localStorage.setItem("solenos_care_recipient_display_name", "CI synthetic care recipient");
  });
  await page.goto(new URL("/workspace", frontend).toString(), { waitUntil: "domcontentloaded" });
  const conflictPanel = page.getByRole("region", { name: "Evidence-grounded conflict resolution" });
  await conflictPanel.getByRole("heading", { name: "Conflict comparison and resolution history" }).waitFor({ timeout: 20_000 });
  await conflictPanel.getByLabel("Conflict").selectOption(persistedConflict.id);
  await conflictPanel.getByLabel("Resolution transition").selectOption("partially_resolved");
  await conflictPanel.getByLabel("Resolution rationale").fill(
    "CI-only review confirms the source document date, but not whether the medication is currently prescribed."
  );
  const resolvedScope = "The source document date was confirmed.";
  const unresolvedRemainder = "Current medication status remains unconfirmed.";
  await conflictPanel.getByLabel("Exact scope resolved (required for partial resolution)").fill(resolvedScope);
  await conflictPanel.getByLabel("What remains unresolved (required for partial resolution)").fill(unresolvedRemainder);
  await conflictPanel.getByLabel("Evidence supporting the resolution (multi-select)").selectOption([sourceEvidenceId]);
  await conflictPanel.getByRole("button", { name: "Save conflict transition" }).click();
  await conflictPanel.getByRole("status").filter({ hasText: "Resolution transition saved with its rationale" }).waitFor({ timeout: 15_000 });
  await conflictPanel.getByText(`Still unresolved: ${unresolvedRemainder}`).waitFor({ timeout: 10_000 });
  await conflictPanel.getByText("unresolved → partially resolved", { exact: true }).waitFor({ timeout: 10_000 });

  await conflictPanel.getByLabel("Resolution transition").selectOption("reopened");
  await conflictPanel.getByLabel("Resolution rationale").fill(
    "CI-only new report disputes the partial interpretation; reopen without deleting prior history."
  );
  await conflictPanel.getByRole("button", { name: "Save conflict transition" }).click();
  await conflictPanel.getByRole("status").filter({ hasText: "Resolution transition saved with its rationale" }).waitFor({ timeout: 15_000 });
  await conflictPanel.getByText("partially resolved → reopened", { exact: true }).waitFor({ timeout: 10_000 });
  await conflictPanel.getByText(`Still unresolved: ${unresolvedRemainder}`).waitFor({ timeout: 10_000 });

  const conflictHistoryResponse = await fetch(
    new URL(`/api/v1/uncertainty/contradictions/${encodeURIComponent(persistedConflict.id)}/history`, backend),
    { headers: { authorization: `Bearer ${session.token}` } },
  );
  if (!conflictHistoryResponse.ok) {
    throw new Error(`Could not verify persisted conflict history: HTTP ${conflictHistoryResponse.status}`);
  }
  const conflictHistory = await conflictHistoryResponse.json();
  if (conflictHistory.length !== 2) {
    throw new Error(`Conflict history has ${conflictHistory.length} events; expected exactly 2 audited transitions.`);
  }
  if (
    conflictHistory[0].previous_status !== "unresolved" ||
    conflictHistory[0].new_status !== "partially_resolved" ||
    conflictHistory[0].unresolved_remainder !== unresolvedRemainder ||
    conflictHistory[1].previous_status !== "partially_resolved" ||
    conflictHistory[1].new_status !== "reopened"
  ) {
    throw new Error("Persisted conflict history did not preserve the partial-resolution boundary and reopening chain.");
  }

  console.log("PASS: real frontend Open Loop lifecycle plus persisted conflict partial-resolution, unresolved remainder, reopening, and append-only history against the live API process.");
} finally {
  // The LCR pages may still have background refresh requests in flight after
  // the assertions complete. Drain route handlers before disposing the context
  // so successful UI assertions are not converted into teardown errors.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
}
