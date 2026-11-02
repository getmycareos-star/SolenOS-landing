import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const styles = readFileSync("src/app/mobile-app.css", "utf8");

assert.ok(component.includes("Established Baseline vs Current State"));
assert.ok(component.includes("/change/baselines/"));
assert.ok(component.includes("/comparison"));
assert.ok(component.includes('baseline.confidence === "high"'));
assert.ok(component.includes('baseline.coverage_status === "covered"'));
assert.ok(component.includes("baseline.event_count >= 5"));
assert.ok(component.includes("baselineEvents.length >= 5"));
assert.ok(component.includes("Previously recorded as usual or typical"));
assert.ok(component.includes("recorded event history, not a confirmed description"));
assert.ok(component.includes("Current recorded domains without an established baseline"));
assert.ok(component.includes("Baseline not yet established."));
assert.ok(component.includes("Not enough recent information to compare"));
assert.ok(component.includes("Inspect linked change evidence"));
assert.ok(component.includes("superseded_by_baseline_id"));
assert.ok(component.includes("baselineComparison.as_of"));
assert.ok(component.includes("does not establish that the domain remained unchanged"));
assert.ok(component.includes("What Needs Attention Now?"));
assert.ok(component.includes("Current recorded domains without an established baseline"));
assert.ok(component.includes("attention_candidate"));
assert.ok(component.includes("Correction history"));
assert.ok(styles.includes(".lcr-baseline-columns"));
assert.ok(styles.includes("@media (max-width: 640px)"));

console.log("verify:lcr-baseline-presentation OK");
