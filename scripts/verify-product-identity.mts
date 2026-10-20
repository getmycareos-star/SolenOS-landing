/**
 * verify-product-identity.mts
 * Permanent Product Identity — SolenOS only; zero forbidden product-name hits.
 */

import fs from "node:fs";
import path from "node:path";
import {
  CARE_REALITY_INTELLIGENCE_CATEGORY_PHRASE,
  FORBIDDEN_PRODUCT_NAMES,
  LIVING_CARE_RECORD_FOUNDATION,
  SOLENOS_PHILOSOPHY_CHAIN,
  SOLENOS_PRODUCT_IDENTITY,
  SOLENOS_PRODUCT_NAME,
} from "../src/lib/product-identity";
import { CARE_REALITY_INTELLIGENCE_THESIS } from "../src/lib/care-reality-intelligence";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === ".next" ||
      entry.name === "dist" ||
      entry.name === "coverage"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (
      /\.(ts|tsx|js|jsx|md|mdc|json|html|css|sql|mts|mjs)$/i.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

console.log("=== SolenOS Product Identity ===\n");

assert(SOLENOS_PRODUCT_NAME === "SolenOS", "product name");
assert(
  SOLENOS_PRODUCT_IDENTITY.includes("evolving intelligence layer"),
  "identity definition",
);
assert(SOLENOS_PHILOSOPHY_CHAIN.includes("Input → Event → Change"), "philosophy");
assert(
  CARE_REALITY_INTELLIGENCE_CATEGORY_PHRASE === "Care Reality Intelligence",
  "category phrase",
);
assert(LIVING_CARE_RECORD_FOUNDATION.includes("Living Care Record"), "foundation");
assert(
  !/Care Reality Engine is the product/i.test(CARE_REALITY_INTELLIGENCE_THESIS),
  "CRI thesis must not rename product to Care Reality Engine",
);
assert(
  /Living Care Record is the product/i.test(CARE_REALITY_INTELLIGENCE_THESIS),
  "CRI thesis names Living Care Record as product foundation",
);
console.log("✓ identity contracts");

const rulePath = path.join(root, ".cursor/rules/solenos-product-identity.mdc");
assert(fs.existsSync(rulePath), "cursor rule present");

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
assert(/SolenOS/.test(readme), "README names SolenOS");
assert(/Living Care Record/i.test(readme), "README names Living Care Record");
assert(/evolving intelligence layer/i.test(readme), "README identity sentence");
assert(!/Stateless cognitive transformation API/i.test(readme), "README not legacy API identity");
assert(!/NOT a .*memory system/i.test(readme), "README must not deny care memory");
assert(/\/api\/situation/.test(readme), "README caregiver path is situation");
assert(!/\bCareOS\b|\bCare Reality OS\b|\bLiving Care OS\b|\bMemory OS\b|\bHealth OS\b/.test(readme), "README no forbidden product names");
console.log("✓ README product identity");

const boundary = fs.readFileSync(path.join(root, "docs/PRODUCT_BOUNDARY.md"), "utf8");
assert(/Living Care Record/i.test(boundary), "boundary Living Care Record");
assert(!/does \*\*NOT\*\*: store longitudinal memory/i.test(boundary), "boundary must not ban care memory");
assert(!/stateless cognitive relief loop/i.test(boundary), "boundary not stateless-only MVP");
console.log("✓ PRODUCT_BOUNDARY identity");

const philosophy = fs.readFileSync(
  path.join(root, "docs/17-canonical-architecture/product-philosophy.md"),
  "utf8",
);
assert(!/^## Continuity OS\s*$/m.test(philosophy), "no Continuity OS product rename heading");
console.log("✓ no Continuity OS product rename");

// Forbidden product names — zero hits outside the identity rule (which lists them).
const files = walkFiles(root);
const offenders: string[] = [];
const patterns = [
  /\bCareOS\b/,
  /\bCare OS\b/,
  /\bCareos\b/,
  /\bCare Reality OS\b/,
  /\bCare Reality Operating System\b/,
  /\bCare Intelligence OS\b/,
  /\bLiving Care OS\b/,
  /\bMemory OS\b/,
  /\bHealth OS\b/,
];

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (rel === ".cursor/rules/solenos-product-identity.mdc") continue;
  if (rel === "src/lib/product-identity/contract-constants.ts") continue;
  if (rel === "scripts/verify-product-identity.mts") continue;
  const text = fs.readFileSync(file, "utf8");
  for (const re of patterns) {
    if (re.test(text)) {
      offenders.push(`${rel} (${re})`);
      break;
    }
  }
}

assert(offenders.length === 0, `forbidden product-name hits:\n${offenders.join("\n")}`);
assert(FORBIDDEN_PRODUCT_NAMES.includes("CareOS"), "forbidden list includes CareOS");
console.log("✓ zero forbidden product-name hits outside allowlisted identity files");

const prompt = fs.readFileSync(
  path.join(root, "src/lib/solenos-langchain-adapter/system-prompt.ts"),
  "utf8",
);
assert(/Living Care Record/.test(prompt), "analyze prompt names Living Care Record");
assert(/evolving intelligence layer/.test(prompt), "analyze prompt product identity");
assert(/product-identity directive/.test(prompt), "analyze prompt points at identity directive");
console.log("✓ analyze prompt framed under SolenOS product identity");

console.log("\n=== Product Identity: ALL CHECKS PASSED ===\n");
