import { DEMENTIA_UNKNOWNS_PROFILE } from "./dementia";
import type { ClinicalUnknownsProfile } from "../types";
import {
  DEFAULT_CLINICAL_PROFILE_ID as CLINICAL_DEFAULT,
} from "../../clinical-profile";

/** Registry — add Parkinson's, stroke, etc. without changing the engine. */
export const CLINICAL_UNKNOWNS_PROFILES: Record<string, ClinicalUnknownsProfile> = {
  dementia: DEMENTIA_UNKNOWNS_PROFILE,
};

/** Re-export single SoT — dementia is MVP default; engines stay disease-agnostic. */
export const DEFAULT_CLINICAL_PROFILE_ID = CLINICAL_DEFAULT;

export function getClinicalUnknownsProfile(
  profileId: string = DEFAULT_CLINICAL_PROFILE_ID,
): ClinicalUnknownsProfile {
  return CLINICAL_UNKNOWNS_PROFILES[profileId] ?? DEMENTIA_UNKNOWNS_PROFILE;
}

export { DEMENTIA_UNKNOWNS_PROFILE };
