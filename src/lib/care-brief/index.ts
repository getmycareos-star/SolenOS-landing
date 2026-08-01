/**
 * Care Brief — living care context summary for knowledge transfer
 * and decision readiness.
 *
 * Dementia Wedge use cases:
 * - New Caregiver Starts: Knowledge transfer without verbal explanation
 * - Doctor Appointment: Decision-ready care brief
 * - Hospital Discharge: Transition intelligence
 *
 * Core principle:
 * "Caregivers do not need another place to store notes.
 *  They need help understanding what changed, why it matters,
 *  what information is important, and what decision needs to happen next."
 */

export {
  buildCareBrief,
  buildCareBriefForScenario,
} from "./build";

export type {
  CareBrief,
  CareBriefInput,
  CareBriefScenario,
  CareBriefSection,
} from "./types";

