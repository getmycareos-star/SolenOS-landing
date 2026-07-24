/** Care context extension layer — separate from situational care-context pipeline. */

export const CARE_CONTEXT_TYPES = ["general", "dementia", "future_condition"] as const;
export type CareContextType = (typeof CARE_CONTEXT_TYPES)[number];

/** Spec-aligned care profile extension (stored on care_recipient_profiles). */
export type CareProfileExtension = {
  id: string;
  care_context: CareContextType;
  dementia_context?: import("./dementia/types").DementiaContext | null;
};
