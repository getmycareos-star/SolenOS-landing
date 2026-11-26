import { chromium } from "playwright";
import assert from "node:assert/strict";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let simulatedLostOutcomeResponse = false;
let simulatedLostActionResponse = false;
let simulatedLostCreateResponse = false;

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
    if (
      !simulatedLostCreateResponse &&
      request.method() === "POST" &&
      requestUrl.pathname === "/api/v1/open-loops"
    ) {
      simulatedLostCreateResponse = true;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ detail: "CI-only simulated lost response after follow-up creation committed" }),
      });
      return;
    }
    if (
      !simulatedLostOutcomeResponse &&
      request.method() === "POST" &&
      /\/api\/v1\/open-loops\/[^/]+\/(?:outcomes|responses)$/.test(requestUrl.pathname)
    ) {
      simulatedLostOutcomeResponse = true;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ detail: "CI-only simulated lost response after backend commit" }),
      });
      return;
    }
    if (
      !simulatedLostActionResponse &&
      request.method() === "POST" &&
      /\/api\/v1\/open-loops\/[^/]+\/actions$/.test(requestUrl.pathname)
    ) {
      simulatedLostActionResponse = true;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ detail: "CI-only simulated lost action response after backend commit" }),
      });
      return;
    }
    await route.fulfill({ response });
  });

  await page.goto(new URL("/workspace/open-loops", frontend).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Needs attention", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Resolved", exact: true }).waitFor({ timeout: 20_000 });
  const followUpSectionPlacement = await page.evaluate(() => {
    const findSection = (heading) => [...document.querySelectorAll(".followups-section")]
      .find((section) => section.querySelector(".followups-section-heading h2")?.textContent?.trim() === heading);
    const resolved = findSection("Resolved");
    const noLongerRelevant = findSection("No longer relevant");
    return {
      resolvedExists: Boolean(resolved),
      noLongerRelevantExists: Boolean(noLongerRelevant),
      resolvedContainsNoLongerRelevant: Boolean(resolved && noLongerRelevant && resolved.contains(noLongerRelevant)),
      noLongerRelevantContainsResolved: Boolean(resolved && noLongerRelevant && noLongerRelevant.contains(resolved)),
      resolvedHasEmptyState: Boolean(resolved?.textContent?.includes("There are no resolved follow-ups here yet.")),
      noLongerRelevantHasEmptyState: Boolean(noLongerRelevant?.textContent?.includes("No follow-ups have been stopped.")),
    };
  });
  assert.ok(
    followUpSectionPlacement.resolvedExists &&
    followUpSectionPlacement.noLongerRelevantExists &&
    !followUpSectionPlacement.resolvedContainsNoLongerRelevant &&
    !followUpSectionPlacement.noLongerRelevantContainsResolved &&
    followUpSectionPlacement.resolvedHasEmptyState &&
    followUpSectionPlacement.noLongerRelevantHasEmptyState,
    "Resolved and No longer relevant must be peer sections with their own empty messages",
  );
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
  if (!createResponse.ok) {
    throw new Error(`system follow-up seed failed: HTTP ${createResponse.status} ${await createResponse.text()}`);
  }
  const seededLoop = await createResponse.json();
  assert.ok(seededLoop.id, "the backend must return the persisted follow-up ID");
  assert.equal(seededLoop.status, "open");

  await page.reload({ waitUntil: "domcontentloaded" });
  const card = page.locator("article.followup-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  await card.waitFor({ timeout: 20_000 });
  assert.equal(await card.count(), 1, "one saved follow-up must appear only once across caregiver attention sections");
  const initialSection = await card.evaluate((element) =>
    element.closest(".followups-section")?.querySelector("h2")?.textContent?.trim() ?? null
  );
  assert.equal(initialSection, "Needs clarification",
    "a saved follow-up without a current care classification must not be shown as safe to wait");
  await card.getByRole("button", { name: "Share what changed" }).click();
  await card.getByLabel(/Tell us what has changed/).fill(
    "CI-only caregiver report: I contacted the clinic and was told the appointment date is still being checked."
  );
  await card.getByRole("button", { name: "Share update" }).click();
  await page.getByRole("alert").filter({
    hasText: "The update could not be confirmed. Nothing has been marked resolved.",
  }).waitFor({ timeout: 15_000 });

  // Retry the exact same text after a response was lost. The browser must reuse
  // the same idempotency key and the backend must not append a second report.
  await card.getByRole("button", { name: "Share update" }).click();
  await page.getByRole("status").filter({
    hasText: "Your update was saved. SolenOS has not marked this as resolved.",
  }).waitFor({ timeout: 15_000 });

  const persistedResponse = await fetch(new URL("/api/v1/open-loops?limit=100", backend), {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(persistedResponse.status, 200, "the updated follow-up must remain retrievable");
  const persisted = await persistedResponse.json();
  const saved = (persisted.items ?? []).find((item) => item.id === seededLoop.id);
  assert.ok(saved, "the original system-managed follow-up must still exist");
  assert.equal(saved.status, "open", "a caregiver report must not close or resolve the follow-up");
  assert.equal(saved.outcome_status, "outcome_unknown", "a response report must not be promoted into an outcome or verification");
  assert.ok(
    (saved.response_evidence ?? []).some((item) =>
      item.text === "CI-only caregiver report: I contacted the clinic and was told the appointment date is still being checked."
      && item.independently_verified === false
    ),
    "the caregiver's exact response must be durably recorded as unverified",
  );
  assert.equal(
    (saved.response_evidence ?? []).filter((item) =>
      item.text === "CI-only caregiver report: I contacted the clinic and was told the appointment date is still being checked."
    ).length,
    1,
    "retry after a lost response must not duplicate the caregiver response",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = page.locator("article.followup-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  await afterReload.waitFor({ timeout: 20_000 });
  assert.ok(await afterReload.isVisible(), "the unresolved follow-up must remain visible after a fresh page load");

  // An action report is distinct from a response and still cannot verify the outcome.
  await afterReload.getByRole("button", { name: "Save what you did" }).click();
  const actionText = "CI-only caregiver action: I called the clinic to request the updated appointment date.";
  await afterReload.getByLabel(/What did you do/).fill(actionText);
  await afterReload.getByRole("button", { name: "Save next step" }).click();
  await page.getByRole("alert").filter({
    hasText: "The action could not be confirmed. Keep the report available and try again.",
  }).waitFor({ timeout: 15_000 });
  await afterReload.getByRole("button", { name: "Save next step" }).click();
  await page.getByRole("status").filter({
    hasText: "Your action was saved. The concern has not been marked as resolved.",
  }).waitFor({ timeout: 15_000 });

  // Read after the action succeeds. The earlier snapshot only proves the
  // response report; it cannot prove an action that has not been submitted yet.
  const actionPersistenceResponse = await fetch(new URL("/api/v1/open-loops?limit=100", backend), {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(actionPersistenceResponse.status, 200, "the follow-up with the action report must remain retrievable");
  const actionPersistence = await actionPersistenceResponse.json();
  const actionSaved = (actionPersistence.items ?? []).find((item) => item.id === seededLoop.id);
  assert.ok(actionSaved, "the original follow-up must remain saved after the action report");
  assert.equal(actionSaved.status, "open", "recording an action must not resolve the follow-up");
  assert.equal(actionSaved.outcome_status, "outcome_unknown", "recording an action must not verify the outcome");
  assert.ok(
    (actionSaved.action_evidence ?? []).some((item) => item.text === actionText),
    "the caregiver's action report must be durably recorded",
  );
  assert.equal(
    (actionSaved.action_evidence ?? []).filter((item) => item.text === actionText).length,
    1,
    "retry after a lost action response must not duplicate the caregiver action",
  );

  const candidateTitle = "CI E2E event-derived follow-up candidate";
  const eventResponse = await fetch(new URL("/api/v1/events", backend), {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      person_id: session.personId,
      event_type: "care_follow_up_candidate",
      status: "recorded",
      occurred_at: new Date().toISOString(),
      title: candidateTitle,
      description: "A saved care event requires a caregiver decision about whether a follow-up is needed.",
      created_by_caregiver_id: session.caregiverId,
      attention_candidate: true,
      follow_up_candidate: true,
      tags: ["ci_followup_e2e"],
    }),
  });
  if (!eventResponse.ok) {
    throw new Error(`event follow-up candidate seed failed: HTTP ${eventResponse.status} ${await eventResponse.text()}`);
  }
  const candidateEvent = await eventResponse.json();
  assert.ok(candidateEvent.id, "the source care event must be persisted before a follow-up can be created");

  const reassessment = await fetch(new URL("/api/v1/care-continuity/situation-understanding/reassess", backend), {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(reassessment.status, 200, `the source event must be included in a real care assessment: ${await reassessment.text()}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  const candidateCard = page.locator("article.followup-card").filter({
    has: page.getByRole("heading", { name: candidateTitle, exact: true }),
  });
  await candidateCard.waitFor({ timeout: 20_000 });
  await candidateCard.getByRole("button", { name: "Add a follow-up", exact: true }).click();
  await page.getByRole("alert").filter({
    hasText: "The follow-up could not be confirmed. Keep this item open and try again.",
  }).waitFor({ timeout: 15_000 });
  await candidateCard.getByRole("button", { name: "Add a follow-up", exact: true }).click();
  await page.getByRole("status").filter({
    hasText: "Follow-up saved. The original care information has not changed.",
  }).waitFor({ timeout: 15_000 });

  const createdLoopsResponse = await fetch(new URL("/api/v1/open-loops?limit=100", backend), {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(createdLoopsResponse.status, 200);
  const createdLoops = await createdLoopsResponse.json();
  const sourceLinkedLoops = (createdLoops.items ?? []).filter((item) =>
    item.source_type === "events" && item.source_id === candidateEvent.id
  );
  assert.equal(sourceLinkedLoops.length, 1, "one source event must produce exactly one persisted follow-up");
  assert.equal(sourceLinkedLoops[0].status, "open");
  assert.equal(sourceLinkedLoops[0].outcome_status, "outcome_unknown");
  const sourceEventAfterCreate = await fetch(new URL(`/api/v1/events/${encodeURIComponent(session.personId)}`, backend), {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(sourceEventAfterCreate.status, 200);
  const sourceEvents = await sourceEventAfterCreate.json();
  assert.ok(sourceEvents.some((event) => event.id === candidateEvent.id),
    "creating a follow-up must preserve the original source event");

  await page.reload({ waitUntil: "domcontentloaded" });
  const linkedCandidateCard = page.locator("article.followup-card").filter({
    has: page.getByRole("heading", { name: candidateTitle, exact: true }),
  });
  await linkedCandidateCard.waitFor({ timeout: 20_000 });
  assert.equal(
    await linkedCandidateCard.getByRole("button", { name: "Add a follow-up", exact: true }).count(),
    0,
    "a source-linked persisted follow-up must not remain as a second untracked responsibility",
  );

  console.log("PASS: visible Follow-ups page loads the persisted care assessment");
  console.log("PASS: caregiver update is written to the existing person-scoped follow-up");
  console.log("PASS: caregiver-reported update remains unverified and does not close the follow-up");
  console.log("PASS: unresolved follow-up remains visible after reload");
} finally {
  // Remove the API proxy while the browser context is still alive so an
  // in-flight request cannot outlive the Playwright route context.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
}
