import fs from "node:fs";
import path from "node:path";
import {
  assertSupportSignalObservationOnly,
  evaluateSupportSignal,
  MESSAGE_TEMPLATES,
  OVERLOAD_SPEC_EXAMPLE_TEMPLATE_ID,
  RECENT_NOTIFICATION_SUPPRESSION_HOURS,
  REENTRY_INACTIVITY_DAYS_THRESHOLD,
  SUPPORT_SIGNAL_ANTI_DRIFT_RULES,
  SUPPORT_SIGNAL_FORBIDDEN_USES,
  SUPPORT_SIGNAL_ONE_LINE_TRUTH,
  SUPPORT_SIGNAL_PURPOSE,
  SUPPORT_SIGNAL_SUCCESS_DEFINITION,
  SUPPORT_SIGNAL_TELEMETRY_ALLOWED_FIELDS,
  SUPPORT_SIGNAL_TELEMETRY_FORBIDDEN_FIELDS,
  STABILIZATION_SUSTAINED_PRESSURE_DAYS,
  classifyTimeOfDay,
  getTemplateById,
  mapSupportState,
} from "../src/lib/support-signal-system";
import {
  SupportSignalEvaluateRequestSchema,
  SupportSignalTelemetryInsertSchema,
  assertSupportSignalTelemetrySchemaBoundary,
  SUPPORT_SIGNAL_TELEMETRY_RULE,
} from "../src/lib/telemetry-persistence/support-signal-telemetry";
import { GEMINI_OUTPUT_SCHEMA } from "../src/lib/gemini-contract";
import { validateAIResponse } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== SolenOS Support Signal System (SSS v1) ===\n");

if (!SUPPORT_SIGNAL_PURPOSE.includes("uncertainty")) {
  throw new Error("purpose must reference uncertainty reduction");
}
if (!SUPPORT_SIGNAL_ONE_LINE_TRUTH.includes("silence")) {
  throw new Error("one-line truth must prefer silence");
}
if (!SUPPORT_SIGNAL_SUCCESS_DEFINITION.includes("dependency")) {
  throw new Error("success definition must forbid dependency");
}
if (SUPPORT_SIGNAL_ANTI_DRIFT_RULES.length < 5) {
  throw new Error("anti-drift rules drift");
}
for (const forbidden of SUPPORT_SIGNAL_FORBIDDEN_USES) {
  if (!forbidden) throw new Error("forbidden uses drift");
}
console.log("✓ contract constants + anti-drift rules");

const migration = fs.readFileSync(
  "db/migrations/008_support_signal_telemetry.sql",
  "utf-8",
);
if (!migration.includes("support_signal_events")) {
  throw new Error("migration must create support_signal_events");
}
if (migration.includes("ALTER TABLE interactions")) {
  throw new Error("interactions table must NOT be modified");
}
for (const forbidden of SUPPORT_SIGNAL_TELEMETRY_FORBIDDEN_FIELDS) {
  if (new RegExp(`\\b${forbidden}\\b`, "i").test(migration)) {
    throw new Error(`migration must not define forbidden telemetry field: ${forbidden}`);
  }
}
if (!migration.includes("ROW LEVEL SECURITY")) {
  throw new Error("migration must enable RLS when pattern exists");
}
console.log("✓ migration 008 — telemetry table only, RLS, no interactions change");

if (!SUPPORT_SIGNAL_TELEMETRY_RULE.includes("forbidden")) {
  throw new Error("telemetry rule drift");
}
assertSupportSignalTelemetrySchemaBoundary([
  "id",
  "user_id",
  ...SUPPORT_SIGNAL_TELEMETRY_ALLOWED_FIELDS,
]);
try {
  assertSupportSignalTelemetrySchemaBoundary(["engagement_score"]);
  throw new Error("telemetry boundary must reject forbidden fields");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("forbidden")) {
    throw error;
  }
}
SupportSignalTelemetryInsertSchema.parse({
  user_id: "00000000-0000-4000-8000-000000000001",
  notification_id: "overload-01",
  category: "overload",
  delivered_at: new Date().toISOString(),
  suppressed: false,
});
console.log("✓ telemetry schema — allowed fields only");

const overloadExample = getTemplateById(OVERLOAD_SPEC_EXAMPLE_TEMPLATE_ID);
if (!overloadExample || overloadExample.category !== "overload") {
  throw new Error("overload spec example template missing");
}
if (!overloadExample.text.includes("load you are carrying")) {
  throw new Error("overload spec example text drift");
}
console.log(`✓ static templates (${MESSAGE_TEMPLATES.length} total, overload spec example present)`);

for (const template of MESSAGE_TEMPLATES) {
  const lower = template.text.toLowerCase();
  for (const forbidden of ["great job", "proud of you", "you've got this", "miss you"]) {
    if (lower.includes(forbidden)) {
      throw new Error(`template ${template.id} contains forbidden tone: ${forbidden}`);
    }
  }
}
console.log("✓ templates avoid guilt/praise/dependency tone");

const baseline = evaluateSupportSignal({
  care_context_state: "active_care",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "morning",
});
if (baseline.deliver) {
  throw new Error("default must be silence for stable normal active care");
}
console.log("✓ default silence");

const crisis = evaluateSupportSignal({
  care_context_state: "crisis",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  recent_high_risk_event: true,
  inactivity_days: 0,
  time_of_day: "morning",
});
if (!crisis.deliver || crisis.support_state !== "crisis") {
  throw new Error("crisis must deliver on recent high-risk event");
}
console.log("✓ crisis delivery rule");

