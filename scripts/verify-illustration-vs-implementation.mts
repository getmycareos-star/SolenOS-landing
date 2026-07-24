/**
 * Illustration vs Implementation Separation.
 * SoT: docs/02-product/solenos-illustration-vs-implementation.md
 *
 * Scans production paths for illustration-shaped product artifacts.
 * Verify fixtures may use Mom/Dad stories — product UI/schema must not.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ILLUSTRATION_VS_IMPLEMENTATION_PURPOSE,
  ILLUSTRATION_PRE_COMMIT_GATE,
  UNIVERSAL_CARE_REALITY_OBJECTS,
  containsIllustrationAsProduct,
  containsIllustrationShapedSchema,
  containsIllustrationUiDefault,
  containsIllustrationScenarioObject,
} from "../src/lib/care-reality-intelligence";
import { SAMPLE_CARE_LOGS_IS_ILLUSTRATION_ONLY } from "../src/data/sample-care-logs";

console.log("=== Illustration vs Implementation Separation ===\n");
console.log(ILLUSTRATION_VS_IMPLEMENTATION_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-illustration-vs-implementation.md"),
  "utf8",
);
assert.ok(/Illustration vs Implementation/i.test(sot));
assert.ok(/NOT product content|illustrations only/i.test(sot));
assert.ok(/Implement the structure, not the sentence/i.test(sot));
assert.ok(/intelligence behind/i.test(sot));
assert.ok(/example itself|not the sentence/i.test(sot));
console.log("✓ SoT present");

assert.ok(/intelligence behind/i.test(ILLUSTRATION_PRE_COMMIT_GATE));
assert.ok(UNIVERSAL_CARE_REALITY_OBJECTS.includes("care_recipient"));
assert.ok(UNIVERSAL_CARE_REALITY_OBJECTS.includes("observation"));
assert.ok(UNIVERSAL_CARE_REALITY_OBJECTS.includes("unknown"));
assert.equal(SAMPLE_CARE_LOGS_IS_ILLUSTRATION_ONLY, true);
console.log("✓ Contract + sample logs marked illustration-only");

assert.ok(containsIllustrationShapedSchema("mom_confusion_event: true"));
assert.ok(
  containsIllustrationScenarioObject(
    '{ name: "Mom", condition: "confused", event: "tried leaving house" }',
  ),
);
assert.ok(
  containsIllustrationUiDefault(
    `placeholder='e.g. "Mom asked where Dad was seven times today"'`,
  ),
);
assert.ok(
  !containsIllustrationAsProduct(
    "Care recipient observation with change detection and unknowns.",
  ),
);
console.log("✓ Detection patterns");

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Production paths — not verify scripts or test fixtures. */
const SCAN_ROOTS = [
  join(process.cwd(), "src/lib"),
  join(process.cwd(), "src/components"),
  join(process.cwd(), "src/app"),
  join(process.cwd(), "src/data"),
];

const SKIP_PATH_FRAGMENTS = [
  `${join("src", "lib", "care-reality-intelligence", "illustration-vs-implementation.ts")}`,
  "prompt-regression-fixtures",
  "dto-sanitizer-guards",
  `${join("consistency-determinism", "prompt-regression")}`,
];

const hits: string[] = [];
for (const root of SCAN_ROOTS) {
  let files: string[] = [];
  try {
    files = walkFiles(root);
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = relative(process.cwd(), file);
    if (SKIP_PATH_FRAGMENTS.some((s) => rel.includes(s) || file.includes(s))) {
      continue;
    }
    const body = readFileSync(file, "utf8");
    // Skip files that are explicitly illustration/fixture modules
    if (
      /ILLUSTRATION[_\s-]?ONLY|ILLUSTRATION \/ DEV FIXTURE|Illustration fixtures only/i.test(
        body,
      ) &&
      !containsIllustrationUiDefault(body)
    ) {
      continue;
    }
    if (containsIllustrationAsProduct(body)) {
      hits.push(rel);
    }
  }
}

assert.equal(
  hits.length,
  0,
  `Illustration shaped as product in:\n${hits.join("\n")}`,
);
console.log("✓ Production scan: no illustration-shaped schema/UI/scenario objects");

// Observation input must not ship scenario placeholders
const obsInput = readFileSync(
  join(process.cwd(), "src/components/ui-runtime/ObservationInput.tsx"),
  "utf8",
);
assert.ok(
  !/Mom asked where Dad|Dad wandered outside/i.test(obsInput),
  "ObservationInput must not use illustration stories as placeholder",
);
assert.ok(/Share what happened|what changed|unclear/i.test(obsInput));
console.log("✓ Capture UI placeholder is structural, not a demo story");

console.log("\nAll illustration-vs-implementation checks passed.\n");
