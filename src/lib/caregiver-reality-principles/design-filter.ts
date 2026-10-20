/** Gate for design and copy evaluation against caregiver reality principles. */

import { matchesForbiddenCopyPattern } from "./forbidden-copy-patterns";

export interface CaregiverRealityFilterInput {
  increasesResponsibility?: boolean;
  increasesMonitoring?: boolean;
  reducesBurden?: boolean;
  reducesUncertainty?: boolean;
  reducesFragmentation?: boolean;
}

export function passesCaregiverRealityFilter(input: CaregiverRealityFilterInput): boolean {
  if (input.increasesResponsibility) return false;
  if (input.increasesMonitoring) return false;

  return Boolean(
    input.reducesBurden || input.reducesUncertainty || input.reducesFragmentation,
  );
}

/** Rejects copy that frames manage-more / remember-more burden (Principle 1). */
export function copyPassesCaregiverRealityFilter(text: string): boolean {
  return !matchesForbiddenCopyPattern(text);
}