const overload = evaluateSupportSignal({
  care_context_state: "active_care",
  caregiver_depletion_state: "critical",
  is_single_caregiver: true,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "late_night",
});
if (!overload.deliver || overload.support_state !== "overload") {
  throw new Error("overload must deliver on critical depletion");
}
if (overload.template?.id !== OVERLOAD_SPEC_EXAMPLE_TEMPLATE_ID) {
  // seed-based selection may pick overload-02; at least category must match
  if (overload.template?.category !== "overload") {
    throw new Error("overload must select overload template category");
  }
}
console.log("✓ overload delivery rule");

const reentry = evaluateSupportSignal({
  care_context_state: "post_care",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: REENTRY_INACTIVITY_DAYS_THRESHOLD,
  time_of_day: "morning",
});
if (!reentry.deliver || reentry.support_state !== "reentry") {
  throw new Error("re-entry must deliver after prolonged absence");
}
console.log("✓ re-entry delivery rule");

const stabilization = evaluateSupportSignal({
  care_context_state: "active_care",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "morning",
  sustained_pressure_days: STABILIZATION_SUSTAINED_PRESSURE_DAYS,
});
if (!stabilization.deliver || stabilization.support_state !== "stable") {
  throw new Error("stabilization must deliver after sustained pressure");
}
console.log("✓ stabilization delivery rule");

const afternoonBlocked = evaluateSupportSignal({
  care_context_state: "active_care",
  caregiver_depletion_state: "elevated",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "afternoon",
});
if (afternoonBlocked.deliver) {
  throw new Error("non-crisis signals should avoid afternoon high-activity window");
}
console.log("✓ time-of-day gating (afternoon blocked unless crisis)");

const crisisAfternoon = evaluateSupportSignal({
  care_context_state: "crisis",
  caregiver_depletion_state: "elevated",
  is_single_caregiver: false,
  recent_high_risk_event: true,
  inactivity_days: 0,
  time_of_day: "afternoon",
});
if (!crisisAfternoon.deliver) {
  throw new Error("crisis must override afternoon restriction");
}
console.log("✓ crisis overrides time-of-day");

const recentSuppress = evaluateSupportSignal({
  care_context_state: "crisis",
  caregiver_depletion_state: "critical",
  is_single_caregiver: false,
  recent_high_risk_event: true,
  inactivity_days: 0,
  time_of_day: "morning",
  last_delivered_at: new Date().toISOString(),
  now_ms: Date.now(),
});
if (!recentSuppress.suppressed || recentSuppress.deliver) {
  throw new Error("recent notification must suppress delivery");
}
console.log(`✓ suppression — recent send within ${RECENT_NOTIFICATION_SUPPRESSION_HOURS}h`);

const noChange = evaluateSupportSignal({
  care_context_state: "active_care",
  caregiver_depletion_state: "critical",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "late_night",
  previous_support_state: "overload",
  last_delivered_at: new Date(Date.now() - RECENT_NOTIFICATION_SUPPRESSION_HOURS * 3600 * 1000).toISOString(),
});
if (!noChange.suppressed) {
  throw new Error("unchanged support state must suppress");
}
console.log("✓ suppression — no state change");

const uncertain = evaluateSupportSignal({
  care_context_state: "uncertain",
  caregiver_depletion_state: "elevated",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "morning",
});
if (uncertain.deliver) {
  throw new Error("uncertain care context must not deliver (except crisis handled separately)");
}
console.log("✓ suppression — unclear value / uncertain context");

const mapped = mapSupportState({
  care_context_state: "active_care",
  caregiver_depletion_state: "critical",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 0,
  time_of_day: "night",
});
if (mapped !== "overload") {
  throw new Error("mapSupportState must map critical depletion to overload");
}
console.log("✓ observational mapSupportState (selection only)");

SupportSignalEvaluateRequestSchema.parse({
  care_context_state: "active_care",
  caregiver_depletion_state: "normal",
  is_single_caregiver: false,
  recent_high_risk_event: false,
  inactivity_days: 1,
  time_of_day: classifyTimeOfDay(new Date("2026-01-15T08:00:00")),
});
console.log("✓ API request schema");

const apiRoute = fs.readFileSync(
  "src/app/api/support-signal/evaluate/route.ts",
  "utf-8",
);
if (!apiRoute.includes("evaluateSupportSignal")) {
  throw new Error("API route must call evaluateSupportSignal");
}
if (!apiRoute.includes("push notification delivery is out of scope")) {
  throw new Error("API route must document push delivery out of scope");
}
console.log("✓ API route — evaluate + telemetry, push out of scope");

if (GEMINI_OUTPUT_SCHEMA.includes("support_state")) {
  throw new Error("output schema must NOT include support_state");
}
const output = validateAIResponse(VERIFY_VALID_SOLENOS);
const outputKeys = Object.keys(output).sort().join(",");
if (outputKeys !== "risk_level,what_can_wait,what_is_happening,what_matters_now,what_to_ask_next") {
  throw new Error("SSS must NOT change analyze output schema");
}
console.log("✓ no analyze output schema changes");

const analyzePipeline = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
if (/support_state|support-signal|evaluateSupportSignal/i.test(analyzePipeline)) {
  throw new Error("analyze pipeline must NOT branch on support signals");
}
console.log("✓ anti-drift: analyze pipeline untouched");

assertSupportSignalObservationOnly({
  usesForRouting: false,
  usesForUiBranching: false,
  usesForSchemaChange: false,
  usesForEngagement: false,
});
try {
  assertSupportSignalObservationOnly({ usesForEngagement: true });
  throw new Error("assertSupportSignalObservationOnly must reject engagement");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("anti-drift")) {
    throw error;
  }
}
console.log("✓ assertSupportSignalObservationOnly");

console.log(`\n✓ ${SUPPORT_SIGNAL_ONE_LINE_TRUTH}`);
