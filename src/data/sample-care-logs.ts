import type { RawCareInput } from "../lib/care-snapshot";

/**
 * ILLUSTRATION / DEV FIXTURE ONLY — not production defaults.
 * SoT: docs/02-product/solenos-illustration-vs-implementation.md
 * Do not wire into caregiver UI as sample stories or prefilled reality.
 */
export const SAMPLE_CARE_LOGS_IS_ILLUSTRATION_ONLY = true as const;

/** Sample internal care logs — simulates messy, incomplete SolenOS data (fixtures only). */
export const SAMPLE_CARE_LOGS: RawCareInput[] = [
  {
    text: "Forgot morning pills Tuesday. Seemed more tired than usual.",
    recordedAt: "2026-07-09T08:30:00",
    metadata: {
      patientName: "Care recipient",
      contextLabel: "Family Care",
    },
  },
  {
    text: "Headache observed in evening. Said it was worse than yesterday.",
    recordedAt: "2026-07-10T19:00:00",
  },
  {
    text: "Wednesday - reduced appetite noted. Only ate half of lunch.\nWorried about the headache coming back.",
    recordedAt: "2026-07-11T12:00:00",
  },
  {
    text: "Headache again last night. Gave water and rested.",
    recordedAt: "2026-07-12T22:00:00",
  },
  {
    text: "Need to schedule visit with doctor next week. Feeling a bit better today.",
    recordedAt: "2026-07-13T09:00:00",
  },
];
