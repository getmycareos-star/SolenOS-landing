/**
 * Change Report — Dementia Wedge Core Intelligence Layer.
 *
 * "Transform weeks of behavior into a decision-ready understanding."
 *
 * The caregiver does not need another place to store notes.
 * They need help understanding:
 * - What changed?
 * - Why might it matter?
 * - What information is important?
 * - What decision needs to happen next?
 *
 * SolenOS turns fragmented care information into a clear understanding
 * that helps families act.
 */

export {
  buildChangeReport,
} from "./build";

export {
  formatClinicianBrief,
  type ClinicianBrief,
} from "./clinician-brief";

export type {
  ChangeReport,
  ChangeReportInput,
  ChangeReportTimelineItem,
  PossibleContextLink,
} from "./types";

