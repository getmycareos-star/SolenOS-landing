import assert from "node:assert/strict";
import { chromium } from "playwright";

const frontend = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000";
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const response = await fetch(new URL("/api/v1/sessions/anonymous", backend), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "Display control browser test",
    caregiver_name: "Accessibility test caregiver",
  }),
});
assert.equal(response.status, 201, await response.text());
const session = await response.json();
assert.ok(session.access_token && session.person?.id && session.caregiver?.id);

const browser = await chromium.launch({ headless: true });
try {
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
  await page.route("**/api/**", async (route) => {
    const source = new URL(route.request().url());
    const target = new URL(source.pathname + source.search, backend);
    const headers = { ...route.request().headers() };
    delete headers.origin;
    const proxied = await route.fetch({ url: target.toString(), headers, timeout: 60_000 });
    await route.fulfill({ response: proxied });
  });

  await page.goto(new URL("/workspace/daily-care", frontend).toString(), { waitUntil: "domcontentloaded" });
  const root = page.locator(".solenos-display-preferences");
  const trigger = root.locator(".solenos-display-trigger");
  await trigger.waitFor({ state: "visible", timeout: 20_000 });

  // Drag the floating control to a clear area and verify its device-local position is saved.
  const initial = await root.boundingBox();
  assert.ok(initial);
  const target = { x: 36, y: 52 };
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + initial.width / 2, target.y + initial.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  let moved = await root.boundingBox();
  assert.ok(moved);
  assert.ok(Math.abs(moved.x - target.x) <= 2, `drag did not move control horizontally: ${JSON.stringify(moved)}`);
  assert.ok(Math.abs(moved.y - target.y) <= 2, `drag did not move control vertically: ${JSON.stringify(moved)}`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("solenos_display_control_position_v1") || "null"));
  assert.ok(stored && Math.abs(stored.left - moved.x) <= 2 && Math.abs(stored.top - moved.y) <= 2);

  // The position survives a page reload.
  await page.reload({ waitUntil: "domcontentloaded" });
  await root.waitFor({ state: "visible", timeout: 20_000 });
  moved = await root.boundingBox();
  assert.ok(moved && Math.abs(moved.x - target.x) <= 2 && Math.abs(moved.y - target.y) <= 2,
    `saved position was not restored after reload: ${JSON.stringify(moved)}`);

  // Keyboard users can move the same control without a pointer.
  await trigger.focus();
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForTimeout(50);
  moved = await root.boundingBox();
  assert.ok(moved && Math.abs(moved.x - target.x - 12) <= 2,
    `Alt+Right did not move the control by one keyboard step: ${JSON.stringify(moved)}`);

  // A narrower viewport clamps the saved position fully back into view.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(100);
  moved = await root.boundingBox();
  assert.ok(moved);
  assert.ok(moved.x >= 8 && moved.y >= 8 && moved.x + moved.width <= 312 && moved.y + moved.height <= 560,
    `control escaped the resized viewport: ${JSON.stringify(moved)}`);

  await trigger.click();
  const panel = page.locator("#solenos-display-panel");
  await panel.waitFor({ state: "visible", timeout: 5_000 });
  const panelBox = await panel.boundingBox();
  assert.ok(panelBox);
  assert.ok(panelBox.x >= 0 && panelBox.y >= 0 &&
    panelBox.x + panelBox.width <= 320 && panelBox.y + panelBox.height <= 568,
    `display panel opened outside the viewport: ${JSON.stringify(panelBox)}`);

  await context.close();
  process.stdout.write("PASS movable display control: pointer drag, persisted position, keyboard repositioning, viewport clamping and in-viewport panel\n");
} finally {
  await browser.close();
}
