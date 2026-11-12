import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ["notifications"] });
try {
  const page = await context.newPage();
  await page.goto(frontend, { waitUntil: "domcontentloaded", timeout: 20_000 });

  const subscription = await page.evaluate(async (encodedPublicKey) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Chromium does not expose the Web Push APIs required for this test");
    }
    if (Notification.permission !== "granted") {
      throw new Error(`Notification permission is ${Notification.permission}, not granted`);
    }
    const padding = "=".repeat((4 - encodedPublicKey.length % 4) % 4);
    const base64 = (encodedPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const applicationServerKey = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      applicationServerKey[index] = raw.charCodeAt(index);
    }
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    const created = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    return created.toJSON();
  }, capability.public_key);

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
  const delivery = JSON.parse(delivered.stdout.trim().split("\\n").at(-1));
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

  const { response: reloadResponse, payload: reloaded } = await jsonRequest(
    new URL(`/api/v1/reminders/${encodeURIComponent(session.person.id)}`, backend),
    { headers: authHeaders },
  );
  assert.equal(reloadResponse.status, 200, JSON.stringify(reloaded));
  const persisted = reloaded.find((item) => item.id === reminder.id);
  assert.equal(persisted?.status, "completed", "Completed reminder did not persist after reloading from the API");
  assert.equal(persisted?.snooze_count, 1, "Snooze history did not persist after reloading from the API");
  console.log("PASS: real Chromium subscription registered; PostgreSQL delivery accepted; service worker received and displayed the generic notification.");
} finally {
  await context.close();
  await browser.close();
}
