/**

 * verify-clinical-profile.mts

 * Dementia is MVP default profile; architecture stays scalable to other conditions.

 */



import fs from "node:fs";

import path from "node:path";



import {

  DEFAULT_CLINICAL_PROFILE_ID,

  KNOWN_CLINICAL_PROFILE_IDS,

  CLINICAL_PROFILE_RULES,

  CLINICAL_PROFILE_FORBIDDEN,

  CAREGIVER_FACING_CLINICAL_COPY,

  resolveClinicalProfileId,

  resolveClinicalProfileFromCareContext,

  isKnownClinicalProfileId,

} from "../src/lib/clinical-profile";

import {
  caregiverAsksFromClinicalProfile,
  caregiverMattersHintFromClinicalProfile,
  caregiverCopyHasClinicalDiagnosisTheater,
} from "../src/lib/clinical-profile/caregiver-influence";

import { getClinicalUnknownsProfile } from "../src/lib/unknowns-engine";

import { CARE_CONTEXT_TYPES } from "../src/lib/care-contexts/types";

import { UNKNOWNS_AND_PROJECTION_LAYERS } from "../src/lib/solenos-layers/architecture-map";

import { CONTENT_TOPICS_SURFACE } from "../src/lib/care-context/content-topics";



function assert(cond: unknown, msg: string): asserts cond {

  if (!cond) throw new Error(msg);

}



const root = process.cwd();



console.log("=== SolenOS Clinical Profile (dementia MVP · scalable) ===\n");



assert(DEFAULT_CLINICAL_PROFILE_ID === "dementia", "default profile is dementia");

assert(KNOWN_CLINICAL_PROFILE_IDS.includes("dementia"), "dementia registered");

assert(isKnownClinicalProfileId("dementia"), "dementia is known");

assert(resolveClinicalProfileId(null) === "dementia", "null resolves to dementia");

assert(resolveClinicalProfileId("parkinsons") === "parkinsons", "future ids pass through");

assert(

  resolveClinicalProfileFromCareContext("dementia") === "dementia",

  "care_context dementia → dementia profile",

);

assert(

  resolveClinicalProfileFromCareContext("general") === "dementia",

  "care_context general → dementia MVP default",

);

assert(

  resolveClinicalProfileFromCareContext("future_condition") === "dementia",

  "future_condition falls back safely until registered",

);



const dementia = getClinicalUnknownsProfile("dementia");

assert(dementia.profile_id === "dementia", "unknowns dementia profile loads");

assert(dementia.important_observation_signals.includes("wandering"), "dementia signals include wandering");

assert(dementia.important_observation_signals.includes("confusion"), "dementia signals include confusion");



assert(CARE_CONTEXT_TYPES.includes("dementia"), "care-context supports dementia");

assert(CARE_CONTEXT_TYPES.includes("future_condition"), "care-context reserved for future");



assert(

  CLINICAL_PROFILE_RULES.includes("dementia_is_entry_market_not_product_identity"),

  "entry market rule present",

);

assert(

  CLINICAL_PROFILE_RULES.includes("care_context_maps_to_clinical_profile_id"),

  "care_context mapping rule present",

);

assert(

  CLINICAL_PROFILE_FORBIDDEN.includes("dementia_faq_chatbot"),

  "FAQ chatbot forbidden",

);

assert(

  CAREGIVER_FACING_CLINICAL_COPY.avoid.some((s) => /dementia/i.test(s)),

  "caregiver avoid list names disease education",

);



assert(

  UNKNOWNS_AND_PROJECTION_LAYERS.clinicalProfile === "src/lib/clinical-profile",

  "architecture-map points at clinical-profile",

);

assert(

  UNKNOWNS_AND_PROJECTION_LAYERS.rules.includes("default_clinical_profile_id_is_dementia"),

  "architecture-map default rule",

);



assert(CONTENT_TOPICS_SURFACE === "marketing_content_only", "content topics quarantined from product UI");



const docs = [

  "docs/architecture/CLINICAL_PROFILE.md",

  "docs/15-architecture-decisions/ADR-005-dementia-entry-market.md",

  "src/lib/clinical-profile/index.ts",

  "src/lib/clinical-profile/caregiver-influence.ts",

  "src/lib/unknowns-engine/profiles/dementia.ts",

  "src/lib/care-contexts/dementia/types.ts",

];

for (const rel of docs) {

  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);

}



const mvp = fs.readFileSync(

  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),

  "utf8",

);

assert(!/\bdementia tip\b/i.test(mvp), "caregiver workspace must not lead with dementia tips");

assert(!/\bcommon in dementia\b/i.test(mvp), "caregiver workspace must not use generic dementia copy");



{
  // Composer must be influenced by dementia unknowns profile — without diagnosis theater.
  const eatSleep =
    "Mom is not feeling well and I took her to the doctor, she has not been eating or sleeping well lately.";
  const influence = caregiverAsksFromClinicalProfile({
    eventTexts: [eatSleep],
    clinicalProfileId: "dementia",
    maxAsks: 2,
  });
  assert(
    influence.openCategories.includes("nutrition") ||
      influence.openCategories.includes("sleep"),
    `dementia profile must open nutrition/sleep for eat/sleep capture — got ${influence.openCategories.join(",")}`,
  );
  assert(influence.asks.length >= 1, "dementia profile must yield ≥1 caregiver gather ask");
  assert(
    influence.asks.every((a) => /usual|alongside|changed with care|when did/i.test(a)),
    `profile asks must be gather-family — got ${influence.asks.join(" | ")}`,
  );
  assert(
    influence.asks.every((a) => !/\b(?:dementia|alzheimer|diagnosis|progression)\b/i.test(a)),
    "profile asks must never diagnose or name the disease",
  );
  const matters = caregiverMattersHintFromClinicalProfile({
    openCategories: influence.openCategories,
    latestRawText: eatSleep,
  });
  assert(matters && /eating|overnight rest/i.test(matters), `matters hint should reflect eat/sleep — got ${matters}`);
  assert(
    !caregiverCopyHasClinicalDiagnosisTheater(matters ?? ""),
    "matters hint must not be diagnosis theater",
  );
  console.log("✓ dementia profile influences caregiver asks + matters (no diagnosis)");
}



const principles = fs.readFileSync(path.join(root, "PRODUCT_PRINCIPLES.md"), "utf8");

assert(/Dementia entry/i.test(principles), "PRODUCT_PRINCIPLES documents dementia entry");

assert(/scalable clinical profiles/i.test(principles), "PRODUCT_PRINCIPLES documents scalability");



console.log("✓ default profile = dementia");

console.log("✓ care_context → clinical_profile_id resolver");

console.log("✓ unknowns dementia profile loaded");

console.log("✓ caregiver MVP has no disease-FAQ framing");

console.log("✓ content topics marked marketing-only");

console.log("✓ docs + architecture-map aligned");

console.log("\n=== Clinical Profile: all checks passed ===\n");


