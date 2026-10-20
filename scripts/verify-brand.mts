/**
 * verify-brand.mts
 * solenos brand system — wordmark, colors, placement, copy rules.
 */

import fs from "node:fs";
import path from "node:path";

import {
  BRAND_COLORS,
  BRAND_NAME,
  BRAND_PLACEMENT,
  BRAND_PROHIBITED,
  BRAND_TAGLINE,
} from "../src/lib/brand";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Brand System ===\n");

assert(BRAND_NAME === "solenos", "lowercase brand name");
assert(BRAND_TAGLINE === "The care journey, remembered.", "official tagline");
assert(BRAND_COLORS.slate === "#3D4543", "slate color");
assert(BRAND_COLORS.sage === "#7D8B75", "sage color");
assert(BRAND_PLACEMENT.care_records === false, "no logo in care records");
console.log("✓ brand contract");

const wordmark = path.join(root, "src/components/brand/SolenosWordmark.tsx");
const loading = path.join(root, "src/components/brand/BrandLoading.tsx");
const globals = path.join(root, "src/app/globals.css");
const icon = path.join(root, "src/app/icon.tsx");
const og = path.join(root, "src/app/opengraph-image.tsx");

assert(fs.existsSync(wordmark), "SolenosWordmark component");
assert(fs.existsSync(loading), "BrandLoading component");
assert(fs.existsSync(icon), "favicon icon route");
assert(fs.existsSync(og), "opengraph image route");
console.log("✓ brand assets and components");

const globalsCss = fs.readFileSync(globals, "utf8");
assert(globalsCss.includes("--solenos-slate"), "slate CSS token");
assert(globalsCss.includes("--solenos-sage"), "sage CSS token");
assert(globalsCss.includes(".solenos-wordmark"), "wordmark styles");
assert(globalsCss.includes("letterpress") || globalsCss.includes("text-shadow"), "inset effect");
console.log("✓ brand CSS tokens and wordmark styles");

const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
assert(layout.includes('title: BRAND_NAME') || layout.includes("BRAND_NAME"), "metadata uses brand name");
assert(layout.includes("openGraph"), "openGraph metadata");
console.log("✓ layout metadata");

const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
assert(page.includes("SolenosWordmark"), "header wordmark");
assert(!page.includes("<h1>SolenOS</h1>"), "no mixed-case header");
console.log("✓ landing header wordmark");

const sidebar = fs.readFileSync(path.join(root, "src/components/ui-runtime/Sidebar.tsx"), "utf8");
assert(sidebar.includes("SolenosWordmark"), "sidebar wordmark");
assert(sidebar.includes("solenos is not:"), "lowercase about copy");
console.log("✓ sidebar placement");

const continuity = fs.readFileSync(path.join(root, "src/components/ContinuityPrompt.tsx"), "utf8");
assert(continuity.includes("SolenosWordmark"), "auth prompt wordmark");
console.log("✓ auth continuity prompt");

const componentsDir = path.join(root, "src/components");
function scanForProhibited(dir: string): string[] {
  const hits: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...scanForProhibited(full));
    } else if (entry.name.endsWith(".tsx")) {
      const text = fs.readFileSync(full, "utf8");
      if (/\bSolenOS\b/.test(text) && !full.includes("OutputRenderer")) {
        hits.push(full);
      }
    }
  }
  return hits;
}

const prohibitedInComponents = scanForProhibited(componentsDir);
assert(prohibitedInComponents.length === 0, `no SolenOS in components: ${prohibitedInComponents.join(", ")}`);
console.log("✓ no prohibited mixed-case in UI components");

assert(BRAND_PROHIBITED.includes("SolenOS"), "prohibited list includes SolenOS");
console.log("✓ brand prohibited list");

console.log("\n=== All brand checks passed ===\n");
