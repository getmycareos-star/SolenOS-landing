import {

  CONFIDENCE_GAP_THRESHOLD,

  DECAY_PIPELINE_STAGES,

  DECAY_PROHIBITED,

} from "./contract-constants";

import { detectContinuityGaps, deriveStaleItems } from "./continuity-gaps";

import {

  computeObjectConfidence,

  computeOverallContinuityConfidence,

} from "./compute-decay";

import { deriveExpectedFollowUps } from "./expected-followups";

import { learnFamilyRhythm } from "./family-rhythm";

import {

  buildDecisionTraceReasons,

  buildRecheckPrompts,

  buildRefreshSession,

} from "./refresh-planner";

import { recordDecaySnapshot } from "./store";

import type { ContinuityDecayResult, ProcessContinuityDecayInput } from "./types";



export function shouldTriggerDecayEngine(input: ProcessContinuityDecayInput): {

  triggered: boolean;

  reasons: string[];

} {

  const reasons: string[] = [];

  const active = input.all_events.filter(

    (e) => e.status !== "invalidated" && e.status !== "superseded",

  );



  if (active.length === 0) {

    return { triggered: false, reasons: [] };

  }



  reasons.push("CareContext contains objects requiring freshness evaluation");



  if (input.trigger === "idle_refresh") {

    reasons.push("Background idle refresh — time-based confidence recompute");

  }



  if (input.what_is_uncertain.length > 0) {

    reasons.push("Unresolved uncertainties increase continuity decay pressure");

  }



  if (input.events_created.length > 0) {

    reasons.push("New information may recover confidence in affected areas");

  }



  return { triggered: true, reasons };

}



export function processContinuityDecay(

  input: ProcessContinuityDecayInput,

): ContinuityDecayResult {

  const { triggered, reasons } = shouldTriggerDecayEngine(input);



  if (!triggered) {

    return emptyDecayResult();

  }



  const asOf = input.as_of ?? new Date().toISOString();

  const reinforcedIds = new Set(input.events_created.map((e) => e.id));

  const active = input.all_events.filter(

    (e) => e.status !== "invalidated" && e.status !== "superseded",

  );



  const object_confidence = active.map((event) =>

    computeObjectConfidence(event, asOf, reinforcedIds.has(event.id)),

  );



  const family_rhythm = learnFamilyRhythm({

    caregiver_id: input.caregiver_id,

    all_events: active,

    as_of: asOf,

  });



  const silencePenalty = family_rhythm.meaningful_gap

    ? Math.min(25, family_rhythm.days_since_last_update * 2)

    : 0;



  const continuity_confidence_pct = computeOverallContinuityConfidence(

    object_confidence,

    silencePenalty,

  );



  const stale_items = deriveStaleItems(object_confidence);

  const expected_follow_ups = deriveExpectedFollowUps(active, asOf);

  const overdue_follow_ups = expected_follow_ups.filter(

    (f) => !f.confirmed && f.overdue_days !== null && f.overdue_days > 0,

  );



  const continuity_gaps = detectContinuityGaps({

    stale_items,

    expected_follow_ups,

    meaningful_silence: family_rhythm.meaningful_gap,

    days_since_last_update: family_rhythm.days_since_last_update,

  });



  const refresh_session = buildRefreshSession({

    days_since_last_update: family_rhythm.days_since_last_update,

    gaps: continuity_gaps,

    stale_items,

    meaningful_gap: family_rhythm.meaningful_gap,

  });



  const recheck_prompts = buildRecheckPrompts({ gaps: continuity_gaps, overdue_follow_ups });



  const at_risk_event_ids = [

    ...new Set([

      ...stale_items.filter((s) => s.tier !== "long_lived").map((s) => s.object_id),

      ...overdue_follow_ups.map((f) => f.source_event_id),

      ...input.attention_event_ids.filter((id) => {

        const obj = object_confidence.find((o) => o.object_id === id);

        return obj && obj.confidence_pct < CONFIDENCE_GAP_THRESHOLD;

      }),

    ]),

  ].slice(0, 8);



  const confidence_recovery_applied = input.events_created

    .filter((e) => reinforcedIds.has(e.id))

    .map((e) => `${e.id}: confidence recovered in affected area only`);



  const decision_trace_reasons = buildDecisionTraceReasons({

    gaps: continuity_gaps,

    refresh_session,

  });



  recordDecaySnapshot({

    caregiver_id: input.caregiver_id,

    continuity_confidence_pct,

    object_confidence,

    captured_at: asOf,

  });



  return {

    triggered: true,

    trigger_reasons: reasons,

    continuity_confidence_pct,

    object_confidence,

    stale_items,

    continuity_gaps,

    expected_follow_ups,

    at_risk_event_ids,

    recheck_prompts,

    refresh_session,

    family_rhythm,

    confidence_recovery_applied,

    decision_trace_reasons,

    prohibited_avoided: [...DECAY_PROHIBITED],

    reasoning_stages_completed: [...DECAY_PIPELINE_STAGES],

  };

}



function emptyDecayResult(): ContinuityDecayResult {

  return {

    triggered: false,

    trigger_reasons: [],

    continuity_confidence_pct: 0,

    object_confidence: [],

    stale_items: [],

    continuity_gaps: [],

    expected_follow_ups: [],

    at_risk_event_ids: [],

    recheck_prompts: [],

    refresh_session: null,

    family_rhythm: {

      typical_cadence_days: 7,

      update_count: 0,

      meaningful_gap: false,

      days_since_last_update: 0,

    },

    confidence_recovery_applied: [],

    decision_trace_reasons: [],

    prohibited_avoided: [...DECAY_PROHIBITED],

    reasoning_stages_completed: [],

  };

}



export { CONTINUITY_DECAY_IDENTITY, DECAY_ENGINE_BOUNDARY } from "./contract-constants";


