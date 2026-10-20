import type { SolenOSResponse } from "../output-contract";
import type { SolenOSRiskLevel } from "../output-contract";
import type { Demand } from "../demand-engine/types";
import type { CaregiverLoadState } from "../caregiver-load-index/types";
import { formatActionWithOwner } from "../responsibility-graph/enrich";
import type {
  DecisionCard,
  DecisionRiskLevel,
  DecisionSurfaceDemand,
} from "./types";

function mapRiskLevel(level: SolenOSRiskLevel): DecisionRiskLevel {
  switch (level) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    default:
      return "MEDIUM";
  }
}

/** Split multi-line / checklist strings into discrete items. */
export function splitOperationalLines(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\[\s*\]\s*/, "").replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const parts = text
    .split(/;\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : text.trim() ? [text.trim()] : [];
}

export function toDecisionSurfaceDemand(
  d: Demand & { ownerName?: string | null },
): DecisionSurfaceDemand {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    pressureScore: d.pressureScore,
    status: d.status,
    situationId: d.situationId,
    ownerName: d.ownerName ?? null,
  };
}

export type MapDecisionCardParams = {
  situationId: string;
  response: SolenOSResponse;
  unresolvedQuestions?: string[];
  whatSolenOSNeedsNext?: string[];
  /** CLI-constrained highest-pressure demands (typically 1–4). */
  topDemands?: readonly (Demand & { ownerName?: string | null })[];
  caregiverLoadState?: CaregiverLoadState;
  caregiverLoadScore?: number;
  /** Titles deferred by load — appended into whatCanWait when present. */
  deferredDemandTitles?: readonly string[];
  owner?: string | null;
  ownershipState?: DecisionCard["ownershipState"];
  explanation?: DecisionCard["explanation"];
  reversibility?: DecisionCard["reversibility"];
  humanTrustEmotionalReadabilityApplied?: boolean;
  recommendationLoadMetadata?: DecisionCard["recommendationLoadMetadata"];
  cognitiveFatigueLevel?: DecisionCard["cognitiveFatigueLevel"];
  caregiverProtectionMode?: boolean;
  confidenceExplanation?: string;
  crisisWarnings?: readonly string[];
  delegationSuggestions?: DecisionCard["delegationSuggestions"];
  emotionalValidation?: DecisionCard["emotionalValidation"];
  containmentMode?: boolean;
  whatNotToDoToday?: readonly string[];
  loadFirstMode?: boolean;
  burdenSummary?: string;
  primaryContributors?: readonly string[];
  cognitiveLoadScore?: number;
  dependencyLoadScore?: number;
  burnoutTrend?: "stable" | "rising" | "critical";
  interactionLoadFlags?: DecisionCard["interactionLoadFlags"];
  sleepProtectionMode?: boolean;
  outputStrategy?: DecisionCard["outputStrategy"];
  boundaryViolationIndex?: number;
  interactionLoadInsight?: string;
  attentionPriority?: DecisionCard["attentionPriority"];
  attentionLabel?: string;
  attentionClass?: DecisionCard["attentionClass"];
  burnoutTier?: DecisionCard["burnoutTier"];
};

/**
 * Map strict 5-field SolenOSResponse → DecisionCard.
 * When topDemands provided, whatMattersNow / nextBestAction prefer demand framing.
 * Owner from Responsibility Graph is displayed and woven into nextBestAction.
 */
