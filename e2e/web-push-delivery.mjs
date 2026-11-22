import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
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
      name: "Synthetic in-app notification recipient",
      caregiver_name: "Synthetic in-app notification caregiver",
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
assert.deepEqual(capability, { available: false, public_key: null, reason: "in_app_only" });

const { response: registrationResponse } = await jsonRequest(
  new URL("/api/v1/notifications/push/subscriptions", backend),
  {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      endpoint: "https://push.invalid/legacy-test-subscription",
      keys: { p256dh: "legacy-public-key", auth: "legacy-auth-key" },
    }),
  },
);
assert.equal(registrationResponse.status, 410, "browser push registration must remain disabled");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(frontend, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const browserState = await page.evaluate(async () => ({
    notificationPermission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    serviceWorkerRegistration: Boolean(await navigator.serviceWorker?.getRegistration?.("/")),
  }));
  assert.notEqual(browserState.notificationPermission, "granted", "the app must not request browser notification permission");
  assert.equal(browserState.serviceWorkerRegistration, false, "the app must not register a browser-push service worker");

  const workerResponse = await page.request.get(new URL("/sw.js", frontend).toString());
  assert.equal(workerResponse.status(), 200, "the retirement worker must remain available to update old registrations");
  const workerSource = await workerResponse.text();
  assert.match(workerSource, /registration\.unregister\(\)/);
  assert.doesNotMatch(workerSource, /addEventListener\(["']push["']/);
  assert.doesNotMatch(workerSource, /showNotification|pushManager/);

  const reminderTitle = `Synthetic due reminder ${Date.now()}`;
  const reminderNote = "Private reminder details are available inside the SolenOS inbox.";
  const reminderDueAt = new Date(Date.now() - 5_000).toISOString();
  const { response: reminderResponse, payload: reminder } = await jsonRequest(
    new URL("/api/v1/reminders", backend),
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        person_id: session.person.id,
        title: reminderTitle,
        note: reminderNote,
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
  assert.ok(dueNotification, "the reminder worker did not create an in-app notification");
  assert.equal(dueNotification.title, reminderTitle);
  assert.equal(dueNotification.body, reminderNote);
  assert.equal(dueNotification.category, "reminder_due");
  assert.equal(dueNotification.source_event_id, reminder.id);

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
  assert.ok(stopped, "the backend did not stop before restart");

  const restarted = spawn(
    "python",
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: backendService,
      env: {
        ...process.env,
        APP_ENV: "test",
        SOLENOS_TEST_DISABLE_QWEN: process.env.SOLENOS_TEST_DISABLE_QWEN ?? "true",
        CORS_ORIGINS: "http://127.0.0.1:3000",
        BACKEND_SERVICE_DIR: backendService,
      },
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
  assert.ok(restartedHealthy, "the backend did not become healthy after restart");

  const { response: reloadResponse, payload: reloaded } = await jsonRequest(
    new URL("/api/v1/notifications?limit=100&offset=0", backend),
    { headers: authHeaders },
  );
  assert.equal(reloadResponse.status, 200, JSON.stringify(reloaded));
  const persistedNotification = (reloaded.items ?? []).find((item) => item.id === dueNotification.id);
  assert.ok(persistedNotification, "in-app notification did not persist across backend restart");
  assert.equal(persistedNotification.title, reminderTitle);
  assert.equal(persistedNotification.body, reminderNote);

  const { response: remindersResponse, payload: reminders } = await jsonRequest(
    new URL(`/api/v1/reminders/${encodeURIComponent(session.person.id)}`, backend),
    { headers: authHeaders },
  );
  assert.equal(remindersResponse.status, 200, JSON.stringify(reminders));
  const persistedReminder = reminders.find((item) => item.id === reminder.id);
  assert.equal(persistedReminder?.status, "completed", "completed reminder did not persist after restart");
  assert.equal(persistedReminder?.snooze_count, 1, "snooze history did not persist after restart");

  console.log("PASS: in-app reminder notification persisted; browser push stayed disabled; snooze and completion survived a backend process restart.");
} finally {
  await browser.close();
}
