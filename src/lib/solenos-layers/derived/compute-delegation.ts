import type { Demand } from "../../demand-engine/types";
import type { CaregiverLoadState } from "../../caregiver-load-index/types";
import type {
  DemandOwnershipEval,
  Person,
  ResponsibilityLoad,
} from "../../responsibility-graph/types";

export type DelegationSuggestion = {
  task: string;
  recommendedPerson: string;
  reason: string;
  loadReductionEstimate?: number;
};

export type ComputeDelegationInputs = {
  demands: readonly Demand[];
  ownershipEvals: readonly DemandOwnershipEval[];
  persons: readonly Person[];
  loads: readonly ResponsibilityLoad[];
  caregiverLoadState: CaregiverLoadState;
  /** Primary caregiver name — typically overloaded when delegating. */
  primaryCaregiverName?: string;
  sharedCaregivers?: readonly string[];
  externalCaregivers?: readonly string[];
  /** Max suggestions when load elevated. */
  maxSuggestions?: number;
};

function personNameById(persons: readonly Person[], id: string): string | undefined {
  return persons.find((p) => p.id === id)?.name;
}

function lowestLoadDelegate(
  loads: readonly ResponsibilityLoad[],
  persons: readonly Person[],
  excludeNames: readonly string[],
): { name: string; loadScore: number } | null {
  const excludeLower = new Set(excludeNames.map((n) => n.toLowerCase()));
  const candidates = loads
    .map((l) => {
      const name = personNameById(persons, l.personId);
      if (!name || excludeLower.has(name.toLowerCase())) return null;
      return { name, loadScore: l.loadScore, overloaded: l.overloaded };
    })
    .filter((c): c is { name: string; loadScore: number; overloaded: boolean } => c !== null)
    .filter((c) => !c.overloaded)
    .sort((a, b) => a.loadScore - b.loadScore);

  if (candidates.length > 0) {
    return { name: candidates[0].name, loadScore: candidates[0].loadScore };
  }

  return null;
}

function fallbackDelegateName(inputs: ComputeDelegationInputs): string | null {
  for (const name of inputs.sharedCaregivers ?? []) {
    if (name.trim()) return name.trim();
  }
  for (const name of inputs.externalCaregivers ?? []) {
    if (name.trim()) return name.trim();
  }
  const nonPrimary = inputs.persons.find(
    (p) =>
      p.role !== "primary_caregiver" &&
      p.name.toLowerCase() !== (inputs.primaryCaregiverName ?? "").toLowerCase(),
  );
  return nonPrimary?.name ?? null;
}

/**
 * DERIVED — delegation suggestions when caregiver load is HIGH/CRITICAL.
 * MVP: suggest only — no availability forecasting or auto-reassignment.
 */
export function computeDelegationSuggestions(
  inputs: ComputeDelegationInputs,
): readonly DelegationSuggestion[] {
  if (inputs.caregiverLoadState !== "HIGH" && inputs.caregiverLoadState !== "CRITICAL") {
    return [];
  }

  const max = inputs.maxSuggestions ?? 3;
  const primary = inputs.primaryCaregiverName ?? "Primary caregiver";
  const suggestions: DelegationSuggestion[] = [];
  const seenTasks = new Set<string>();

  const delegate =
    lowestLoadDelegate(inputs.loads, inputs.persons, [primary]) ??
    (() => {
      const name = fallbackDelegateName(inputs);
      return name ? { name, loadScore: 0 } : null;
    })();

  if (!delegate) return [];

  const evalByDemand = new Map(inputs.ownershipEvals.map((e) => [e.demandId, e]));

  const candidates = [...inputs.demands]
    .filter((d) => d.status === "pending" || d.status === "in_progress")
    .filter((d) => d.pressureScore >= 45)
    .sort((a, b) => a.pressureScore - b.pressureScore);

  for (const demand of candidates) {
    if (suggestions.length >= max) break;
    if (seenTasks.has(demand.id)) continue;

    const eval_ = evalByDemand.get(demand.id);
    const isUnassigned = !eval_ || eval_.ownershipState === "unassigned";
    const ownedByPrimary =
      eval_?.ownerNames.some(
        (n) => n.toLowerCase() === primary.toLowerCase(),
      ) ?? false;
    const isBlocked = eval_?.ownershipState === "blocked";

    if (!isUnassigned && !ownedByPrimary && !isBlocked) continue;

    const loadReduction = Math.min(25, Math.round(demand.pressureScore * 0.35));
    const reason = isUnassigned
      ? `${delegate.name} has lighter load and could take this unassigned task.`
      : isBlocked
        ? `${delegate.name} may unblock this task while ownership is contested.`
        : `${delegate.name} has capacity — delegating could ease your ${inputs.caregiverLoadState.toLowerCase()} load.`;

    suggestions.push({
      task: demand.title,
      recommendedPerson: delegate.name,
      reason,
      loadReductionEstimate: loadReduction,
    });
    seenTasks.add(demand.id);
  }

  return suggestions;
}
