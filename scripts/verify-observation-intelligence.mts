/**
 * verify-observation-intelligence.mts
 * Asserts Caregiver Observation Intelligence MVP:
 * extraction examples, ontology mapping, trend detection, forbidden language guard.
 */

import fs from "node:fs";
import path from "node:path";

import {
  OBSERVATION_INTELLIGENCE_IDENTITY,
  OBSERVATION_INTELLIGENCE_PHILOSOPHY,
  OBSERVATION_INTELLIGENCE_SUCCESS_KPI,
  OBSERVATION_FORBIDDEN_OUTPUT,
  OBSERVATION_ANTI_PATTERNS,
  OBSERVATION_CATEGORIES,
  OBSERVATION_SIGNALS,
  allSignals,
  extractObservations,
  assignSeverity,
  extractFrequency,
  detectSafetyRisk,
  categoryForSignal,
  saveObservation,
  listStructuredForCaregiver,
  resetObservationStore,
  observationStoreSchema,
  aggregateWeeklyFrequencies,
  detectTrendDirection,
  generateWeeklySummary,
  buildSystemAggregation,
  containsForbiddenLanguage,
  recordObservation,
  getObservationExport,
} from "../src/lib/observation-intelligence";
import {
  OBSERVATION_INTELLIGENCE_MVP,
  V14_ANTI_PATTERNS,
  V14_ENGINE_MODULES,
  FACADE_DEPRECATION,
} from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Observation Intelligence MVP ===\n");

// ─── Contract ────────────────────────────────────────────────────────────────
assert(
  OBSERVATION_INTELLIGENCE_IDENTITY.includes("observe"),
  "identity mentions observe",
);
assert(
  OBSERVATION_INTELLIGENCE_PHILOSOPHY.includes("Capture"),
  "philosophy starts with Capture",
);
assert(
  OBSERVATION_INTELLIGENCE_PHILOSOPHY.includes("NOT Explain"),
  "philosophy explicitly rejects Explain→Diagnose path",
);
assert(
  OBSERVATION_INTELLIGENCE_SUCCESS_KPI === "observations_per_caregiver_per_week",
  "success KPI",
);
assert(OBSERVATION_FORBIDDEN_OUTPUT.length >= 5, "forbidden outputs listed");
assert(OBSERVATION_ANTI_PATTERNS.some((a) => a.includes("diagnosing")), "anti-patterns");
console.log("✓ contract constants");

assert(OBSERVATION_CATEGORIES.length === 6, "exactly 6 ontology categories");
assert(OBSERVATION_SIGNALS.memory.includes("repeated_questioning"), "memory signal");
assert(OBSERVATION_SIGNALS.behavior.includes("wandering"), "behavior signal");
assert(OBSERVATION_SIGNALS.orientation.includes("getting_lost"), "orientation signal");
assert(allSignals().length === 27, "27 total signals");
console.log("✓ ontology taxonomy");

assert(categoryForSignal("repeated_questioning") === "memory", "signal→category memory");
assert(categoryForSignal("wandering") === "behavior", "signal→category behavior");
console.log("✓ ontology mapping");

// ─── Spec extraction examples ────────────────────────────────────────────────
const momAsk = extractObservations("Mom asked where Dad was seven times today");
assert(
  momAsk.structured.some((s) => s.signal === "repeated_questioning"),
  "Mom asked… → repeated_questioning",
);
assert(
  momAsk.structured.some((s) => s.category === "memory"),
  "Mom asked… → memory category",
);
assert(momAsk.frequency === 7, "seven times → frequency 7");
assert(
  momAsk.structured.find((s) => s.signal === "repeated_questioning")!.severity === "high",
  "frequency 7 → high severity",
);
console.log("✓ extraction: repeated questioning");

const wander = extractObservations("Dad wandered outside at 2am");
assert(
  wander.structured.some((s) => s.signal === "wandering"),
  "Dad wandered… → wandering",
);
assert(wander.safetyRisk === true, "2am outside → safety risk");
assert(wander.supervisionRequired === true, "wandering → supervision required");
assert(
  wander.structured.find((s) => s.signal === "wandering")!.severity === "high",
  "unsupervised night wandering → high severity",
);
console.log("✓ extraction: wandering / safety");

const lost = extractObservations("She got lost walking to the store");
assert(
  lost.structured.some((s) => s.signal === "getting_lost"),
  "got lost → getting_lost",
);
assert(
  lost.structured.find((s) => s.signal === "getting_lost")!.category === "orientation",
  "getting_lost → orientation",
);
console.log("✓ extraction: getting_lost");

