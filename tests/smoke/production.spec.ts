import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function isCriticalError(e: string): boolean {
  if (!e.includes("error") && !e.includes("Error")) return false;
  return (
    !e.includes("Manifest") &&
    !e.includes("favicon") &&
    !e.includes("icon") &&
    !e.includes("/api/situation") &&
    !e.includes("404") &&
    !e.includes("400") &&
    !e.includes("Failed to load resource")
  );
}

test.describe("SolenOS production smoke", () => {
  test("homepage loads without uncaught exceptions", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(/solenos/);

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);

    const criticalErrors = consoleErrors.filter(isCriticalError);
    expect(criticalErrors).toEqual([]);
  });

  test("workspace page loads for authenticated entry", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto(`${BASE_URL}/workspace?enter=1`, { waitUntil: "networkidle" });

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);

    const criticalErrors = consoleErrors.filter(isCriticalError);
    expect(criticalErrors).toEqual([]);
  });

  test("start page loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto(`${BASE_URL}/start`, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(/care/i);

    const criticalErrors = consoleErrors.filter(isCriticalError);
    expect(criticalErrors).toEqual([]);
  });

  test("API failure does not crash the entire UI", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?enter=1`, { waitUntil: "networkidle" });

    await page.route("/api/situation*", (route) => {
      route.abort("failed");
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.reload({ waitUntil: "networkidle" });

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(50);

    const criticalErrors = consoleErrors.filter(isCriticalError);
    expect(criticalErrors).toEqual([]);
  });

  test("malformed API data does not crash the entire UI", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?enter=1`, { waitUntil: "networkidle" });

    await page.route("/api/situation*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "not-json",
      });
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.reload({ waitUntil: "networkidle" });

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(50);

    const criticalErrors = consoleErrors.filter(isCriticalError);
    expect(criticalErrors).toEqual([]);
  });

  test("critical UI remains usable after secondary component failure", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace?enter=1`, { waitUntil: "networkidle" });

    await page.evaluate(() => {
      const evt = new Event("error", { bubbles: true, cancelable: true });
      const err = new Error("Simulated component failure");
      Object.defineProperty(err, "message", { value: "Simulated component failure" });
      window.dispatchEvent(Object.assign(evt, { error: err, message: "Simulated component failure" }));
    });

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
  });
});
