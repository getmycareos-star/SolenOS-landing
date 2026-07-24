/** SolenOS Caregiver Reality Principles — architecture + copy constraint (not marketing). */

/**
 * Complements `caregiver-first-positioning` — shared burden-reduction gate, distinct reality lens.
 * @see ../caregiver-first-positioning/contract-constants.ts CAREGIVER_FIRST_IMPLEMENTATION_FILTER_QUESTION
 */
export const CAREGIVER_REALITY_CAREGIVER_FIRST_LINK =
  "Extends caregiver-first-positioning with how caregiving actually feels — same carry-less gate, not a duplicate contract.";

export const CAREGIVER_REALITY_INTERPRETATION_RULE = {
  doNotAsk: "How do we help people manage more?",
  ask: "How do we help people carry less?",
} as const;

export const CAREGIVER_REALITY_REJECTION_CRITERIA = [
  "increases responsibility",
  "increases attention demand",
  "increases monitoring",
  "increases management burden",
  "increases organization demand",
  "increases cognitive effort",
] as const;

export const CAREGIVER_REALITY_ACCEPTANCE_CRITERIA = [
  "reduces burden",
  "reduces uncertainty",
  "reduces vigilance",
  "reduces fragmentation",
  "reduces mental load",
] as const;

/** Forbidden positioning — burden is NOT remembering, organizing, or managing more. */
export const CAREGIVER_REALITY_FORBIDDEN_POSITIONING = [
  "remember more",
  "stay organized",
  "manage your care",
  "track everything",
  "productivity framing",
  "management framing",
  "care coordination as goal",
] as const;

export const CAREGIVER_REALITY_PRINCIPLES = [
  {
    id: "burden_not_remembering",
    title: "Burden is not remembering",
    not: "remember, organize, or manage more",
    is: "reducing the burden of being the permanent holder",
    oneLineTruth:
      "The weight is holding everything — not failing to remember it.",
  },
  {
    id: "continuous_vigilance",
    title: "Continuous vigilance",
    not: "implying burden is only administrative or paperwork",
    is: "always listening, anticipating, monitoring — never truly being off",
    oneLineTruth:
      "Caregiving is continuous vigilance — not a task list to finish.",
  },
  {
    id: "invisible_responsibility",
    title: "Invisible responsibility",
    not: "dramatizing or requiring explanation before recognition",
    is: "recognizing unseen, misunderstood load — feel understood before explaining",
    oneLineTruth:
      "The responsibility is real even when others don't see it.",
  },
  {
    id: "mental_fragmentation",
    title: "Mental fragmentation",
    not: "reducing volume alone while leaving domains scattered",
    is: "reducing fragmentation across medical, financial, coordination, transportation, and family at once",
    oneLineTruth:
      "Reduce fragmentation — not just the number of things to hold.",
  },
  {
    id: "crisis_anticipation",
    title: "Crisis anticipation",
    not: "prioritization theater or productivity ranking",
    is: "uncertainty reduction — something could become a problem at any moment",
    oneLineTruth:
      "what_matters_now and what_can_wait exist to reduce uncertainty — not to perform prioritization.",
  },
  {
    id: "loss_of_self",
    title: "Loss of self",
    not: "implying sacrifice or martyrdom is the goal",
    is: "holding that lives are on hold without making endurance the virtue",
    oneLineTruth: "Caring for everyone shouldn't mean losing yourself.",
  },
] as const;

export const CAREGIVER_REALITY_ONE_LINE_TRUTH =
  "Caring for everyone shouldn't mean losing yourself — carry less, not manage more.";

export const CAREGIVER_REALITY_FAILURE_MODEL =
  "SolenOS fails when design or copy increases responsibility, monitoring, organization, or cognitive effort — or frames caregivers as needing to remember, organize, or manage more.";
