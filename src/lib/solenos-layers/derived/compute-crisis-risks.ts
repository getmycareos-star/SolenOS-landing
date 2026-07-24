import type { BeliefItem } from "../types";
import type { Demand } from "../../demand-engine/types";
import type { CaregiverLoadState } from "../../caregiver-load-index/types";
import {
  computeRiskOverTime,
  type TimeCurveType,
} from "../../time-weighting";

export type CrisisCategory = "medical" | "caregiver" | "family" | "financial";

export type CrisisRisk = {
  situationId: string;
  probability: number;
  /** Hours until failure becomes likely critical. */
  estimatedTimeToFailure: number;
  contributingFactors: string[];
  explanation: string;
  category: CrisisCategory;
};

export type ComputeCrisisRisksInputs = {
  demands: readonly Demand[];
  activeSituations: readonly {
    id: string;
    title: string;
    priority?: string;
    status: string;
  }[];
  beliefs: readonly BeliefItem[];
  caregiverLoadState: CaregiverLoadState;
  caregiverLoadScore?: number;
  emotionalBurnoutProbability?: number;
  openConflictCount?: number;
  conflictLoadContribution?: number;
};

const MEDICAL_KEYWORDS =
  /\b(medication|meds?|refill|prescription|dose|dosage|pharmacy|appointment|doctor|nurse|insulin|blood\s*pressure)\b/i;
const FINANCIAL_KEYWORDS =
  /\b(bill|payment|insurance|premium|copay|invoice|financial|budget|medicare|medicaid)\b/i;
const FAMILY_KEYWORDS =
  /\b(conflict|disagree|argument|family\s*meeting|sibling|spouse|relative)\b/i;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function classifyDemandCategory(
  demand: Demand,
  situationTitle: string,
): CrisisCategory | null {
  if (demand.category === "medical") return "medical";
  if (demand.category === "financial") return "financial";
  if (demand.category === "family_conflict") return "family";

  const text = `${demand.title} ${demand.description} ${situationTitle}`;
  if (MEDICAL_KEYWORDS.test(text)) return "medical";
  if (FINANCIAL_KEYWORDS.test(text)) return "financial";
  if (FAMILY_KEYWORDS.test(text)) return "family";
  return null;
}

function hoursUntilDue(dueDate?: string): number | undefined {
  if (!dueDate) return undefined;
  const ms = new Date(dueDate).getTime() - Date.now();
  if (!Number.isFinite(ms)) return undefined;
  return Math.max(0, ms / (1000 * 60 * 60));
}

function curveForCategory(category: CrisisCategory): TimeCurveType {
  switch (category) {
    case "medical":
      return "MEDICATION_DEPENDENT";
    case "financial":
      return "CHRONIC_CARE";
    case "family":
      return "SOCIAL_COORDINATION";
    case "caregiver":
    default:
      return "CHRONIC_CARE";
  }
}

function buildCrisisExplanation(
  category: CrisisCategory,
  demandTitle: string,
  hours: number,
  probability: number,
): string {
  const timePhrase =
    hours <= 6
      ? "within a few hours"
      : hours <= 24
        ? "within 24 hours"
        : hours <= 48
          ? "within 48 hours"
          : hours <= 72
            ? "within the next few days"
            : "if left unaddressed";

  switch (category) {
    case "medical":
      return `${demandTitle} could become critical ${timePhrase} even when current priority is not highest.`;
    case "caregiver":
      return `Caregiver overload may lead to missed care ${timePhrase} — what you shared about load is held.`;
    case "family":
      return `Unresolved family tension around "${demandTitle}" may escalate ${timePhrase}.`;
    case "financial":
      return `${demandTitle} delay could create coverage or payment problems ${timePhrase}.`;
    default:
      return `${demandTitle} may worsen ${timePhrase} if not addressed.`;
  }
}

