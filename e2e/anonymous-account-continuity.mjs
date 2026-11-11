import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const email = `browser-continuity-${randomUUID()}@example.test`;
const password = "CI-only-browser-continuity-passphrase-2026!";
const storageKeys = [
  "solenos_anonymous_access_token",
  "solenos_backend_person_id",
  "solenos_backend_caregiver_id",
  "solenos_anonymous_session_expires_at",
];

async function backendRequest(path, { token, method = "GET", body } = {}) {
  const response = await fetch(new URL(path, backend), {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { response, payload };
}

async function connectRealBackend(page, { loseFirstAccountResponse = false } = {}) {
  let shouldLoseAccountResponse = loseFirstAccountResponse;
  await page.route("**/api/**", async (route) => {
    try {
      const requestUrl = new URL(route.request().url());
      const target = new URL(requestUrl.pathname + requestUrl.search, backend);
      const headers = { ...route.request().headers() };
      delete headers.origin;
      const response = await route.fetch({ url: target.toString(), headers });
      if (
        shouldLoseAccountResponse &&
        route.request().method() === "POST" &&
        requestUrl.pathname === "/api/v1/accounts"
      ) {
        shouldLoseAccountResponse = false;
        // The real backend has committed the account. Drop only the HTTP response
        // to reproduce the ambiguous client-side network failure after commit.
        await route.abort("failed");
        return;
      }
      await route.fulfill({ response });
    } catch (error) {
      const message = String(error);
      if (/Request context disposed|Target closed|Target page, context or browser has been closed/i.test(message)) return;
      throw error;
    }
  });
}

try {
  // Browser context A: start anonymously and create a real backend evidence row.
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await connectRealBackend(pageA, { loseFirstAccountResponse: true });
  await pageA.goto(new URL("/workspace/settings", frontend).toString(), { waitUntil: "domcontentloaded" });
  await pageA.getByRole("heading", { name: "Account", exact: true }).waitFor();
  await pageA.waitForFunction(() => Boolean(
    localStorage.getItem("solenos_anonymous_access_token") &&
    localStorage.getItem("solenos_backend_person_id") &&
    localStorage.getItem("solenos_backend_caregiver_id")
  ), { timeout: 20_000 });

  const original = await pageA.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.ok(original.token && original.personId && original.caregiverId, "browser did not establish server-issued anonymous identity");

  const sourceText = "Browser E2E synthetic caregiver report; preserve this exact wording after account conversion.";
  const createdEvidence = await backendRequest("/api/v1/evidence", {
    token: original.token,
    method: "POST",
    body: {
      person_id: original.personId,
      uploaded_by_caregiver_id: original.caregiverId,
      type: "note",
      evidence_kind: "caregiver_report",
      epistemic_status: "unverified",
      source_text: sourceText,
      source_type: "browser_account_continuity_e2e",
      ingestion_key: `browser-account-continuity-${randomUUID()}`,
    },
  });
  assert.ok([200, 201].includes(createdEvidence.response.status), `could not create browser fixture evidence: HTTP ${createdEvidence.response.status} ${JSON.stringify(createdEvidence.payload)}`);
  const evidenceId = createdEvidence.payload?.id;
  assert.ok(evidenceId, "backend did not return an evidence ID");
  const evidenceIds = [evidenceId];
  for (let index = 2; index <= 20; index += 1) {
    const eventText = `Browser E2E synthetic caregiver report ${index}/20; preserve this exact wording after account conversion.`;
    const event = await backendRequest("/api/v1/evidence", {
      token: original.token,
      method: "POST",
      body: {
        person_id: original.personId,
        uploaded_by_caregiver_id: original.caregiverId,
        type: "note",
        evidence_kind: "caregiver_report",
        epistemic_status: "unverified",
        source_text: eventText,
        source_type: "browser_account_continuity_e2e",
        ingestion_key: `browser-account-continuity-${index}-${randomUUID()}`,
      },
    });
    assert.ok([200, 201].includes(event.response.status), `could not create continuity fixture ${index}/20: HTTP ${event.response.status} ${JSON.stringify(event.payload)}`);
    assert.ok(event.payload?.id, `backend did not return evidence ID for fixture ${index}/20`);
    evidenceIds.push(event.payload.id);
  }
  assert.equal(evidenceIds.length, 20, "the continuity fixture must contain exactly 20 persisted care events");

  // Register from the actual settings UI. Registration must attach to context A's
  // already-existing anonymous care identity, not create a replacement record.
  await pageA.getByRole("button", { name: "Create account", exact: true }).click();
  await pageA.locator("#account-email").fill(email);
  await pageA.locator("#account-password").fill(password);
  await pageA.getByRole("button", { name: "Create account", exact: true }).click();

  // The first response is intentionally lost after the real backend commits.
  // The UI must not claim success; the caregiver can recover by signing in.
  await pageA.locator(".mobile-settings-account-controls [role='alert']").filter({ hasText: "We couldn’t confirm whether account creation completed." }).waitFor({ timeout: 20_000 });
  const recoveredAccountLogin = await backendRequest("/api/v1/accounts/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(recoveredAccountLogin.response.status, 200, `backend did not commit the registration before the response was dropped: ${JSON.stringify(recoveredAccountLogin.payload)}`);
  assert.equal(recoveredAccountLogin.payload?.person_id, original.personId, "ambiguous registration did not link the original person");
  assert.equal(recoveredAccountLogin.payload?.caregiver_id, original.caregiverId, "ambiguous registration did not link the original caregiver");

  await pageA.locator(".mobile-settings-account-controls").getByRole("button", { name: "Cancel", exact: true }).click();
  await pageA.getByRole("button", { name: "Sign in to an existing account", exact: true }).click();
  await pageA.locator("#account-email").fill(email);
  await pageA.locator("#account-password").fill(password);
  await pageA.getByRole("button", { name: "Sign in", exact: true }).click();
  await pageA.getByText("Signed in. Your existing care record is available in this session.", { exact: true }).waitFor({ timeout: 20_000 });

  const afterRegistration = await pageA.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.equal(afterRegistration.personId, original.personId, "registration changed the browser person ID");
  assert.equal(afterRegistration.caregiverId, original.caregiverId, "registration changed the browser caregiver ID");
  assert.notEqual(afterRegistration.token, original.token, "account sign-in did not replace the anonymous browser bearer");

  // Register the authenticated installation through the actual Settings UI.
  // The backend should bind the device to this account session and mark it
  // verified only because the session was issued by successful account login.
  await pageA.getByRole("button", { name: "Register this device", exact: true }).click();
  const registeredDevices = await backendRequest("/api/v1/identity/devices", { token: afterRegistration.token });
  assert.equal(registeredDevices.response.status, 200, "Settings could not retrieve its registered device");
  assert.equal(registeredDevices.payload?.devices?.length, 1, "Settings did not persist the device registration");
  assert.equal(registeredDevices.payload.devices[0].trust_status, "verified", "account-authenticated device was not marked verified");

  // Revoke both the pre-registration anonymous capability and the account
  // session used in browser A. The next browser must prove credential-only login.
  const revoked = await backendRequest("/api/v1/sessions/revoke", {
    token: original.token,
    method: "POST",
    body: {},
  });
  assert.equal(revoked.response.status, 200, `original session revocation failed: ${JSON.stringify(revoked.payload)}`);
  assert.equal(revoked.payload?.revoked, true, "backend did not confirm original session revocation");
  const oldTokenProbe = await backendRequest(`/api/v1/evidence/${encodeURIComponent(original.personId)}`, { token: original.token });
  assert.equal(oldTokenProbe.response.status, 401, "revoked anonymous bearer still accesses the record");

  // Exercise the caregiver-facing Settings sign-out control. It must revoke
  // the active account bearer before removing all four browser credentials.
  await pageA.getByRole("button", { name: "Sign out", exact: true }).click();
  await pageA.getByText("Signed out securely. Your care record remains on SolenOS. Sign in again to restore access on this browser.", { exact: true }).waitFor({ timeout: 20_000 });
  const remainingCredentials = await pageA.evaluate((keys) => keys.filter((key) => localStorage.getItem(key) !== null), storageKeys);
  assert.deepEqual(remainingCredentials, [], "Settings sign-out retained anonymous session credentials");
  const revokedAccountTokenProbe = await backendRequest(`/api/v1/evidence/${encodeURIComponent(original.personId)}`, { token: afterRegistration.token });
  assert.equal(revokedAccountTokenProbe.response.status, 401, "Settings sign-out left the account bearer active");
  await pageA.unrouteAll({ behavior: "ignoreErrors" });
  await contextA.close();

  // Browser context B has a fresh storage partition and receives only account
  // credentials from the operator. Wait for its anonymous bootstrap to settle
  // before login so an in-flight bootstrap cannot race and overwrite the account token.
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await connectRealBackend(pageB);
  await pageB.goto(new URL("/workspace/settings", frontend).toString(), { waitUntil: "domcontentloaded" });
  await pageB.getByRole("heading", { name: "Account", exact: true }).waitFor();
  await pageB.waitForFunction(() => Boolean(
    localStorage.getItem("solenos_anonymous_access_token") &&
    localStorage.getItem("solenos_backend_person_id") &&
    localStorage.getItem("solenos_backend_caregiver_id")
  ), { timeout: 20_000 });

  await pageB.getByRole("button", { name: "Sign in to an existing account", exact: true }).click();
  await pageB.locator("#account-email").fill(email);
  await pageB.locator("#account-password").fill(password);
  await pageB.getByRole("button", { name: "Sign in", exact: true }).click();
  await pageB.getByText("Signed in. Your existing care record is available in this session.", { exact: true }).waitFor({ timeout: 20_000 });

  const restored = await pageB.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.ok(restored.token, "fresh browser did not receive an account session token");
  assert.notEqual(restored.token, original.token, "fresh browser reused the revoked anonymous bearer");
  assert.equal(restored.personId, original.personId, "fresh browser login restored a different person ID");
  assert.equal(restored.caregiverId, original.caregiverId, "fresh browser login restored a different caregiver ID");

  const restoredEvidence = await backendRequest(`/api/v1/evidence/${encodeURIComponent(restored.personId)}`, { token: restored.token });
  assert.equal(restoredEvidence.response.status, 200, `fresh browser could not retrieve care evidence: ${JSON.stringify(restoredEvidence.payload)}`);
  const matchingEvidence = (restoredEvidence.payload ?? []).find((item) => item.id === evidenceId);
  assert.ok(matchingEvidence, "fresh browser login did not restore the original evidence ID");
  assert.equal(matchingEvidence.source_text, sourceText, "fresh browser login changed original caregiver wording");
  const restoredEvidenceIds = new Set((restoredEvidence.payload ?? []).map((item) => item.id));
  assert.equal(evidenceIds.filter((id) => restoredEvidenceIds.has(id)).length, 20, "fresh browser login did not restore all 20 original care events");

  // Verify context B has no inherited browser A storage and now holds only its
  // independently issued account bearer for the same durable care identity.
  const browserBStorage = await pageB.evaluate(() => ({
    token: localStorage.getItem("solenos_anonymous_access_token"),
    personId: localStorage.getItem("solenos_backend_person_id"),
    caregiverId: localStorage.getItem("solenos_backend_caregiver_id"),
  }));
  assert.deepEqual(browserBStorage, restored, "browser B identity changed after login");
  await pageB.unrouteAll({ behavior: "ignoreErrors" });
  await contextB.close();

  console.log("PASS: real Chromium contexts prove anonymous registration, explicit token revocation, browser credential removal, fresh-context account login, stable care identity, and evidence restoration against PostgreSQL-backed FastAPI.");
} finally {
  await browser.close();
}
