import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const targets = [
  { label: "netlify-preview", url: process.env.NETLIFY_PREVIEW_URL },
  { label: "netlify-current-deploy", url: process.env.NETLIFY_DEPLOY_URL },
].filter((target) => target.url);
const routes = [
  "/workspace/timeline",
  "/workspace/care-continuity",
  "/workspace/companion",
  "/workspace/appointments",
  "/workspace/settings",
  "/workspace/handoffs",
  "/workspace/community",
  "/workspace/daily-care",
  "/workspace/documents",
];
const viewports = [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "mobile", width: 390, height: 844 },
];
const artifactDir = "artifacts/dark-mode";
fs.mkdirSync(artifactDir, { recursive: true });

async function createSession(label) {
  const response = await fetch(new URL("/api/v1/sessions/anonymous", backend), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `Dark mode QA ${label}`,
      caregiver_name: "Dark mode rendered verification",
    }),
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;
  assert.equal(response.status, 201, JSON.stringify(payload));
  return payload;
}

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];

try {
  for (const target of targets) {
    const session = await createSession(target.label);
    for (const viewport of viewports) {
      for (const routePath of routes) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: "dark",
        });
        await context.addInitScript((identity) => {
          localStorage.setItem("solenos_anonymous_access_token", identity.token);
          localStorage.setItem("solenos_backend_person_id", identity.personId);
          localStorage.setItem("solenos_backend_caregiver_id", identity.caregiverId);
          localStorage.setItem("solenos_anonymous_session_expires_at", identity.expiresAt);
          localStorage.setItem(
            "solenos_display_preferences_v1",
            JSON.stringify({ theme: "dark", scale: "100" }),
          );
        }, {
          token: session.access_token,
          personId: session.person.id,
          caregiverId: session.caregiver.id,
          expiresAt: session.expires_at,
        });

        const page = await context.newPage();
        const apiFailures = [];
        page.on("response", (response) => {
          const url = new URL(response.url());
          if (url.pathname.startsWith("/api/") && response.status() >= 400) {
            apiFailures.push({ path: url.pathname, status: response.status() });
          }
        });
        await page.route("**/api/**", async (route) => {
          const source = new URL(route.request().url());
          const destination = new URL(source.pathname + source.search, backend);
          const headers = { ...route.request().headers() };
          delete headers.origin;
          const response = await route.fetch({
            url: destination.toString(),
            headers,
            timeout: 210000,
          });
          await route.fulfill({ response });
        });

        const url = new URL(routePath, target.url).toString();
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
          await page.waitForFunction(
            () => document.documentElement.dataset.solenosTheme === "dark",
            null,
            { timeout: 15000 },
          );

          if (routePath === "/workspace/settings") {
            for (const label of ["Profile", "Notifications"]) {
              const control = page.getByRole("button", { name: new RegExp(label, "i") }).first();
              if (await control.count()) {
                await control.click().catch(() => {});
                await page.waitForTimeout(250);
              }
            }
          }

          await page.evaluate(async () => {
            const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
            const max = Math.min(document.body.scrollHeight, window.innerHeight * 10);
            for (let y = 0; y < max; y += step) {
              window.scrollTo(0, y);
              await new Promise((resolve) => setTimeout(resolve, 35));
            }
            window.scrollTo(0, 0);
          });

          const rendered = await page.evaluate(() => {
            function parseColor(value) {
              if (!value || value === "transparent" || value === "none") return null;
              const match = value.match(/rgba?\(([^)]+)\)/i);
              if (!match) return null;
              const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
              if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
              return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
            }
            function blend(top, bottom) {
              const alpha = top.a + bottom.a * (1 - top.a);
              if (!alpha) return { r: 255, g: 255, b: 255, a: 1 };
              return {
                r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
                g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
                b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
                a: alpha,
              };
            }
            function backgroundFor(element) {
              const chain = [];
              for (let node = element; node; node = node.parentElement) chain.push(node);
              let background = { r: 255, g: 255, b: 255, a: 1 };
              for (const node of chain.reverse()) {
                const color = parseColor(getComputedStyle(node).backgroundColor);
                if (color && color.a > 0) background = blend(color, background);
              }
              return background;
            }
            function luminance(color) {
              const channel = (value) => {
                const normalized = value / 255;
                return normalized <= 0.04045
                  ? normalized / 12.92
                  : ((normalized + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
            }
            function ratio(foreground, background) {
              const fg = foreground.a < 1 ? blend(foreground, background) : foreground;
              const a = luminance(fg);
              const b = luminance(background);
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            }
            function selectorFor(element) {
              const parts = [];
              let node = element;
              while (node && node !== document.body && parts.length < 4) {
                let part = node.tagName.toLowerCase();
                if (node.id) part += `#${node.id}`;
                else if (node.classList?.length) part += "." + [...node.classList].slice(0, 2).join(".");
                parts.unshift(part);
                node = node.parentElement;
              }
              return parts.join(" > ");
            }
            function visible(element) {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" &&
                Number.parseFloat(style.opacity || "1") > 0.02 && rect.width > 0 && rect.height > 0;
            }

            const issues = [];
            const elements = [...document.querySelectorAll("body *")];
            for (const element of elements) {
              if (!visible(element)) continue;
              const style = getComputedStyle(element);
              const directText = [...element.childNodes]
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent || "")
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
              if (!directText) continue;
              const foreground = parseColor(style.color);
              if (!foreground || foreground.a < 0.05) continue;
              const background = backgroundFor(element);
              const fontSize = Number.parseFloat(style.fontSize || "16");
              const fontWeight = Number.parseInt(style.fontWeight || "400", 10);
              const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
              const threshold = largeText ? 3 : 4.5;
              const contrast = ratio(foreground, background);
              if (contrast < threshold) {
                issues.push({
                  kind: "text",
                  selector: selectorFor(element),
                  text: directText.slice(0, 100),
                  foreground: style.color,
                  background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
                  contrast: Number(contrast.toFixed(2)),
                  threshold,
                });
              }
            }

            for (const element of [...document.querySelectorAll("svg")]) {
              if (!visible(element)) continue;
              const style = getComputedStyle(element);
              const foreground = parseColor(style.color);
              if (!foreground || foreground.a < 0.05) continue;
              const background = backgroundFor(element);
              const contrast = ratio(foreground, background);
              if (contrast < 3) {
                issues.push({
                  kind: "icon",
                  selector: selectorFor(element),
                  text: element.getAttribute("aria-label") || element.getAttribute("data-testid") || "",
                  foreground: style.color,
                  background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
                  contrast: Number(contrast.toFixed(2)),
                  threshold: 3,
                });
              }
            }

            return {
              theme: document.documentElement.dataset.solenosTheme || null,
              pathname: window.location.pathname,
              title: document.title,
              issues,
            };
          });

          const navigationIssue = rendered.pathname !== routePath
            ? { kind: "navigation", expected: routePath, actual: rendered.pathname }
            : null;
          const routeIssues = [
            ...(navigationIssue ? [navigationIssue] : []),
            ...apiFailures.filter((item) => item.status === 403).map((item) => ({ kind: "api_403", ...item })),
          ];
          const result = {
            target: target.label,
            url,
            route: routePath,
            viewport: viewport.label,
            theme: rendered.theme,
            finalPath: rendered.pathname,
            title: rendered.title,
            contrastIssues: rendered.issues,
            routeIssues,
          };
          results.push(result);
          if (rendered.issues.length || routeIssues.length || rendered.theme !== "dark") failures.push(result);

          if (viewport.label === "desktop" || rendered.issues.length || routeIssues.length) {
            const screenshotPath = `${artifactDir}/${slug(target.label)}-${slug(routePath)}-${viewport.label}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
          }
          process.stdout.write(
            `${failures.includes(result) ? "FAIL" : "PASS"} ${target.label} ${routePath} ${viewport.label}: ${rendered.issues.length} contrast, ${routeIssues.length} route/API issues\n`,
          );
        } catch (error) {
          const result = {
            target: target.label,
            url,
            route: routePath,
            viewport: viewport.label,
            error: String(error),
            apiFailures,
          };
          results.push(result);
          failures.push(result);
          process.stdout.write(`FAIL ${target.label} ${routePath} ${viewport.label}: ${String(error)}\n`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(
  `${artifactDir}/results.json`,
  JSON.stringify({ results, failures }, null, 2),
);

process.stdout.write(`DARK_MODE_AUDIT total=${results.length} failed=${failures.length}\n`);
if (failures.length) process.exitCode = 1;
