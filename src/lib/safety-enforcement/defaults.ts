import type { SolenOSSafetyControl } from "./types";

/** Default safety control — conservative-safe baseline aligned with settings-governance defaults. */
export const DEFAULT_SAFETY_CONTROL: SolenOSSafetyControl = {
  medicalMode: "advisory_only",
  emergencySensitivity: "normal",
  externalEscalationEnabled: false,
  alwaysShowUncertainty: true,
  noCertaintyMode: false,
  riskTolerance: "LOW",
};
