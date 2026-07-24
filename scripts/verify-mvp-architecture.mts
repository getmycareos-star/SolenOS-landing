import fs from "node:fs";
import path from "node:path";
import {
  MVP_ALLOWED_API_ROUTES,
  MVP_ALLOWED_FRONTEND_PAGES,
  MVP_ALLOWED_FRONTEND_SHELL,
  MVP_FLOW,
  MVP_FORBIDDEN_IN_ANALYZE,
  MVP_LAYERS,
  MVP_MAX_LLM_CALLS,
  MVP_MAX_RETRIES,
  MVP_VALID_CHANGE_AXES,
} from "../src/lib/mvp-architecture";
import { ANALYZE_MAX_RETRIES } from "../src/lib/analyze-pipeline/constants";

function listApiRouteFiles(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const routePath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...listApiRouteFiles(full, routePath));
    } else if (entry.name === "route.ts") {
      files.push(routePath.replace(/\\/g, "/"));
    }
  }
  return files;
}

const apiRoot = path.join(process.cwd(), "src/app/api");
const routeDirs = listApiRouteFiles(apiRoot).map((p) => {
  const normalized = p.replace(/\/route\.ts$/, "");
  return normalized || "/api";
});

const analyzeSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/analyze/route.ts"),
  "utf-8",
);

const appPages = fs
  .readdirSync(path.join(process.cwd(), "src/app"), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
  .map((e) => `src/app/${e.name}`);

console.log("=== SolenOS MVP — ARCHITECTURE CONSTRAINT SPEC ===\n");

const allowedRoutes = new Set(MVP_ALLOWED_API_ROUTES.map((r) => r.replace("/api", "/api")));
for (const route of routeDirs) {
  const apiRoute = route.startsWith("/api") ? route : `/api${route}`;
  if (!MVP_ALLOWED_API_ROUTES.includes(apiRoute as (typeof MVP_ALLOWED_API_ROUTES)[number])) {
    throw new Error(`forbidden API route in MVP surface: ${apiRoute}`);
  }
}
if (routeDirs.length !== MVP_ALLOWED_API_ROUTES.length) {
  throw new Error(
    `expected exactly ${MVP_ALLOWED_API_ROUTES.length} API route(s), found ${routeDirs.length}`,
  );
}
console.log(`✓ backend surface: ${MVP_ALLOWED_API_ROUTES.join(", ")} only`);

for (const page of MVP_ALLOWED_FRONTEND_PAGES) {
  if (!fs.existsSync(path.join(process.cwd(), page))) {
    throw new Error(`missing required MVP page: ${page}`);
  }
}
const allowedFrontend = new Set([
  ...MVP_ALLOWED_FRONTEND_PAGES,
  ...MVP_ALLOWED_FRONTEND_SHELL,
]);
const extraPages = appPages.filter((p) => !allowedFrontend.has(p as never));
if (extraPages.length > 0) {
  throw new Error(`forbidden frontend pages in MVP: ${extraPages.join(", ")}`);
}
console.log(`✓ frontend surface: ${MVP_ALLOWED_FRONTEND_PAGES.join(", ")} only`);

if (MVP_LAYERS.join(",") !== "input,transformation,structural_validation,cognitive_validation") {
  throw new Error("MVP must have structural + cognitive validation layers");
}
console.log(`✓ validation layers: ${MVP_LAYERS.join(" → ")}`);

if (MVP_MAX_LLM_CALLS !== 3 || MVP_MAX_RETRIES !== 2) {
  throw new Error("MVP LLM call budget must be 3 total (1 initial + 2 retries)");
}
if (ANALYZE_MAX_RETRIES !== MVP_MAX_RETRIES) {
  throw new Error("analyze pipeline retry budget out of sync with MVP boundary");
}
console.log(`✓ LLM budget: 1 ideal, max ${MVP_MAX_LLM_CALLS} calls (${MVP_MAX_RETRIES} retries)`);

for (const forbidden of MVP_FORBIDDEN_IN_ANALYZE) {
  if (analyzeSource.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`/api/analyze contains forbidden pattern: ${forbidden}`);
  }
}
console.log("✓ /api/analyze has no store, agents, queues, or orchestration");

if (!analyzeSource.includes("runAnalyzePipeline")) {
  throw new Error("/api/analyze must delegate to single analyze pipeline");
}
console.log("✓ immutable flow enforced:");
for (const step of MVP_FLOW) {
  console.log(`    ${step}`);
}

if (MVP_VALID_CHANGE_AXES.length !== 4) {
  throw new Error("valid change axes must match spec");
}
console.log(`✓ valid changes only: ${MVP_VALID_CHANGE_AXES.join(", ")}`);

console.log("\n✓ MVP architecture constraints satisfied — stateless analyze + binary feedback signal");
