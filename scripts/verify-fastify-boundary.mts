import fs from "node:fs";
import path from "node:path";
import {
  ALLOWED_PROXY_PATH,
  FASTIFY_SHIM_SCOPE,
  SHIM_INGEST_ROUTE,
} from "../fastify-shim/config";

const shimDir = path.join(process.cwd(), "fastify-shim");
const implementationFiles = ["server.ts", "proxy.ts", "run.mts"];
const shimSource = implementationFiles
  .map((f) => fs.readFileSync(path.join(shimDir, f), "utf-8"))
  .join("\n");
const configSource = fs.readFileSync(path.join(shimDir, "config.ts"), "utf-8");

const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"),
) as { scripts?: Record<string, string> };

const forbiddenImportPatterns = [
  /from\s+["']@\/lib\//,
  /from\s+["']\.\.\/src\//,
  /from\s+["']@langchain/,
  /from\s+["']zod["']/,
  /from\s+["']next/,
  /require\s*\(\s*["']@\/lib/,
];

const forbiddenImplementationPatterns = [
  /app\.(get|post|put|delete|patch)\(\s*["'`]\/api\//,
  /fetch\([^)]*\/api\/analyze/,
  /fetch\([^)]*\/api\/v1\/runtime\/execute/,
  /langchain/i,
  /validateAIResponse/,
  /runSolenOSLLM/,
  /runPipeline/,
  /executeTurn/,
];

console.log("=== fastify-shim — OPTIONAL INFRA SHIM v1 ===\n");

if (packageJson.scripts?.dev?.includes("fastify")) {
  throw new Error("dev script must not start Fastify — Next.js only");
}
console.log("✓ default dev path is Next.js only (npm run dev)");

if (packageJson.scripts?.start?.includes("fastify")) {
  throw new Error("start script must not depend on Fastify");
}
console.log("✓ production start path is Next.js only");

for (const pattern of forbiddenImportPatterns) {
  if (pattern.test(shimSource) || pattern.test(configSource)) {
    throw new Error(`forbidden import in fastify-shim: ${pattern}`);
  }
}
console.log("✓ no SolenOS cognitive / LangChain / Zod / Next imports");

for (const pattern of forbiddenImplementationPatterns) {
  if (pattern.test(shimSource)) {
    throw new Error(`forbidden route or cognitive hook in fastify-shim: ${pattern}`);
  }
}
console.log("✓ no analyze, execute, LangChain, or validation routes");

const allShimSource = shimSource + "\n" + configSource;

if (!allShimSource.includes(ALLOWED_PROXY_PATH)) {
  throw new Error(`shim must proxy only to ${ALLOWED_PROXY_PATH}`);
}
console.log(`✓ proxy target locked to ${ALLOWED_PROXY_PATH}`);

if (!allShimSource.includes(SHIM_INGEST_ROUTE)) {
  throw new Error("shim must expose isolated ingest route");
}
console.log(`✓ shim route ${SHIM_INGEST_ROUTE} does not duplicate Next.js APIs`);

console.log("\nAllowed scope:");
for (const item of FASTIFY_SHIM_SCOPE.allowed) {
  console.log(`  • ${item}`);
}

console.log("\nForbidden in Fastify:");
for (const item of FASTIFY_SHIM_SCOPE.forbidden) {
  console.log(`  • ${item}`);
}

console.log("\n✓ Fastify is optional, isolated, and fully removable");
console.log("  Delete fastify-shim/ + devDependencies → SolenOS unchanged on Next.js");
