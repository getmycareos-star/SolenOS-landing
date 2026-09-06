/**
 * verify-cross-domain-reasoning.mts
 * Cross-Domain Reasoning engine — detect relationships across care domains.
 * Never asserts causation. Preserves uncertainty and evidence provenance.
 */

import "./_verify-env.mts";

import {
  detectCrossDomainSituations,
  explainCrossDomainSituation,
  listDomainsForSituation,
  CROSS_DOMAIN_REASONING_PURPOSE,
  CROSS_DOMAIN_REASONING_STATUS,
  MINIMUM_DOMAINS_FOR_SITUATION,
  MINIMUM_EVENTS_FOR_SITUATION,
  DOMAIN_CATEGORIES,
  RELATIONSHIP_STRENGTHS,
  SITUATION_STATUSES,
} from "../src/lib/cross-domain-reasoning";
import { CROSS_DOMAIN_REASONING } from "../src/lib/solenos-layers/architecture-map";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function iso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

function makeEvent(overrides: Record<string, unknown>): any {
  const base = {
    id: `ev_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: iso(0),
    event_time: { start: iso(0), confidence: 1 },
    ingestion_time: iso(0),
    raw_input: "",
    extracted_type: "observation",
    entities: [],
    attributes: {},
    uncertainty: [],
    source: "user_input",
    root_event_id: null,
    situation_id: null,
    document_id: null,
    status: "committed",
    integrity: {
      field_confidence: { extracted_fact: { extraction: "medium", user_confirmed: false }, event_time: { extraction: "medium", user_confirmed: false } },
      sources: ["caregiver_input"],
      superseded_by_id: null,
      supersedes_id: null,
      original_extraction: null,
      correction_count: 0,
      audit_trail_ids: [],
    },
    priority: { score: 0.5, pressure_score: 0.5, attention_rank: 1, reasons: [] },
  };
  return { ...base, ...overrides };
}

console.log("=== Cross-Domain Reasoning ===\n");

// Architecture map
{
  assert(CROSS_DOMAIN_REASONING.notANewPillar === true, "must not be new pillar");
  assert(CROSS_DOMAIN_REASONING.modulePath === "src/lib/cross-domain-reasoning", "module path correct");
  assert(CROSS_DOMAIN_REASONING_STATUS.module === "IMPLEMENTED", "status implemented");
  console.log("Architecture map OK");
}

// Purpose and constants
{
  assert(CROSS_DOMAIN_REASONING_PURPOSE.length > 0, "purpose defined");
  assert(DOMAIN_CATEGORIES.length >= 8, "domain categories defined");
  assert(RELATIONSHIP_STRENGTHS.length >= 5, "relationship strengths defined");
  assert(SITUATION_STATUSES.length >= 5, "situation statuses defined");
  assert(MINIMUM_DOMAINS_FOR_SITUATION >= 2, "min domains >= 2");
  assert(MINIMUM_EVENTS_FOR_SITUATION >= 2, "min events >= 2");
  console.log("Constants OK");
}

// Test 1 — Medication + symptom
{
  const events = [
    makeEvent({
      id: "ev_med",
      raw_input: "Doctor changed her medication dose yesterday.",
      extracted_type: "decision",
      event_time: { start: iso(-2), confidence: 1 },
      attributes: { medication: "lisinopril" },
    }),
    makeEvent({
      id: "ev_sleep",
      raw_input: "She is unusually sleepy today.",
      extracted_type: "observation",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { symptom: "sleepiness" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r1", events });
  assert(result.situations.length > 0, "Test 1: situation detected");
  const sit = result.situations[0]!;
  assert(sit.domains.includes("medication"), "Test 1: medication domain present");
  assert(sit.domains.includes("symptom"), "Test 1: symptom domain present");
  assert(!sit.explanation.toLowerCase().includes("caused"), "Test 1: must not assert causation");
  console.log("Test 1 — medication + symptom OK");
}

// Test 2 — Medication + symptom + function + safety
{
  const events = [
    makeEvent({
      id: "ev_med2",
      raw_input: "Started a new medication on August 1.",
      extracted_type: "decision",
      event_time: { start: iso(-10), confidence: 1 },
      attributes: { medication: "new prescription" },
    }),
    makeEvent({
      id: "ev_sleep2",
      raw_input: "Sleep has been poor since the medication change.",
      extracted_type: "observation",
      event_time: { start: iso(-7), confidence: 1 },
      attributes: { symptom: "poor sleep" },
    }),
    makeEvent({
      id: "ev_mobility",
      raw_input: "She seems to have more difficulty walking now.",
      extracted_type: "observation",
      event_time: { start: iso(-3), confidence: 1 },
      attributes: { functional_status: "mobility decline" },
    }),
    makeEvent({
      id: "ev_fall",
      raw_input: "Mom fell this morning.",
      extracted_type: "incident",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { safety: "fall" },
    }),
    makeEvent({
      id: "ev_cg",
      raw_input: "Dad seems much weaker than usual.",
      extracted_type: "observation",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { caregiver_observation: "weaker" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r2", events });
  assert(result.situations.length > 0, "Test 2: situation detected");
  const sit = result.situations[0]!;
  assert(sit.domains.length >= 4, `Test 2: at least 4 domains, got ${sit.domains.length}`);
  assert(sit.participating_event_ids.length >= 4, "Test 2: at least 4 events in situation");
  assert(!sit.explanation.toLowerCase().includes("caused"), "Test 2: must not assert causation");
  console.log("Test 2 — medication + symptom + function + safety OK");
}

// Test 3 — Unrelated events (temporally distant)
{
  const events = [
    makeEvent({
      id: "ev_old_med",
      raw_input: "Medication changed six months ago.",
      extracted_type: "decision",
      event_time: { start: iso(-180), confidence: 1 },
      attributes: { medication: "old change" },
    }),
    makeEvent({
      id: "ev_today_fall",
      raw_input: "Patient had a fall today.",
      extracted_type: "incident",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { safety: "fall" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r3", events });
  assert(result.situations.length === 0, "Test 3: no situation for distant events");
  console.log("Test 3 — unrelated distant events OK");
}

// Test 4 — Explicit source relationship
{
  const events = [
    makeEvent({
      id: "ev_med_explicit",
      raw_input: "After starting the new medication, the caregiver noticed increased sleepiness.",
      extracted_type: "decision",
      event_time: { start: iso(-3), confidence: 1 },
      attributes: { medication: "new" },
    }),
    makeEvent({
      id: "ev_sleep_explicit",
      raw_input: "Mom is much sleepier than usual.",
      extracted_type: "observation",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { symptom: "sleepiness" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r4", events });
  assert(result.situations.length > 0, "Test 4: situation detected");
  const sit = result.situations[0]!;
  const explicitRel = sit.relationships.find((r) => r.is_explicit_documented);
  assert(explicitRel !== undefined, "Test 4: explicit relationship preserved");
  assert(explicitRel!.strength === "EXPLICIT", "Test 4: strength is EXPLICIT");
  console.log("Test 4 — explicit source relationship OK");
}

// Test 5 — Conflicting observations within cross-domain situation
{
  const events = [
    makeEvent({
      id: "ev_med5",
      raw_input: "New medication started last week.",
      extracted_type: "decision",
      event_time: { start: iso(-7), confidence: 1 },
      attributes: { medication: "new prescription" },
    }),
    makeEvent({
      id: "ev_cgA",
      raw_input: "Mom is walking much less than before.",
      extracted_type: "observation",
      event_time: { start: iso(-1), confidence: 1 },
      attributes: { caregiver_observation: "mobility_worsened" },
    }),
    makeEvent({
      id: "ev_cgB",
      raw_input: "Mom is walking normally.",
      extracted_type: "observation",
      event_time: { start: iso(-1), confidence: 1 },
      attributes: { caregiver_observation: "mobility_normal" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r5", events });
  assert(result.situations.length > 0, "Test 5: situation detected");
  const sit = result.situations[0]!;
  assert(sit.domains.length >= 2, "Test 5: multiple domains involved");
  assert(sit.contradictions.length > 0, "Test 5: contradiction preserved");
  console.log("Test 5 — conflicting observations OK");
}

// Test 6 — Missing dates
{
  const events = [
    makeEvent({
      id: "ev_missing_date",
      raw_input: "Medication was changed at some point.",
      extracted_type: "decision",
      event_time: { type: "unknown", start: undefined, confidence: 0 },
      attributes: { medication: "unknown timing" },
    }),
    makeEvent({
      id: "ev_fall_dated",
      raw_input: "She fell on August 20.",
      extracted_type: "incident",
      event_time: { start: iso(-1), confidence: 1 },
      attributes: { safety: "fall" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r6", events });
  if (result.situations.length > 0) {
    const sit = result.situations[0]!;
    assert(sit.uncertainty.some((u) => /date|temporal|unknown/i.test(u)), "Test 6: uncertainty noted for missing dates");
  }
  console.log("Test 6 — missing dates OK");
}

// Test 7 — Care transition
{
  const events = [
    makeEvent({
      id: "ev_hosp",
      raw_input: "Hospitalized for three days last week.",
      extracted_type: "document_fact",
      event_time: { start: iso(-10), confidence: 1 },
      attributes: { hospitalization: "recent" },
    }),
    makeEvent({
      id: "ev_discharge",
      raw_input: "Discharged with a new medication list and home-care instructions.",
      extracted_type: "decision",
      event_time: { start: iso(-8), confidence: 1 },
      attributes: { care_plan: "new instructions", medication: "new list" },
    }),
    makeEvent({
      id: "ev_function",
      raw_input: "She needs more help walking since coming home.",
      extracted_type: "observation",
      event_time: { start: iso(-5), confidence: 1 },
      attributes: { functional_status: "reduced independence" },
    }),
    makeEvent({
      id: "ev_family",
      raw_input: "Family has started providing additional assistance.",
      extracted_type: "observation",
      event_time: { start: iso(-3), confidence: 1 },
      attributes: { caregiver_observation: "increased assistance" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r7", events });
  assert(result.situations.length > 0, "Test 7: situation detected");
  const sit = result.situations[0]!;
  assert(sit.domains.includes("hospitalization") || sit.domains.includes("care_plan"), "Test 7: transition domains present");
  console.log("Test 7 — care transition OK");
}

// Test 8 — Causal overreach rejection
{
  const events = [
    makeEvent({
      id: "ev_med_causal",
      raw_input: "Medication was adjusted last week.",
      extracted_type: "decision",
      event_time: { start: iso(-7), confidence: 1 },
      attributes: { medication: "adjusted" },
    }),
    makeEvent({
      id: "ev_confusion",
      raw_input: "She seems more confused lately.",
      extracted_type: "observation",
      event_time: { start: iso(-2), confidence: 1 },
      attributes: { symptom: "confusion" },
    }),
    makeEvent({
      id: "ev_fall_causal",
      raw_input: "She had a fall today.",
      extracted_type: "incident",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { safety: "fall" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r8", events });
  assert(result.situations.length > 0, "Test 8: situation detected");
  for (const sit of result.situations) {
    assert(!sit.explanation.toLowerCase().includes("caused"), "Test 8: explanation must not assert causation");
    assert(!sit.explanation.toLowerCase().includes("delirium"), "Test 8: explanation must not assert delirium");
  }
  console.log("Test 8 — causal overreach rejected OK");
}

// Single-domain events are NOT cross-domain
{
  const events = [
    makeEvent({
      id: "ev_fall_only",
      raw_input: "She fell twice this week.",
      extracted_type: "incident",
      event_time: { start: iso(-1), confidence: 1 },
      attributes: { safety: "fall" },
    }),
    makeEvent({
      id: "ev_fall_only2",
      raw_input: "Another fall today.",
      extracted_type: "incident",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { safety: "fall" },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r9", events });
  assert(result.situations.length === 0, "Single-domain falls must not create cross-domain situation");
  console.log("Single-domain isolation OK");
}

// Unrelated events must not be artificially connected
{
  const events = [
    makeEvent({
      id: "ev_unrelated1",
      raw_input: "She got a haircut.",
      extracted_type: "observation",
      event_time: { start: iso(-5), confidence: 1 },
    }),
    makeEvent({
      id: "ev_unrelated2",
      raw_input: "The dog needed vet visit.",
      extracted_type: "observation",
      event_time: { start: iso(0), confidence: 1 },
    }),
  ];

  const result = detectCrossDomainSituations({ care_recipient_id: "r10", events });
  assert(result.situations.length === 0, "Unrelated events must not connect");
  console.log("Unrelated event isolation OK");
}

// Insufficient events
{
  const result = detectCrossDomainSituations({ care_recipient_id: "r11", events: [] });
  assert(result.situations.length === 0, "Empty events returns no situations");
  console.log("Insufficient events OK");
}

// Explain function
{
  const events = [
    makeEvent({
      id: "ev_explain",
      raw_input: "Medication changed yesterday.",
      extracted_type: "decision",
      event_time: { start: iso(-1), confidence: 1 },
      attributes: { medication: "changed" },
    }),
    makeEvent({
      id: "ev_explain2",
      raw_input: "She is more tired today.",
      extracted_type: "observation",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { symptom: "fatigue" },
    }),
  ];
  const result = detectCrossDomainSituations({ care_recipient_id: "r12", events });
  if (result.situations.length > 0) {
    const explanation = explainCrossDomainSituation(result.situations[0]!);
    assert(explanation.length > 0, "Explanation must be non-empty");
    assert(!explanation.toLowerCase().includes("caused"), "Explanation must not assert causation");
    const domains = listDomainsForSituation(result.situations[0]!);
    assert(domains.length >= 2, "Domain participation must be reported");
    console.log("Explain + domain participation OK");
  }
}

// Relationship strength distribution
{
  const events = [
    makeEvent({
      id: "ev_str_a",
      raw_input: "After starting the new medication, she became unusually sleepy.",
      extracted_type: "decision",
      event_time: { start: iso(-3), confidence: 1 },
      attributes: { medication: "new" },
    }),
    makeEvent({
      id: "ev_str_b",
      raw_input: "She needed more assistance walking.",
      extracted_type: "observation",
      event_time: { start: iso(0), confidence: 1 },
      attributes: { functional_status: "assistance" },
    }),
  ];
  const result = detectCrossDomainSituations({ care_recipient_id: "r13", events });
  if (result.situations.length > 0) {
    const sit = result.situations[0]!;
    const strengths = sit.relationships.map((r) => r.strength);
    assert(strengths.some((s) => RELATIONSHIP_STRENGTHS.includes(s as any)), "Strength must be valid enum");
    console.log("Relationship strength OK");
  }
}

console.log("\nCross-Domain Reasoning verify passed.\n");