function evaluateDemandCrisis(
  demand: Demand,
  situationTitle: string,
  beliefs: readonly BeliefItem[],
): CrisisRisk | null {
  if (demand.status === "completed" || demand.status === "cancelled") return null;

  const category = classifyDemandCategory(demand, situationTitle);
  if (!category) return null;

  const hours = hoursUntilDue(demand.dueDate);
  const curveType = curveForCategory(category);
  const baseRisk = demand.riskImpact / 100;

  const riskOverTime = computeRiskOverTime({
    baseRisk: Math.max(0.25, baseRisk),
    curveType,
    hoursUntilDeadline: hours,
    pressureHours: hours !== undefined ? Math.max(0, 72 - hours) : undefined,
  });

  const sitBeliefs = beliefs.filter((b) => b.situationId === demand.situationId);
  const uncertaintyBoost =
    sitBeliefs.filter((b) => b.status === "active").reduce((acc, b) => acc + (1 - b.confidence), 0) /
    Math.max(1, sitBeliefs.length);

  let probability = clamp01(
    riskOverTime.riskOverTime * 0.55 +
      (demand.pressureScore / 100) * 0.25 +
      uncertaintyBoost * 0.2,
  );

  // Predictive: surface medium-priority medical risks before they become urgent.
  if (category === "medical" && demand.pressureScore < 70 && probability < 0.35) {
    probability = clamp01(probability + 0.15);
  }

  if (probability < 0.2) return null;

  const estimatedTimeToFailure =
    hours !== undefined
      ? hours
      : riskOverTime.thresholds.criticalThresholdTime ?? 48;

  const factors: string[] = [];
  if (demand.uncertainty >= 50) factors.push("missing medication or appointment details");
  if (hours !== undefined && hours <= 48) factors.push("time window narrowing");
  if (demand.emotionalLoad >= 60) factors.push("high emotional load on this task");

  return {
    situationId: demand.situationId,
    probability,
    estimatedTimeToFailure,
    contributingFactors: factors.length > 0 ? factors : ["ongoing care dependency"],
    explanation: buildCrisisExplanation(
      category,
      demand.title,
      estimatedTimeToFailure,
      probability,
    ),
    category,
  };
}

function evaluateCaregiverBurnoutCrisis(
  inputs: ComputeCrisisRisksInputs,
): CrisisRisk | null {
  if (inputs.caregiverLoadState !== "HIGH" && inputs.caregiverLoadState !== "CRITICAL") {
    return null;
  }

  const burnout = inputs.emotionalBurnoutProbability ?? 0;
  const loadScore = inputs.caregiverLoadScore ?? 0;
  const probability = clamp01(
    burnout * 0.5 +
      (inputs.caregiverLoadState === "CRITICAL" ? 0.35 : 0.2) +
      (loadScore / 100) * 0.15,
  );

  if (probability < 0.25) return null;

  const situationId = inputs.activeSituations[0]?.id ?? "caregiver-load";
  const hours = inputs.caregiverLoadState === "CRITICAL" ? 12 : 36;

  return {
    situationId,
    probability,
    estimatedTimeToFailure: hours,
    contributingFactors: [
      `caregiver load ${inputs.caregiverLoadState}`,
      ...(burnout >= 0.4 ? ["burnout probability elevated"] : []),
    ],
    explanation: `Caregiver overload may cause missed care within ${hours <= 24 ? "24 hours" : "the next day or two"} even when individual tasks look manageable.`,
    category: "caregiver",
  };
}

function evaluateFamilyConflictCrisis(
  inputs: ComputeCrisisRisksInputs,
): CrisisRisk | null {
  const openConflicts = inputs.openConflictCount ?? 0;
  if (openConflicts === 0) return null;

  const probability = clamp01(
    0.2 + openConflicts * 0.12 + (inputs.conflictLoadContribution ?? 0) * 0.1,
  );
  if (probability < 0.22) return null;

  const situationId =
    inputs.activeSituations.find((s) => FAMILY_KEYWORDS.test(s.title))?.id ??
    inputs.activeSituations[0]?.id ??
    "family-conflict";

  return {
    situationId,
    probability,
    estimatedTimeToFailure: 72,
    contributingFactors: ["unresolved ownership or family disagreement"],
    explanation:
      "Unresolved family or ownership conflicts may block care decisions within the next few days.",
    category: "family",
  };
}

/**
 * DERIVED — predictive crisis risks (what becomes dangerous LATER).
 * Priority = NOW; Crisis Prevention = LATER failure probability.
 */
export function computeCrisisRisks(inputs: ComputeCrisisRisksInputs): readonly CrisisRisk[] {
  const risks: CrisisRisk[] = [];
  const situationTitleById = new Map(
    inputs.activeSituations.map((s) => [s.id, s.title]),
  );

  for (const demand of inputs.demands) {
    const title = situationTitleById.get(demand.situationId) ?? "";
    const risk = evaluateDemandCrisis(demand, title, inputs.beliefs);
    if (risk) risks.push(risk);
  }

  const caregiverRisk = evaluateCaregiverBurnoutCrisis(inputs);
  if (caregiverRisk) risks.push(caregiverRisk);

  const familyRisk = evaluateFamilyConflictCrisis(inputs);
  if (familyRisk) risks.push(familyRisk);

  return risks
    .sort((a, b) => b.probability - a.probability || a.estimatedTimeToFailure - b.estimatedTimeToFailure)
    .slice(0, 5);
}
