import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL;
const backend = process.env.BACKEND_URL;
const backendService = process.env.BACKEND_SERVICE_DIR;
assert.ok(frontend, "FRONTEND_URL is required");
assert.ok(backend, "BACKEND_URL is required");
assert.ok(backendService, "BACKEND_SERVICE_DIR is required");

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  return { response, payload };
}

const { response: sessionResponse, payload: session } = await jsonRequest(
  new URL("/api/v1/sessions/anonymous", backend),
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Synthetic browser push recipient",
      caregiver_name: "Synthetic browser push caregiver",
    }),
  },
);
assert.equal(sessionResponse.status, 201, JSON.stringify(session));

const authHeaders = {
  authorization: `Bearer ${session.access_token}`,
  "content-type": "application/json",
};
const { response: capabilityResponse, payload: capability } = await jsonRequest(
  new URL("/api/v1/notifications/push/public-key", backend),
  { headers: authHeaders },
);
assert.equal(capabilityResponse.status, 200, JSON.stringify(capability));
assert.equal(capability.available, true, "CI VAPID configuration must enable browser push");
assert.ok(capability.public_key, "The server must return its configured VAPID public key");

const browser = await chromium.launch({ headless: false });
// Seed the permission into Chromium's isolated context at creation time; later
// grants can update Permissions API state without updating Notification.permission.
const context = await browser.newContext({ permissions: ["notifications"] });
try {
  // Use the browser-level CDP session and the isolated context ID. Omitting
  // browserContextId applies Browser.grantPermissions to Chromium's default
  // context, not this Playwright-created context.
  const browserCdp = await browser.newBrowserCDPSession();
  const { browserContextIds } = await browserCdp.send("Target.getBrowserContexts");
  assert.equal(browserContextIds.length, 1, "Expected one isolated Chromium context");
  const browserContextId = browserContextIds[0];
  const requestedOrigin = new URL(frontend).origin;
  await browserCdp.send("Browser.grantPermissions", {
    origin: requestedOrigin,
    permissions: ["notifications"],
    browserContextId,
  });
  await browserCdp.send("Browser.setPermission", {
    origin: requestedOrigin,
    permission: { name: "notifications" },
    setting: "granted",
    browserContextId,
  });
  await context.grantPermissions(["notifications"], { origin: requestedOrigin });

  const page = await context.newPage();
  await page.goto(frontend, { waitUntil: "domcontentloaded", timeout: 20_000 });

  // Handle an unexpected redirect to a different origin explicitly. Grant
  // permission in the same isolated context, then reload the new origin.
  const appOrigin = new URL(page.url()).origin;
  if (appOrigin !== requestedOrigin) {
    await browserCdp.send("Browser.grantPermissions", {
      origin: appOrigin,
      permissions: ["notifications"],
      browserContextId,
    });
    await browserCdp.send("Browser.setPermission", {
      origin: appOrigin,
      permission: { name: "notifications" },
      setting: "granted",
      browserContextId,
    });
    await context.grantPermissions(["notifications"], { origin: appOrigin });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
  }
  // Chromium headless can report Notification.permission as "denied" even
  // when Playwright has granted the notifications permission. The actual
  // PushManager subscription and delivered service-worker notification below
  // are the authoritative checks, not this known-buggy property.
  const permissionState = await page.evaluate(async () => ({
    notification: Notification.permission,
    permissionsApi: await navigator.permissions.query({ name: "notifications" }).then((result) => result.state),
    origin: location.origin,
    secureContext: window.isSecureContext,
  }));
  assert.equal(
    permissionState.permissionsApi,
    "granted",
    `Chromium notifications permission was not granted for ${appOrigin}: ${JSON.stringify(permissionState)}`,
  );
  assert.equal(permissionState.secureContext, true, "Web Push requires a secure browser context");

  // Exercise the browser's permission prompt from a genuine user activation.
  // This distinguishes a missing user gesture from a broken CI permission grant.
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "solenos-request-notification-permission";
    button.textContent = "Enable notifications";
    button.addEventListener("click", async () => {
      button.dataset.permissionResult = await Notification.requestPermission();
    });
    document.body.append(button);
  });
  await page.locator("#solenos-request-notification-permission").click();
  await page.waitForFunction(() => Boolean(document.querySelector("#solenos-request-notification-permission")?.dataset.permissionResult), { timeout: 5_000 });
  const activatedPermissionState = await page.evaluate(async () => ({
    notification: Notification.permission,
    requestResult: document.querySelector("#solenos-request-notification-permission")?.dataset.permissionResult,
    permissionsApi: await navigator.permissions.query({ name: "notifications" }).then((result) => result.state),
    origin: location.origin,
  }));
  console.log("WEB_PUSH_PERMISSION_DIAGNOSTIC", JSON.stringify({ beforeUserActivation: permissionState, afterUserActivation: activatedPermissionState }));
  assert.equal(activatedPermissionState.notification, "granted", "Notification.permission must be granted after an actual user activation");
  assert.equal(activatedPermissionState.permissionsApi, "granted", "Permissions API must report granted after user activation");

  const serviceWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return { scope: registration.scope, activeScript: registration.active?.scriptURL ?? null };
  });
  assert.ok(serviceWorker.activeScript?.endsWith("/sw.js"), JSON.stringify(serviceWorker));

  const pushPermissionState = await page.evaluate(async (encodedPublicKey) => {
    const padding = "=".repeat((4 - encodedPublicKey.length % 4) % 4);
    const base64 = (encodedPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const applicationServerKey = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) applicationServerKey[index] = raw.charCodeAt(index);
    const registration = await navigator.serviceWorker.ready;
    return {
      notification: Notification.permission,
      permissionsApi: await navigator.permissions.query({ name: "notifications" }).then((result) => result.state),
      push: await registration.pushManager.permissionState({ userVisibleOnly: true, applicationServerKey }),
    };
  }, capability.public_key);
  assert.equal(pushPermissionState.push, "granted", `Chromium PushManager permission is not granted: ${JSON.stringify(pushPermissionState)}`);

  // Prepare service-worker state before the gesture. subscribe() itself runs
  // synchronously in a genuine browser click handler.
  await page.evaluate(async (encodedPublicKey) => {
    const padding = "=".repeat((4 - encodedPublicKey.length % 4) % 4);
    const base64 = (encodedPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const applicationServerKey = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) applicationServerKey[index] = raw.charCodeAt(index);
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    const button = document.createElement("button");
    button.id = "solenos-enable-push-e2e";
    button.type = "button";
    button.textContent = "Enable test notifications";
    button.addEventListener("click", () => {
      registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }).then((created) => {
        window.__solenosPushSubscriptionResult = { ok: true, subscription: created.toJSON() };
      }).catch((error) => {
        window.__solenosPushSubscriptionResult = {
          ok: false,
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        };
      });
    });
    document.body.append(button);
  }, capability.public_key);
  await page.locator("#solenos-enable-push-e2e").click();
  await page.waitForFunction(() => window.__solenosPushSubscriptionResult !== undefined, { timeout: 20_000 });
  const subscriptionResult = await page.evaluate(() => window.__solenosPushSubscriptionResult);
  assert.equal(subscriptionResult.ok, true, `Real Chromium push subscription failed: ${subscriptionResult.error}`);
  const subscription = subscriptionResult.subscription;

  assert.ok(subscription?.endpoint, "Chromium did not create a real push-service endpoint");
  assert.ok(subscription?.keys?.p256dh && subscription?.keys?.auth, "Browser subscription keys are missing");

  const { response: registeredResponse, payload: registered } = await jsonRequest(
    new URL("/api/v1/notifications/push/subscriptions", backend),
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(subscription),
    },
  );
  assert.equal(registeredResponse.status, 201, JSON.stringify(registered));
  assert.equal(registered.registered, true);

  const reminderDueAt = new Date(Date.now() - 5_000).toISOString();
  const { response: reminderResponse, payload: reminder } = await jsonRequest(
    new URL("/api/v1/reminders", backend),
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        person_id: session.person.id,
        title: "Synthetic due reminder",
        note: "Private reminder details stay inside SolenOS.",
        due_at: reminderDueAt,
      }),
    },
  );
  assert.equal(reminderResponse.status, 201, JSON.stringify(reminder));
  assert.equal(reminder.status, "open");

  let dueNotification = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const { response, payload } = await jsonRequest(
      new URL("/api/v1/notifications?limit=100&offset=0", backend),
      { headers: authHeaders },
    );
    assert.equal(response.status, 200, JSON.stringify(payload));
    dueNotification = (payload.items ?? []).find(
      (item) => item.category === "reminder_due" && item.source_event_id === reminder.id,
    ) ?? null;
    if (dueNotification) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(dueNotification, "The running reminder worker did not create a notification for the due saved reminder");

  const helper = path.join(
    backendService,
    "scripts",
    "create_and_deliver_web_push_test_notification.py",
  );
  const privateKey = Buffer.from(process.env.VAPID_PRIVATE_KEY_B64 ?? "", "base64").toString("utf8");
  assert.ok(privateKey.includes("-----BEGIN PRIVATE KEY-----"), "Masked CI VAPID private key is missing");
  const helperEnv = { ...process.env, VAPID_PRIVATE_KEY: privateKey };
  const delivered = spawnSync(
    "python",
    [helper, session.person.id, session.caregiver.id, reminder.id],
    {
      cwd: backendService,
      env: helperEnv,
      encoding: "utf8",
      timeout: 90_000,
    },
  );
  if (delivered.error) throw delivered.error;
  assert.equal(
    delivered.status,
    0,
    `Due-reminder Web Push delivery helper failed. stdout=${delivered.stdout} stderr=${delivered.stderr}`,
  );
  const delivery = JSON.parse(delivered.stdout.trim().split("\n").at(-1));
  assert.equal(delivery.delivery_status, "accepted");
  assert.equal(delivery.provider_accepted, true);
  assert.equal(delivery.source_reminder_id, reminder.id);

  let received = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    received = await page.evaluate(async (notificationId) => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) return [];
      const notifications = await registration.getNotifications({
        tag: `solenos-${notificationId}`,
      });
      return notifications.map((notification) => ({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
      }));
    }, delivery.notification_id);
    if (received.length) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  assert.equal(
    received.length,
    1,
    "Push provider accepted the message, but the real Chromium service worker did not display it",
  );
  assert.equal(received[0].title, "SolenOS");
  assert.equal(received[0].body, "You have a care update. Open SolenOS to review it.");
  assert.equal(received[0].tag, `solenos-${delivery.notification_id}`);
  assert.ok(!received[0].body.includes("Private reminder details"));
  assert.ok(!received[0].body.includes("Synthetic due reminder"));

  const { response: snoozeResponse, payload: snoozed } = await jsonRequest(
    new URL(`/api/v1/reminders/${encodeURIComponent(reminder.id)}/snooze`, backend),
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ snooze_until: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    },
  );
  assert.equal(snoozeResponse.status, 200, JSON.stringify(snoozed));
  assert.equal(snoozed.status, "open");
  assert.equal(snoozed.snooze_count, 1);

  const { response: completeResponse, payload: completed } = await jsonRequest(
    new URL(`/api/v1/reminders/${encodeURIComponent(reminder.id)}/complete`, backend),
    { method: "PATCH", headers: authHeaders, body: JSON.stringify({}) },
  );
  assert.equal(completeResponse.status, 200, JSON.stringify(completed));
  assert.equal(completed.status, "completed");
  assert.ok(completed.completed_at);

  const backendPidFile = "/tmp/solenos-critical-backend.pid";
  assert.ok(fs.existsSync(backendPidFile), "CI backend PID file is missing; restart persistence cannot be tested");
  const backendPid = Number(fs.readFileSync(backendPidFile, "utf8").trim());
  assert.ok(Number.isInteger(backendPid) && backendPid > 0, "CI backend PID is invalid");
  process.kill(backendPid, "SIGTERM");

  let stopped = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fetch(new URL("/health", backend), { signal: AbortSignal.timeout(500) });
    } catch {
      stopped = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(stopped, "The backend did not stop before restart");

  const privateKeyForRestart = Buffer.from(process.env.VAPID_PRIVATE_KEY_B64 ?? "", "base64").toString("utf8");
  const restarted = spawn(
    "uvicorn",
    ["app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: backendService,
      env: { ...process.env, VAPID_PRIVATE_KEY: privateKeyForRestart },
      detached: true,
      stdio: "ignore",
    },
  );
  restarted.unref();

  let restartedHealthy = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const health = await fetch(new URL("/health", backend), { signal: AbortSignal.timeout(1_000) });
      if (health.ok) {
        restartedHealthy = true;
        break;
      }
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(restartedHealthy, "The backend did not become healthy after restart");

  const { response: reloadResponse, payload: reloaded } = await jsonRequest(
    new URL(`/api/v1/reminders/${encodeURIComponent(session.person.id)}`, backend),
    { headers: authHeaders },
  );
  assert.equal(reloadResponse.status, 200, JSON.stringify(reloaded));
  const persisted = reloaded.find((item) => item.id === reminder.id);
  assert.equal(persisted?.status, "completed", "Completed reminder did not persist after reloading from the API");
  assert.equal(persisted?.snooze_count, 1, "Snooze history did not persist after reloading from the API");
  console.log("PASS: saved reminder became due; PostgreSQL notification was created; real Chromium Web Push displayed the generic alert; snooze and completion persisted across a backend process restart.");
} finally {
  await context.close();
  await browser.close();
}
