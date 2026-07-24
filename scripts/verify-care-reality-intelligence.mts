/**
 * verify-care-reality-intelligence.mts
 * Care Reality Intelligence facade — composition over baseline/profile/state/continuity.
 * NOT a new pillar (52-pillar count unchanged).
 */

import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import {
  CARE_REALITY_INTELLIGENCE_CATEGORY,
  COMPARISON_ENGINE_QUESTION,
  DO_NOT_BUILD,
  INTELLIGENCE_CHAIN_STAGES,
  TRUST_ENGINEERING_RULES,
  processCareRealityIntelligence,
} from "../src/lib/care-reality-intelligence";
import { CARE_REALITY_INTELLIGENCE } from "../src/lib/solenos-layers/architecture-map";
import { CARE_RECORD_SPINE } from "../src/lib/product-constitution";
import { FORBIDDEN_FEATURE_CATEGORIES } from "../src/lib/forbidden-build-zone/contract-constants";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(
    CARE_REALITY_INTELLIGENCE.notANewPillar === true,
    "Care Reality Intelligence must not register as a new MVP pillar",
  );
  assert(
    CARE_REALITY_INTELLIGENCE.category === CARE_REALITY_INTELLIGENCE_CATEGORY,
    "Architecture map category must match module",
  );
  assert(
    INTELLIGENCE_CHAIN_STAGES.length === 6,
    "Intelligence chain must have six stages",
  );
  assert(CARE_RECORD_SPINE.includes("outcomes"), "CareRecord spine must include outcomes");
  assert(TRUST_ENGINEERING_RULES.length >= 10, "Trust engineering rules must be defined");

  for (const item of [
    "symptom_checker",
    "dementia_faq_assistant",
    "generic_health_chatbot",
    "medical_recommendation_engine",
  ] as const) {
    assert(
      FORBIDDEN_FEATURE_CATEGORIES.includes(item),
      `FBZ must forbid ${item}`,
    );
    assert(DO_NOT_BUILD.includes(item), `DO_NOT_BUILD must include ${item}`);
  }

  const migrationPath = path.join(root, "db/migrations/074_care_reality_intelligence.sql");
  assert(fs.existsSync(migrationPath), "Migration 074 must exist");

  const result = processCareRealityIntelligence({
    care_recipient_id: "verify_recipient",
    all_events: [
      {
        id: "evt_1",
        raw_input: "Mom refused breakfast again after medication was changed last week.",
        extracted_type: "observation",
        source: "user_input",
        timestamp: new Date().toISOString(),
        event_time: { kind: "point", start: new Date().toISOString() },
        ingestion_time: new Date().toISOString(),
        entities: [],
        attributes: {},
        uncertainty: [],
        root_event_id: null,
        document_id: null,
        status: "committed",
        integrity: {
          field_confidence: {
            extracted_fact: { extraction: "medium", user_confirmed: false },
            event_time: { extraction: "medium", user_confirmed: false },
          },
          sources: ["caregiver_input"],
          superseded_by_id: null,
          supersedes_id: null,
          original_extraction: null,
          correction_count: 0,
          audit_trail_ids: [],
        },
        priority: {
          score: 0.5,
          pressure_score: 0.5,
          attention_rank: 1,
          reasons: [],
        },
      },
    ],
    events_created: [],
    what_changed: ["Appetite change noted after recent medication adjustment."],
    what_is_happening: "Reduced appetite observed.",
    what_needs_attention: ["Confirm whether pattern repeats in mornings."],
    what_is_uncertain: ["Duration of appetite change"],
    as_of: new Date().toISOString(),
  });

  assert(result.active, "Facade must activate when events exist");
  assert(
    result.snapshot.comparison_question === COMPARISON_ENGINE_QUESTION,
    "Comparison question must be person-specific",
  );
  assert(result.snapshot.intelligence_chain.length >= 2, "Chain must link events and changes");
  assert(
    result.snapshot.intelligence_chain.some((l) => l.stage === "events"),
    "Chain must include events stage",
  );
  assert(
    !result.snapshot.person_specific_summary.toLowerCase().includes("commonly seen in dementia"),
    "Must not emit generic dementia education",
  );

  console.log("verify:care-reality-intelligence OK");
}

main();
