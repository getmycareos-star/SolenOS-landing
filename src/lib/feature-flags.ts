/**
 * Reversible release switches for features intentionally held out of the
 * caregiver-facing MVP. Keep implementation and data contracts intact.
 */
export const FEATURE_FLAGS = {
  community: true,
  professionalCommunity: false,
} as const;
