export type ResponseRiskLevel = "low" | "medium" | "high";

/**
 * Structured representation of understanding — not a chatbot template.
 * Generated after reasoning against the Living Care Record.
 */
export type ResponseIntelligenceOutput = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string | string[];
  risk_level: ResponseRiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
};

export type GoldenSoftOrientationCheck = {
  input: string;
  has_orientation: boolean;
  has_held_confirmation: boolean;
  ask_count: number;
  failures: string[];
  ok: boolean;
};
