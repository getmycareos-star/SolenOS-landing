/** Gate for future feature evaluation against the caregiver-first positioning contract. */

export interface CaregiverFirstFeature {
  reducesCognitiveBurden: boolean;
  requiresAccountBeforeValue?: boolean;
  preservesClinicalComplexity?: boolean;
  actsAsMedicalAuthority?: boolean;
  addsWorkflowOrDashboard?: boolean;
}

export function passesCaregiverFirstFilter(feature: CaregiverFirstFeature): boolean {
  if (!feature.reducesCognitiveBurden) return false;
  if (feature.requiresAccountBeforeValue) return false;
  if (feature.preservesClinicalComplexity) return false;
  if (feature.actsAsMedicalAuthority) return false;
  if (feature.addsWorkflowOrDashboard) return false;
  return true;
}