export function mapSolenOSToDecisionCard(params: MapDecisionCardParams): DecisionCard {
  const {
    situationId,
    response,
    unresolvedQuestions,
    whatSolenOSNeedsNext,
    topDemands,
    caregiverLoadState,
    caregiverLoadScore,
    deferredDemandTitles,
    owner,
    ownershipState,
    explanation,
    reversibility,
    humanTrustEmotionalReadabilityApplied,
    recommendationLoadMetadata,
    cognitiveFatigueLevel,
    caregiverProtectionMode,
    confidenceExplanation,
    crisisWarnings,
    delegationSuggestions,
    emotionalValidation,
    containmentMode,
    whatNotToDoToday,
    loadFirstMode,
    burdenSummary,
    primaryContributors,
    cognitiveLoadScore,
    dependencyLoadScore,
    burnoutTrend,
    interactionLoadFlags,
    sleepProtectionMode,
    outputStrategy,
    boundaryViolationIndex,
    interactionLoadInsight,
    attentionPriority,
    attentionLabel,
    attentionClass,
    burnoutTier,
  } = params;
  const derivedQuestions =
    unresolvedQuestions && unresolvedQuestions.length > 0
      ? unresolvedQuestions
      : splitOperationalLines(response.what_to_ask_next).filter((q) => q.includes("?"));

  const surfaceDemands = topDemands?.map(toDecisionSurfaceDemand) ?? [];
  const primary = surfaceDemands[0];
  const resolvedOwner =
    owner ?? primary?.ownerName ?? null;
  const resolvedOwnershipState =
    ownershipState ?? (resolvedOwner ? "assigned" : primary ? "unassigned" : null);

  const rawAction = primary ? primary.description : response.what_to_ask_next;
  const nextBestAction = formatActionWithOwner(resolvedOwner, rawAction);

  const whatCanWait = [
    ...splitOperationalLines(response.what_can_wait),
    ...(deferredDemandTitles ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const resolvedWhatIsHappening =
    loadFirstMode && burdenSummary?.trim()
      ? burdenSummary.trim()
      : response.what_is_happening;

  const resolvedWhatMattersNow =
    attentionLabel && attentionPriority
      ? [
          `${attentionPriority === "Now" ? "Now" : attentionPriority === "Watch" ? "Watch" : "Later"}: ${attentionLabel}`,
          loadFirstMode && burdenSummary?.trim()
            ? burdenSummary.trim()
            : null,
          primaryContributors && primaryContributors.length > 0
            ? `Held from what you shared: ${primaryContributors.join("; ")}.`
            : null,
          primary
            ? `${primary.title} — one step only when ready`
            : response.what_matters_now,
        ]
          .filter(Boolean)
          .join(" ")
      : loadFirstMode && burdenSummary?.trim()
      ? [
          burdenSummary.trim(),
          primaryContributors && primaryContributors.length > 0
            ? `Held from what you shared: ${primaryContributors.join("; ")}.`
            : null,
          primary
            ? `${primary.title} — one step only when ready`
            : response.what_matters_now,
        ]
          .filter(Boolean)
          .join(" ")
      : primary
        ? primary.title
        : response.what_matters_now;

  return {
    situationId,
    whatIsHappening: resolvedWhatIsHappening,
    whatMattersNow: resolvedWhatMattersNow,
    nextBestAction,
    riskLevel: mapRiskLevel(response.risk_level),
    unresolvedQuestions: derivedQuestions,
    whatCanWait,
    whatSolenOSNeedsNext: whatSolenOSNeedsNext?.length
      ? whatSolenOSNeedsNext
      : derivedQuestions.slice(0, 3),
    topDemands: surfaceDemands.length > 0 ? surfaceDemands : undefined,
    caregiverLoadState,
    caregiverLoadScore,
    owner: resolvedOwner,
    ownershipState: resolvedOwnershipState,
    explanation,
    reversibility,
    humanTrustEmotionalReadabilityApplied,
    recommendationLoadMetadata,
    cognitiveFatigueLevel,
    caregiverProtectionMode,
    confidenceExplanation,
    crisisWarnings,
    delegationSuggestions,
    emotionalValidation,
    containmentMode,
    whatNotToDoToday,
    loadFirstMode,
    burdenSummary,
    primaryContributors: primaryContributors ? [...primaryContributors] : undefined,
    cognitiveLoadScore,
    dependencyLoadScore,
    burnoutTrend,
    interactionLoadFlags: interactionLoadFlags ? [...interactionLoadFlags] : undefined,
    sleepProtectionMode,
    outputStrategy,
    boundaryViolationIndex,
    interactionLoadInsight,
    attentionPriority,
    attentionLabel,
    attentionClass,
    burnoutTier,
  };
}

export { mapRiskLevel };
