/**
 * SolenOS Prioritization Engine — four-dimension reasoning contract.
 * Extends (does not replace) the core 5-field SolenOS response.
 */

export const ITEM_TYPES = ["decaying", "static"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const DECAY_RATES = ["slow", "moderate", "fast"] as const;
export type DecayRate = (typeof DECAY_RATES)[number];

export const CLOCK_TYPES = ["deadline_bound", "consequence_bound"] as const;
export type ClockType = (typeof CLOCK_TYPES)[number];

export const RESOURCE_POOLS = [
  "money",
  "caregiver_time",
  "presence_with_care_recipient",
  "emotional_capacity",
  "cognitive_capacity",
] as const;
export type ResourcePool = (typeof RESOURCE_POOLS)[number];

export const ITEM_RISK_LEVELS = ["low", "medium", "high"] as const;
export type ItemRiskLevel = (typeof ITEM_RISK_LEVELS)[number];

export const ASSESSMENT_SOURCES = ["caregiver_reported", "professional_verified"] as const;
export type AssessmentSource = (typeof ASSESSMENT_SOURCES)[number];

export const RECURRENCE_TYPES = ["one_time", "annual", "seasonal", "unknown"] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export type PrioritizedItem = {
  id: string;
  description: string;
  type: ItemType;
  decay_rate: DecayRate | null;
  clock_type: ClockType | null;
  due_date: string | null;
  estimated_window: string | null;
  pool: ResourcePool[];
  risk_level: ItemRiskLevel;
  assessment_source: AssessmentSource;
  last_updated: string;
  recurrence: RecurrenceType;
  deprioritized_count: number;
  delegation_eligible: boolean;
  recheck_prompt: string | null;
  autonomy_note: string | null;
};

export type ResourceTension = {
  item_a: string;
  item_b: string;
  pool: ResourcePool;
  note: string;
};

export type RiskCascade = {
  item_a: string;
  item_b: string;
  compounding_note: string;
};

/** Extended output contract — layered alongside core SolenOSResponse. */
export type PrioritizationOutput = {
  what_is_happening: string;
  items: PrioritizedItem[];
  resource_tension: ResourceTension[];
  risk_cascade: RiskCascade[];
  what_matters_now: string;
  what_can_wait: string;
  self_neglect_flag: boolean;
  days_since_self_mention: number | null;
  self_neglect_note: string | null;
  follow_up_items: string[];
};

export type PrioritizationEngineLayerResult = {
  output: PrioritizationOutput;
  itemCount: number;
  decayingCount: number;
  staticCount: number;
};

export type PrioritizationEngineLayerPayload = PrioritizationEngineLayerResult;

export type ProcessPrioritizationEngineParams = {
  input: string;
  now?: Date;
  /** Recent caregiver submissions for self-mention tracking (oldest first). */
  recentSubmissionTexts?: readonly string[];
  /** Days without self-mention before flagging — default 5. */
  selfMentionWindowDays?: number;
  /** Unified load scores from Caregiver Load Engine. */
  loadScores?: {
    emotionalLoadScore?: number;
    cognitiveLoadScore?: number;
    sleepRiskScore?: number;
  };
  /** Prior deprioritization counts keyed by normalized item description. */
  deprioritizedCounts?: Readonly<Record<string, number>>;
};
