/**
 * verify-unknowns-engine.mts
 * Disease-agnostic Unknowns + Dementia profile + presentation + evidence (vertical).
 */

import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import { resetMoatStore } from "../src/lib/network-effect-moat";
import { resetSuccessModelStore } from "../src/lib/success-model";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";
import { resetContinuousExecutionStore } from "../src/lib/continuous-execution-loop";
import { seedVerifyConsent, resetPolicyEngineStore } from "../src/lib/policy-engine";
import { resetJourneyInteractionStore } from "../src/lib/single-user-journey";
import { resetRetentionSessionStore } from "../src/lib/retention-engine";
import {
  resetDerivedTables,
  resetEventStore,
  resetProjectionStore,
  resetSessionStore,
} from "../src/lib/event-sourced-storage";
import { resetContinuityPropertiesStore } from "../src/lib/continuity-properties";
import { resetInferenceLearningStore } from "../src/lib/continuity-properties";
import {
  DEMENTIA_UNKNOWNS_PROFILE,
  deriveExplicitUnknowns,
  getClinicalUnknownsProfile,
  questionsFromUnknowns,
} from "../src/lib/unknowns-engine";
import { projectPresentation } from "../src/lib/presentation-engine";
import { buildEvidenceObject, buildEvidencedConclusion } from "../src/lib/evidence-preservation";
import {
  ACTOR_ROLES,
  INSTITUTIONAL_READINESS_RULES,
  PRIVACY_ARCHITECTURE_RULES,
  filterEventsForRole,
} from "../src/lib/privacy-institutional-contracts";
import {
  resetCareContextRootStore,
  processSituationInput,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function resetAll(): void {
  resetCareContextRootStore();
  resetCareEventStore();
  resetDareStore();
  resetIntegrityAuditStore();
  resetMemoryLayerStore();
  resetFailureResilienceStore();
  resetMoatStore();
  resetSuccessModelStore();
  resetMvpSurfaceStore();
  resetContinuousExecutionStore();
  resetRetentionSessionStore();
  resetJourneyInteractionStore();
  resetEventStore();
  resetProjectionStore();
  resetSessionStore();
  resetDerivedTables();
  resetPolicyEngineStore();
  resetContinuityPropertiesStore();
  resetInferenceLearningStore();
}

console.log("=== Unknowns Engine + Presentation + Evidence (one system) ===\n");

assert(DEMENTIA_UNKNOWNS_PROFILE.profile_id === "dementia", "dementia profile");
assert(getClinicalUnknownsProfile("dementia").rules.length >= 10, "profile rules");
// Engine is profile-driven — not dementia hardcoded in engine logic
assert(
  !fs
    .readFileSync(path.join(root, "src/lib/unknowns-engine/engine.ts"), "utf8")
    .includes("Alzheimer"),
  "engine not disease-hardcoded",
);

const eum = deriveExplicitUnknowns({
  known: ["Appetite decreased"],
  inferred: ["Possible nutritional concern"],
  event_texts: ["Mom is eating less and more confused after hospital discharge"],
  unresolved_clarifications: [],
  clinical_profile_id: "dementia",
});
assert(eum.clinical_profile_id === "dementia", "profile selected");
assert(eum.explicit_unknowns.some((u) => u.unknown_id && u.status === "unresolved"), "schema");
assert(
  eum.explicit_unknowns.some((u) => /hydrat|medication|weight/i.test(u.missing_information)),
  "dementia-relevant unknowns",
);
const qs = questionsFromUnknowns(eum.explicit_unknowns, 2);
assert(qs.length <= 2, "max 2 clarification questions");
assert(qs.every((q) => !/tell me more/i.test(q)), "purposeful questions");
console.log("✓ disease-agnostic engine + dementia profile");

const truth = {
  what_changed: ["Wandering increased", "Appetite decreased", "Med changed"],
  what_is_happening: ["Nighttime wandering"],
  what_needs_attention: ["Review supervision"],
  what_is_stable: ["Daytime calm"],
  known: ["Wandered twice"],
  inferred: ["Supervision demand may be rising"],
  explicit_unknowns: eum.explicit_unknowns.map((u) => ({
    missing_information: u.missing_information,
    priority: u.priority,
    reason_it_matters: u.reason_it_matters,
  })),
  confidence_notes: ["0.70 moderate"],
  evidence_summaries: ["Step 1: fall", "Step 2: wander"],
};
const essential = projectPresentation(truth, { mode: "essential" });
const detailed = projectPresentation(truth, { mode: "detailed" });
assert(essential.sections.what_changed.length <= 2, "essential compresses");
assert(detailed.sections.full_detail != null, "detailed keeps full truth");
assert(essential.invariants.does_not_mutate_truth === true, "presentation only");
assert(
  essential.sections.what_changed[0] === detailed.sections.what_changed[0] ||
    truth.what_changed.includes(essential.sections.what_changed[0]!),
  "same underlying facts",
);
console.log("✓ presentation is projection only");

const evidence = buildEvidencedConclusion({
  recommendation: "Supervision needs may have increased",
  implied_action: "Discuss nighttime safety with clinician",
  evidence: buildEvidenceObject({
    event_ids: ["ce1", "ce2"],
    timeline_labels: ["Night wander", "Near fall"],
    confidence_score: 0.72,
    source_reliability_score: 0.8,
    reasoning_summary: "Fall frequency + nighttime wandering",
  }),
});
assert(!/AI (?:determined|thinks)/i.test(evidence.layers.confidence), "no AI decree");
assert(evidence.evidence.evidence_chain.length >= 2, "chain present");
console.log("✓ evidence preservation");

assert(ACTOR_ROLES.includes("clinician"), "institutional roles defined");
assert(PRIVACY_ARCHITECTURE_RULES.length >= 5, "privacy contracts");
assert(INSTITUTIONAL_READINESS_RULES.includes("no_hospital_mode_fork"), "no fork");
const filtered = filterEventsForRole(
  [
    {
      privacy: {
        visibility_roles: ["primary_caregiver"],
        ownership_scope: "fam1",
        sensitivity_level: "medium",
        purpose_tags: ["care_continuity"],
        consent_present: true,
      },
    },
  ],
  "institutional_observer",
);
assert(filtered.length === 0, "role filter does not invent access");
console.log("✓ privacy + institutional contracts (projection-ready)");

assert(
  fs.existsSync(path.join(root, "db/migrations/073_unknowns_evidence_privacy.sql")),
  "migration 073",
);

resetAll();
const caregiverId = "cg_unknowns_engine";
seedVerifyConsent(caregiverId);
const result = await processSituationInput({
  raw_input:
    "Mom ate almost nothing for three days after discharge and wandered at night — I'm exhausted.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-15T09:00:00.000Z",
});

assert(result.continuity_properties_layer?.presentation?.mode === "standard", "presentation");
assert(
  result.continuity_properties_layer!.presentation.invariants.does_not_mutate_truth,
  "non-mutating",
);
assert(
  result.continuity_properties_layer!.clinical_profile_id === "dementia",
  "dementia profile active",
);
assert(
  result.continuity_properties_layer!.invariants.dementia_is_profile_not_architecture,
  "profile invariant",
);
assert(
  result.care_state_engine_layer!.care_state.explicit_unknowns.some(
    (u) => u.unknown_id || u.field_name,
  ),
  "Care State unknowns structured",
);
assert(
  (result.clarification_engine_layer?.questions.length ?? 0) <= 2,
  "clarification capped at 2",
);
assert(
  result.continuity_properties_layer!.evidence_conclusion == null ||
    result.continuity_properties_layer!.evidence_conclusion.evidence.event_ids != null,
  "evidence object when concluding",
);
console.log("✓ pipeline vertical wiring");

console.log("\n=== Unknowns / Presentation / Evidence: ALL CHECKS PASSED ===\n");
