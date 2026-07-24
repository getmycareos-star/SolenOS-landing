/**

 * Failure-first product intelligence — questions are symptoms of continuity failures.

 * Build engines that eliminate failures; search-only failures stay in content.

 */



export const CAREGIVER_FAILURE_CATEGORIES = [

  "invisible_progression",

  "no_objective_care_view",

  "memory_reconstruction_failure",

  "decision_without_longitudinal_context",

  "no_context_for_change",

  "caregiver_cognitive_overload",

  "contradictory_reports",

  "missing_information",

  "low_trust",

  "return_after_absence",

  "search_only_not_continuity",

] as const;



export type CaregiverFailureCategory = (typeof CAREGIVER_FAILURE_CATEGORIES)[number];



export type FailureEngineMapping = {

  failure: CaregiverFailureCategory;

  example_questions: readonly string[];

  product_engines: readonly string[];

  continuity_can_eliminate: boolean;

  content_only_if_true?: boolean;

};



export const FAILURE_TO_ENGINE_MAP: readonly FailureEngineMapping[] = [

  {

    failure: "invisible_progression",

    example_questions: ["Is it time for 24/7 care?", "Is my parent getting worse?"],

    product_engines: [

      "timeline_reconstruction_engine",

      "care_context_diff_engine",

      "state_of_care_summary_engine",

      "pattern_learning_engine",

    ],

    continuity_can_eliminate: true,

  },

  {

    failure: "no_objective_care_view",

    example_questions: ["Am I doing enough?"],

    product_engines: [

      "state_of_care_summary_engine",

      "care_transparency_layer",

      "caregiver_load_engine",

      "confidence_calibration_system",

    ],

    continuity_can_eliminate: true,

  },

  {

    failure: "memory_reconstruction_failure",

    example_questions: ["I can't remember what happened at the last appointment."],

    product_engines: [

      "care_event_store",

      "timeline_reconstruction_engine",

      "meeting_preparation",

    ],

    continuity_can_eliminate: true,

  },

  {

    failure: "decision_without_longitudinal_context",

    example_questions: ["Should I hire professional help?"],

    product_engines: [

      "care_context_diff_engine",

      "caregiver_load_engine",

      "state_of_care_summary_engine",

      "baseline_intelligence_engine",

    ],

    continuity_can_eliminate: true,

  },

  {

    failure: "no_context_for_change",

    example_questions: ["Is this behavior normal?"],

    product_engines: [

      "timeline_reconstruction_engine",

      "care_context_diff_engine",

      "pattern_learning_engine",

      "clarification_engine",

    ],

    continuity_can_eliminate: true,

  },

  {

    failure: "caregiver_cognitive_overload",

    example_questions: ["I'm overwhelmed."],

    product_engines: [

      "priority_resolution_system",

      "retention_engine",

      "caregiver_load_engine",

      "mvp_surface_area",

    ],

    continuity_can_eliminate: true,

  },

  {

    failure: "contradictory_reports",

    example_questions: ["Doctors disagree about the medication."],

    product_engines: ["contradiction_detection_engine", "trust_layer_engine"],

    continuity_can_eliminate: true,

  },

  {

    failure: "missing_information",

    example_questions: ["Am I missing something?"],

    product_engines: ["clarification_engine", "care_state_engine"],

    continuity_can_eliminate: true,

  },

  {

    failure: "low_trust",

    example_questions: ["Why does the system say that?"],

    product_engines: ["trust_layer_engine", "care_transparency_layer"],

    continuity_can_eliminate: true,

  },

  {

    failure: "return_after_absence",

    example_questions: ["What happened while I was away?"],

    product_engines: ["retention_engine", "care_context_diff_engine"],

    continuity_can_eliminate: true,

  },

  {

    failure: "search_only_not_continuity",

    example_questions: ["Does Medicare cover dementia care?"],

    product_engines: [],

    continuity_can_eliminate: false,

    content_only_if_true: true,

  },

] as const;



export function classifyFailureFromQuestion(raw: string): {

  failures: CaregiverFailureCategory[];

  build_engines: string[];

  continuity_product: boolean;

  content_only: boolean;

} {

  const text = raw.toLowerCase();

  const failures: CaregiverFailureCategory[] = [];

  const engines = new Set<string>();



  for (const row of FAILURE_TO_ENGINE_MAP) {

    const hit = row.example_questions.some((q) => {

      const stem = q.toLowerCase().slice(0, 18);

      return text.includes(stem.slice(0, 12));

    });

    const fuzzy =

      (row.failure === "invisible_progression" &&

        /\b(worse|24\s*\/\s*7|getting (?:worse|better)|progression)\b/i.test(text)) ||

      (row.failure === "memory_reconstruction_failure" &&

        /\b(can'?t remember|forgetting|what happened)\b/i.test(text)) ||

      (row.failure === "caregiver_cognitive_overload" &&

        /\b(overwhelm|exhaust|burnout|too much)\b/i.test(text)) ||

      (row.failure === "decision_without_longitudinal_context" &&

        /\b(should i hire|professional help|memory care)\b/i.test(text)) ||

      (row.failure === "no_context_for_change" &&

        /\b(is this normal|normal for)\b/i.test(text)) ||

      (row.failure === "no_objective_care_view" &&

        /\b(am i doing enough|doing enough)\b/i.test(text)) ||

      (row.failure === "search_only_not_continuity" &&

        /\b(medicare|medicaid|insurance cover)\b/i.test(text)) ||

      (row.failure === "missing_information" &&

        /\b(am i missing|what don'?t i know)\b/i.test(text));



    if (hit || fuzzy) {

      failures.push(row.failure);

      for (const e of row.product_engines) engines.add(e);

    }

  }



  const content_only =

    failures.length > 0 &&

    failures.every((f) => {

      const row = FAILURE_TO_ENGINE_MAP.find((r) => r.failure === f);

      return row?.continuity_can_eliminate === false;

    });



  return {

    failures: [...new Set(failures)],

    build_engines: [...engines],

    continuity_product: !content_only && engines.size > 0,

    content_only,

  };

}



export const FEATURE_FAILURE_GATE = [

  "Which caregiver failure does this solve?",

  "Does it reduce uncertainty?",

  "Does it reduce cognitive load?",

  "Does it reduce the need to reconstruct reality?",

  "Will caregivers need to ask fewer questions because of it?",

] as const;