// ─── Severity ────────────────────────────────────────────────────────────────
assert(assignSeverity({ frequency: 7 }) === "high", "freq 7 high");
assert(assignSeverity({ frequency: 3 }) === "medium", "freq 3 medium");
assert(assignSeverity({ frequency: 1 }) === "low", "freq 1 low");
assert(assignSeverity({ safetyRisk: true }) === "high", "safety risk high");
assert(extractFrequency("asked seven times") === 7, "extractFrequency seven");
assert(detectSafetyRisk("wandered outside at 2am") === true, "detectSafetyRisk");
console.log("✓ severity assignment");

// ─── Storage schema ──────────────────────────────────────────────────────────
assert(
  observationStoreSchema.observations.columns.includes("transcript") &&
    observationStoreSchema.observations.columns.includes("source_type"),
  "observations schema includes transcript + source_type",
);
assert(
  observationStoreSchema.structured_observations.columns.includes("extracted_signal"),
  "structured_observations schema includes extracted_signal",
);

resetObservationStore();
const saved = saveObservation("cg_test", "Mom asked where Dad was seven times today", "text", [
  { category: "memory", signal: "repeated_questioning", severity: "high" },
]);
assert(saved.observation.caregiver_id === "cg_test", "observation saved");
assert(saved.structured.length === 1, "structured saved");
assert(listStructuredForCaregiver("cg_test").length === 1, "list structured");
console.log("✓ in-memory storage + schema");

// ─── Trend detection ─────────────────────────────────────────────────────────
resetObservationStore();
const caregiver = "cg_trends";
const now = new Date();

function weeksAgo(n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n * 7);
  return d.toISOString();
}

// Seed week-1 style (2 obs) then recent week (more) via direct save + backdating
for (let i = 0; i < 2; i++) {
  const { observation, structured } = saveObservation(
    caregiver,
    "Mom asked the same question again",
    "text",
    [{ category: "memory", signal: "repeated_questioning", severity: "medium" }],
  );
  // Backdate by mutating store through re-save is hard — use pattern-tracking with fabricated records
  void observation;
  void structured;
}

const history = listStructuredForCaregiver(caregiver);
// Fabricate multi-week history for trend detection
const fabricated = [
  ...history.map((r) => ({ ...r, created_at: weeksAgo(3) })),
  {
    id: "str_w4a",
    observation_id: "obs_w4a",
    category: "memory" as const,
    signal: "repeated_questioning" as const,
    severity: "high" as const,
    created_at: weeksAgo(0),
  },
  {
    id: "str_w4b",
    observation_id: "obs_w4b",
    category: "memory" as const,
    signal: "repeated_questioning" as const,
    severity: "high" as const,
    created_at: weeksAgo(0),
  },
  {
    id: "str_w4c",
    observation_id: "obs_w4c",
    category: "memory" as const,
    signal: "repeated_questioning" as const,
    severity: "high" as const,
    created_at: weeksAgo(0),
  },
  {
    id: "str_w4d",
    observation_id: "obs_w4d",
    category: "memory" as const,
    signal: "repeated_questioning" as const,
    severity: "high" as const,
    created_at: weeksAgo(0),
  },
  {
    id: "str_w4e",
    observation_id: "obs_w4e",
    category: "memory" as const,
    signal: "repeated_questioning" as const,
    severity: "high" as const,
    created_at: weeksAgo(0),
  },
  {
    id: "str_w4f",
    observation_id: "obs_w4f",
    category: "memory" as const,
    signal: "repeated_questioning" as const,
    severity: "high" as const,
    created_at: weeksAgo(0),
  },
];

const trends = aggregateWeeklyFrequencies(fabricated, 4, now);
const rqTrend = trends.find((t) => t.signal === "repeated_questioning");
assert(rqTrend, "repeated_questioning trend exists");
assert(rqTrend!.direction === "increasing", "detect increasing frequency trend");

assert(
  detectTrendDirection([
    { weekKey: "a", weekStart: "", count: 2 },
    { weekKey: "b", weekStart: "", count: 6 },
  ]) === "increasing",
  "2→6 increasing",
);

const weekly = generateWeeklySummary(fabricated, 4, now);
assert(weekly.trendSnippets.length > 0, "weekly trend snippets");
assert(
  weekly.headline.toLowerCase().includes("memory") ||
    weekly.headline.toLowerCase().includes("repeated"),
  "headline mentions memory or repeated",
);
assert(!containsForbiddenLanguage(weekly.headline), "headline no forbidden language");
console.log("✓ trend detection + weekly summary");

