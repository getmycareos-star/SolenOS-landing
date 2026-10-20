import { MATURITY_MESSAGES, MATURITY_STAGES } from "./contract-constants";
import type { CompoundingMetrics, MaturityStage, MoatStrength } from "./types";

export function deriveMaturityStage(metrics: CompoundingMetrics): MaturityStage {
  if (metrics.days_of_continuity >= 365 || metrics.total_events >= 100) return "journey";
  if (metrics.days_of_continuity >= 90 || metrics.total_events >= 30) return "established";
  if (metrics.days_of_continuity >= 14 || metrics.total_events >= 5) return "building";
  return "early";
}

export function maturityMessage(stage: MaturityStage): string {
  return MATURITY_MESSAGES[stage];
}

export function computeMoatStrength(metrics: CompoundingMetrics): MoatStrength {
  const factors: string[] = [];
  let score = 0;

  if (metrics.total_events >= 10) {
    score += 15;
    factors.push(`${metrics.total_events} structured events`);
  } else if (metrics.total_events >= 1) {
    score += metrics.total_events * 2;
    factors.push(`${metrics.total_events} event(s) captured`);
  }

  if (metrics.total_relationships >= 5) {
    score += 20;
    factors.push(`${metrics.total_relationships} linked relationships`);
  } else if (metrics.total_relationships >= 1) {
    score += metrics.total_relationships * 3;
  }

  if (metrics.correction_count >= 3) {
    score += 15;
    factors.push(`${metrics.correction_count} caregiver corrections teaching the system`);
  } else if (metrics.correction_count >= 1) {
    score += metrics.correction_count * 4;
  }

  if (metrics.resolved_uncertainty_count >= 2) {
    score += 15;
    factors.push(`${metrics.resolved_uncertainty_count} uncertainties became permanent knowledge`);
  } else if (metrics.resolved_uncertainty_count >= 1) {
    score += 10;
  }

  if (metrics.days_of_continuity >= 30) {
    score += 20;
    factors.push(`${metrics.days_of_continuity} days of continuity`);
  } else if (metrics.days_of_continuity >= 7) {
    score += 10;
    factors.push(`${metrics.days_of_continuity} days building context`);
  }

  if (metrics.linked_documents >= 2) {
    score += 10;
    factors.push(`${metrics.linked_documents} documents linked to events`);
  }

  if (metrics.total_entities >= 3) {
    score += 5;
    factors.push(`${metrics.total_entities} people, places, and organizations tracked`);
  }

  score = Math.min(100, score);

  let level: MoatStrength["level"];
  let reason: string;

  if (score >= 75) {
    level = "irreplaceable";
    reason = "Years of linked continuity cannot be recreated from documents alone.";
  } else if (score >= 50) {
    level = "strong";
    reason = "Rich relationship graph and correction history compound over time.";
  } else if (score >= 25) {
    level = "growing";
    reason = "Care context is accumulating — each interaction adds value.";
  } else {
    level = "emerging";
    reason = "Early continuity — value grows with every structured interaction.";
  }

  if (factors.length === 0) {
    factors.push("First interactions will begin compounding continuity");
  }

  return { score, level, reason, irreversibility_factors: factors };
}

export function assertMaturityStagesDefined(): boolean {
  return MATURITY_STAGES.length === 4 && Object.keys(MATURITY_MESSAGES).length === 4;
}
