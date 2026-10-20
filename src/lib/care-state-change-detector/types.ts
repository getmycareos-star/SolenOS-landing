export type CareDomain = "sleep" | "appetite" | "mobility" | "mood" | "medication_adherence" | "communication" | "cognition" | "social" | "routine" | "safety" | "unknown";

export type ChangeClassification = "NEW" | "WORSENED" | "IMPROVED" | "RECURRING" | "PERSISTENT" | "RESOLVED" | "UNCERTAIN" | "CONFLICTING" | "STABLE";

export type DomainChange = {
  domain: CareDomain;
  classification: ChangeClassification;
  confidence: "low" | "medium" | "high";
  prior_state: string | null;
  current_state: string;
  evidence: string[];
  trajectory: "worsening" | "improving" | "stable" | "unknown";
  first_observed_at: string | null;
  last_observed_at: string;
  observation_count: number;
  contradictions?: Array<{ field: string; message: string }>;
};

export type CompoundSignal = {
  domains: string[];
  description: string;
  attention_required: boolean;
};

export type CareStateChangeReport = {
  generated_at: string;
  has_meaningful_change: boolean;
  primary_changes: DomainChange[];
  all_changes: DomainChange[];
  compound_signals: CompoundSignal[];
  attention_required: boolean;
  can_wait: boolean;
  unresolved_questions: string[];
  trajectory_summary: string;
};