// ─── Aggregation + forbidden language ────────────────────────────────────────
const extraction = extractObservations("Mom asked where Dad was seven times today");
const aggregation = buildSystemAggregation(extraction, fabricated, now);
assert(typeof aggregation.what_is_happening === "string", "what_is_happening");
assert(typeof aggregation.what_matters_now === "string", "what_matters_now");
assert(typeof aggregation.what_to_ask_next === "string", "what_to_ask_next");
assert(["low", "medium", "high"].includes(aggregation.risk_level), "risk_level");
assert(Array.isArray(aggregation.follow_up_items), "follow_up_items");

const allText = [
  aggregation.what_is_happening,
  aggregation.what_matters_now,
  aggregation.what_to_ask_next,
  aggregation.what_can_wait,
  ...aggregation.follow_up_items,
].join(" ");

assert(!containsForbiddenLanguage(allText), "aggregation free of forbidden language");
assert(!/stage\s*\d+\s*dementia/i.test(allText), "no stage N dementia");
assert(!/alzheimer'?s\s+diagnosis/i.test(allText), "no Alzheimer's diagnosis");
assert(!/medication\s+recommend/i.test(allText), "no medication recommendations");
assert(containsForbiddenLanguage("Stage 4 dementia"), "guard detects Stage 4 dementia");
assert(containsForbiddenLanguage("Alzheimer's diagnosis"), "guard detects Alzheimer's");
console.log("✓ aggregation output + forbidden language guard");

// ─── Facade recordObservation ────────────────────────────────────────────────
resetObservationStore();
const recorded = recordObservation({
  caregiver_id: "cg_facade",
  raw_text: "Dad wandered outside at 2am",
  source: "text",
});
assert(recorded.structured.some((s) => s.signal === "wandering"), "facade extracts wandering");
assert(recorded.aggregation.risk_level === "high", "wandering → high risk_level");
assert(recorded.observations_this_week >= 1, "KPI counter increments");

const report = getObservationExport("cg_facade");
assert(report.html.includes("Caregiver Observation Summary"), "export HTML");
assert(report.sections.disclaimer.includes("does not constitute a medical diagnosis"), "export disclaimer");
assert(!containsForbiddenLanguage(report.sections.summary), "export free of forbidden language");
console.log("✓ recordObservation facade + export report");

// ─── Architecture map registration ───────────────────────────────────────────
assert(
  OBSERVATION_INTELLIGENCE_MVP.successKpi === "observations_per_caregiver_per_week",
  "architecture map KPI",
);
assert(
  OBSERVATION_INTELLIGENCE_MVP.ontologyCategories.length === 6,
  "architecture map ontology",
);
assert(
  V14_ENGINE_MODULES.some((m) => m.spec === "Observation Intelligence MVP"),
  "V14_ENGINE_MODULES includes Observation Intelligence",
);
assert(
  FACADE_DEPRECATION["observation-intelligence"]?.includes("never diagnoses"),
  "facade deprecation registered",
);
assert(
  V14_ANTI_PATTERNS.some((a) => a.includes("diagnosing dementia")),
  "anti-patterns include observation diagnosis",
);

const mapSrc = fs.readFileSync(
  path.join(root, "src/lib/solenos-layers/architecture-map.ts"),
  "utf-8",
);
assert(mapSrc.includes("OBSERVATION_INTELLIGENCE_MVP"), "architecture-map exports MVP const");
assert(mapSrc.includes("observations_per_caregiver_per_week"), "KPI in architecture-map");
console.log("✓ architecture map registration");

// ─── Module files exist ──────────────────────────────────────────────────────
const moduleFiles = [
  "src/lib/observation-intelligence/ontology.ts",
  "src/lib/observation-intelligence/extract-observation.ts",
  "src/lib/observation-intelligence/assign-severity.ts",
  "src/lib/observation-intelligence/stores/observation-store.ts",
  "src/lib/observation-intelligence/pattern-tracking.ts",
  "src/lib/observation-intelligence/weekly-summary.ts",
  "src/lib/observation-intelligence/aggregate-output.ts",
  "src/lib/observation-intelligence/export-report.ts",
  "src/lib/observation-intelligence/index.ts",
  "src/app/api/observations/route.ts",
  "src/app/api/observations/weekly-summary/route.ts",
  "src/app/api/observations/export/route.ts",
];
for (const rel of moduleFiles) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}
console.log("✓ module + API files present");

console.log("\n=== Observation Intelligence: all checks passed ===\n");
