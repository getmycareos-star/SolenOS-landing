/**
 * verify-pattern-intelligence.mts
 * Pattern + Proactive Intelligence Layer — temporal structure, not diagnosis.
 */

import fs from "node:fs";
import path from "node:path";

import {
  PATTERN_INTELLIGENCE_IDENTITY,
  PROHIBITED_PATTERN_LANGUAGE,
  runPatternEngine,
  runPatternIntelligence,
  formatPatternExplanation,
  sanitizePatternText,
  resetPatternIntelligenceStore,
} from "../src/lib/pattern-intelligence";
import {
  resetCareJourneyGraphStore,
  } from "../src/lib/care-journey-graph";
import { processCareJourneyInput } from "../src/lib/care-journey-graph/server";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

console.log("=== SolenOS Pattern + Proactive Intelligence ===\n");

resetCareJourneyGraphStore();
resetPatternIntelligenceStore();

assert(PATTERN_INTELLIGENCE_IDENTITY.toLowerCase().includes("pattern"), "identity defined");
assert(PROHIBITED_PATTERN_LANGUAGE.includes("diagnosis"), "prohibits diagnostic language");
console.log("✓ contract — structure not meaning");

const caregiverId = "cg_pattern";

processCareJourneyInput({
  description: "She fell in the bathroom.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(25),
});
processCareJourneyInput({
  description: "Another fall while walking to the kitchen.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(10),
});
processCareJourneyInput({
  description: "Poor appetite — eating less at meals.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(20),
});
processCareJourneyInput({
  description: "Continued appetite decline observed.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(12),
});
processCareJourneyInput({
  description: "Appetite still declining — barely finishing meals.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(5),
});
processCareJourneyInput({
  description: "Weight loss noted at home.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(8),
});
processCareJourneyInput({
  description: "More weight loss this week.",
  caregiver_id: caregiverId,
  timestamp: daysAgo(3),
});

const patterns = runPatternEngine(caregiverId);
assert(patterns.some((p) => p.pattern_type === "frequency"), "detects frequency patterns");
assert(patterns.some((p) => p.pattern_type === "trend"), "detects trend patterns");
console.log("✓ PatternEngine — frequency + trend");

const explanation = formatPatternExplanation(patterns);
assert(!/\bdiagnos/i.test(explanation), "explanation is non-diagnostic");
assert(explanation.includes("Pattern Detected") || patterns.length === 0, "pattern explanation format");
console.log("✓ non-diagnostic pattern explanation");

const sanitized = sanitizePatternText("This was caused by diagnosis of infection");
assert(sanitized.includes("[removed]"), "sanitizes prohibited language");
console.log("✓ prohibited language filter");

const result = runPatternIntelligence(caregiverId);
assert(result.events_analyzed >= 7, "analyzed structured events");
assert(
  result.proactive_signals.length > 0 || result.patterns.length > 0,
  "proactive or pattern output",
);

const riskAlert = result.proactive_signals.find((s) => s.output_type === "risk_pattern_alert");
if (riskAlert) {
  assert(!/\bdiagnos/i.test(riskAlert.message), "risk alert non-diagnostic");
  assert(riskAlert.message.includes("care appointment"), "discussion framing");
}
console.log("✓ ProactiveEngine — signals without user prompt");

const required = [
  "src/lib/pattern-intelligence/index.ts",
  "src/lib/pattern-intelligence/pattern-engine.ts",
  "src/lib/pattern-intelligence/proactive-engine.ts",
  "src/lib/pattern-intelligence/frequency-patterns.ts",
  "src/lib/pattern-intelligence/trend-patterns.ts",
  "src/app/api/pattern-intelligence/route.ts",
  "src/components/ops-devtools/PatternIntelligencePanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("runPatternIntelligence"), "care-events runs pattern intelligence");

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("PatternIntelligencePanel"), "pattern UI in workspace");

console.log("\n=== Pattern Intelligence verification complete ===");
