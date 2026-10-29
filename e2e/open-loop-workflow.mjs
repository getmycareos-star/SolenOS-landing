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

  page.once("dialog", (dialog) => dialog.accept("CI-only response: appointment date confirmed for the synthetic test."));
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

  page.once("dialog", (dialog) => dialog.accept(
    "CI-only reconciliation: the reports concern different dates; neither report is discarded."
  ));
  await conflict.getByRole("button", { name: "Record reconciliation" }).click();
  await page.getByRole("status").filter({ hasText: "backend accepted the update" }).waitFor({ timeout: 10_000 });
  await conflict.getByRole("button", { name: "View audit history" }).click();
  await conflict.getByText("contradiction reconciled", { exact: false }).waitFor({ timeout: 10_000 });

  // Reload proves the UI rehydrates saved state from the API rather than only
  // displaying optimistic component state.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: handoffTitle }).waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: conflictTitle }).waitFor({ timeout: 15_000 });
  console.log("PASS: real frontend Open Loop create, professional response, conflict reconciliation, audit history, and reload hydration.");
} finally {
  await browser.close();
}
