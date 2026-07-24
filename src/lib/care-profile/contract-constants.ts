/** Care Profile Layer — living caregiving inference identity graph. */



export const CARE_PROFILE_LAYER_IDENTITY =

  "a versioned caregiving inference identity graph that constrains reasoning weighting, prioritization, and memory influence without direct UI editing or LLM prompt decoration";



export const CARE_PROFILE_LAYER_ONE_LINE_TRUTH =

  "Care Profile modifies module weighting and urgency envelopes — it never modifies reasoning inputs, hypothesis formation, or output schema.";



export const CARE_PROFILE_LAYER_PIPELINE_POSITION =

  "CARE PROFILE LAYER — after memory/context grounding; before emotional, time horizon, and priority weighting";



export const CARE_PROFILE_LAYER_FORBIDDEN = [

  "direct UI profile editing",

  "LLM prompt decoration",

  "reasoning input modification",

  "silent profile overwrite",

  "reset on login or logout",

  "delete history silently",

] as const;



export const CARE_PROFILE_UPDATE_MODES = [

  "USER_CONFIRMED",

  "INFERRED",

  "CONFLICT_RESOLUTION",

] as const;



export const CARE_GRAPH_ROLES = [

  "primary_caregiver",

  "secondary_caregiver",

  "shared_caregiver",

  "observer",

] as const;



export const WORKLOAD_INTENSITIES = ["LOW", "MEDIUM", "HIGH"] as const;



export const TIME_SENSITIVITIES = ["morning", "night", "unpredictable"] as const;



/** Minimum confidence required for INFERRED updates. */

export const INFERENCE_CONFIDENCE_THRESHOLD = 0.7;



/** Repeated signal count before INFERRED update applies. */

export const INFERENCE_SIGNAL_REPEAT_THRESHOLD = 2;


