/**
 * Dementia Moments — ranked moments where SolenOS creates unique value.
 *
 * Ranking (from the Dementia Wedge Strategy):
 *
 * Rank 1: New Behavior Change
 *   "Something is different. What is happening?"
 *   SolenOS role: Compare against baseline. Identify what changed.
 *   Surface relevant history. Create questions.
 *
 * Rank 2: Neurologist/Doctor Appointment
 *   "I don't want to forget something important."
 *   SolenOS role: Create a decision-ready care brief from accumulated observations.
 *
 * Rank 3: Hospital Discharge
 *   "What do we do now?"
 *   SolenOS role: Convert discharge information into ongoing care context.
 *
 * Rank 4: New Caregiver Starts
 *   "How do I explain everything?"
 *   SolenOS role: Generate a living care context summary.
 *
 * Rank 5: Sibling Disagreement
 *   "We are not seeing the same reality."
 *   SolenOS role: Create shared operational understanding.
 */

/**
 * The 5 dementia moments ranked by product significance.
 */
export type DementiaMomentType =
  | "new_behavior_change"       // Rank 1
  | "doctor_appointment"        // Rank 2
  | "hospital_discharge"        // Rank 3
  | "new_caregiver"             // Rank 4
  | "sibling_disagreement"      // Rank 5
  | "unknown";                  // No specific moment detected

/**
 * Confidence that a moment was detected.
 */
export type MomentConfidence = "high" | "medium" | "low";

/**
 * Result of detecting a dementia moment from input.
 */
export type DetectedMoment = {
  /** The moment type detected */
  moment: DementiaMomentType;
  /** Confidence in detection */
  confidence: MomentConfidence;
  /** The signal that triggered detection */
  trigger_signal: string;
  /** Rank of this moment (1-5, lower = more important) */
  rank: number;
  /** Human-readable label for the moment */
  label: string;
  /** What SolenOS should do in response */
  solenos_role: string;
  /** The emotion the caregiver is likely feeling */
  caregiver_emotion: string;
  /** Suggested orientation line for this moment */
  suggested_orientation: string | null;
  /** Whether the report should be generated (for Rank 1-2) */
  should_generate_report: boolean;
};

/**
 * Complete moment detection result for a single input.
 */
export type DementiaMomentResult = {
  /** All detected moments (sorted by rank) */
  detected: DetectedMoment[];
  /** The primary moment (highest rank) */
  primary: DetectedMoment | null;
  /** Whether any moment was detected */
  has_moment: boolean;
  /** Whether to generate a change report */
  should_generate_report: boolean;
};

/**
 * Configuration for each moment type.
 */
export type MomentConfig = {
  type: DementiaMomentType;
  rank: number;
  label: string;
  solenos_role: string;
  caregiver_emotion: string;
  should_generate_report: boolean;
};

/**
 * All moment configurations.
 */
export const MOMENT_CONFIGS: Record<Exclude<DementiaMomentType, "unknown">, MomentConfig> = {
  new_behavior_change: {
    type: "new_behavior_change",
    rank: 1,
    label: "New behavior change detected",
    solenos_role: "Compare against baseline. Identify what changed. Surface relevant history. Create questions.",
    caregiver_emotion: "Something is different. What is happening?",
    should_generate_report: true,
  },
  doctor_appointment: {
    type: "doctor_appointment",
    rank: 2,
    label: "Doctor appointment preparation",
    solenos_role: "Create a decision-ready care brief from accumulated observations.",
    caregiver_emotion: "I don't want to forget something important.",
    should_generate_report: true,
  },
  hospital_discharge: {
    type: "hospital_discharge",
    rank: 3,
    label: "Hospital discharge transition",
    solenos_role: "Convert discharge information into ongoing care context.",
    caregiver_emotion: "What do we do now?",
    should_generate_report: false,
  },
  new_caregiver: {
    type: "new_caregiver",
    rank: 4,
    label: "New caregiver orientation",
    solenos_role: "Generate a living care context summary.",
    caregiver_emotion: "How do I explain everything?",
    should_generate_report: false,
  },
  sibling_disagreement: {
    type: "sibling_disagreement",
    rank: 5,
    label: "Sibling or family disagreement",
    solenos_role: "Create shared operational understanding.",
    caregiver_emotion: "We are not seeing the same reality.",
    should_generate_report: false,
  },
};
