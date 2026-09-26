import type { OpenContradiction } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { InputMode } from "../input-classification";

export type ContradictionPriority = "critical" | "high" | "medium" | "low";

export type MaterializedContradiction = {
  contradiction_id: string;
  clarification_question: string;
  priority: ContradictionPriority;
  suggested_behavior_profile: InputMode;
  shared_reality_statement: string;
};

export type MaterializationResult = {
  materialized: MaterializedContradiction[];
  summary: {
    total: number;
    by_priority: Record<ContradictionPriority, number>;
  };
};

const SAFETY_FIELDS = [
  "medication",
  "mobility",
  "fall",
  "allergies",
  "vitals",
  "wound",
  "infection",
  "seizure",
  "choking",
  "aspiration",
  "pressure_injury",
  "elopement",
  "self_harm",
  "aggression",
  "dysphagia",
] as const;

function isSafetyField(field: string): boolean {
  const lowerField = field.toLowerCase();
  return SAFETY_FIELDS.some((sf) => lowerField.includes(sf));
}

function isMedicationField(field: string): boolean {
  return field.toLowerCase().includes("medication");
}

export function classifyContradictionPriority(contradiction: OpenContradiction): ContradictionPriority {
  const { affects_safety, field } = contradiction;

  if (affects_safety && isMedicationField(field)) {
    return "critical";
  }

  if (affects_safety && isSafetyField(field)) {
    return "high";
  }

  if (!affects_safety && isMedicationField(field)) {
    return "medium";
  }

  if (!affects_safety && field.toLowerCase().includes("function")) {
    return "medium";
  }

  return "low";
}

export function routeContradictionToBehaviorProfile(contradiction: OpenContradiction): InputMode {
  const priority = classifyContradictionPriority(contradiction);

  if (priority === "critical" || priority === "high") {
    return "crisis_urgent";
  }

  if (isMedicationField(contradiction.field)) {
    return "medical_document";
  }

  if (contradiction.field.toLowerCase().includes("mobility") ||
      contradiction.field.toLowerCase().includes("function")) {
    return "medical_document";
  }

  return "emotional_narrative";
}

export function buildContradictionClarificationQuestion(contradiction: OpenContradiction): string {
  const { field, shared_message, event_ids } = contradiction;

  const fieldLabel = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (event_ids.length === 2) {
    return `We have two different records for ${fieldLabel}: "${shared_message}". Could you clarify what you observed?`;
  }

  return `Two observations for ${fieldLabel} don't match: "${shared_message}". Could you help us understand what happened?`;
}

export function buildSharedRealityStatement(contradiction: OpenContradiction): string {
  const { field, both_preserved, shared_message, event_ids } = contradiction;

  const fieldLabel = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (both_preserved) {
    return `Both accounts of ${fieldLabel.toLowerCase()} are preserved: ${shared_message}.`;
  }

  return `Multiple observations for ${fieldLabel.toLowerCase()} recorded: ${shared_message}.`;
}

export function materializeContradictions(
  open_contradictions: OpenContradiction[]
): MaterializationResult {
  const materialized: MaterializedContradiction[] = open_contradictions.map((contradiction) => {
    const priority = classifyContradictionPriority(contradiction);
    const suggested_behavior_profile = routeContradictionToBehaviorProfile(contradiction);
    const clarification_question = buildContradictionClarificationQuestion(contradiction);
    const shared_reality_statement = buildSharedRealityStatement(contradiction);

    return {
      contradiction_id: contradiction.contradiction_id,
      clarification_question,
      priority,
      suggested_behavior_profile,
      shared_reality_statement,
    };
  });

  const by_priority: Record<ContradictionPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const m of materialized) {
    by_priority[m.priority] += 1;
  }

  return {
    materialized,
    summary: {
      total: materialized.length,
      by_priority,
    },
  };
}

export function getPriorityDisplayName(priority: ContradictionPriority): string {
  switch (priority) {
    case "critical":
      return "Critical — Safety & Medication";
    case "high":
      return "High — Safety Concern";
    case "medium":
      return "Medium — Clinical Attention";
    case "low":
      return "Low — Clarification Needed";
  }
}

export function sortByPriority<T extends { priority: ContradictionPriority }>(
  items: T[]
): T[] {
  const priorityOrder: Record<ContradictionPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...items].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}