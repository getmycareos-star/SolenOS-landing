/** Plain-language labels for the canonical LCR epistemic states. */
export type CareInformationState =
  | "reported"
  | "observed"
  | "verified"
  | "inferred"
  | "uncertain"
  | "conflicting"
  | "missing";

const LABELS: Record<CareInformationState, string> = {
  reported: "Caregiver report",
  observed: "Direct observation",
  verified: "Verified",
  inferred: "Interpretation — not verified",
  uncertain: "Unclear",
  conflicting: "Reports differ",
  missing: "Not recorded",
};

export function careInformationLabel(state?: string | null): string {
  if (!state) return "Status not recorded";
  return LABELS[state as CareInformationState] ?? "Status not recorded";
}
