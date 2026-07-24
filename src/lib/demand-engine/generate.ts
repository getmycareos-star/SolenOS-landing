import { createHash } from "node:crypto";
import type { Demand, DemandCategory, DemandGenerationSeed } from "./types";
import { withPressureScore } from "./pressure";

type DemandTemplate = {
  category: DemandCategory;
  title: string;
  description: string;
  urgency: number;
  riskImpact: number;
  effort: number;
  emotionalLoad: number;
  uncertainty: number;
};

function stableDemandId(situationId: string, title: string): string {
  const h = createHash("sha256")
    .update(`${situationId}::${title}`)
    .digest("hex")
    .slice(0, 16);
  return `dem_${h}`;
}

function urgencyBoost(hint?: DemandGenerationSeed["urgencyHint"]): number {
  switch (hint) {
    case "CRITICAL":
      return 25;
    case "HIGH":
      return 15;
    case "MEDIUM":
      return 5;
    default:
      return 0;
  }
}

function pickTemplates(seed: DemandGenerationSeed): DemandTemplate[] {
  const text = `${seed.title} ${seed.summary ?? ""}`.toLowerCase();
  const templates: DemandTemplate[] = [];
  const beliefU = seed.beliefUncertainty ?? 40;

  const matches = (re: RegExp) => re.test(text);

  if (
    matches(/\b(medication|meds|prescription|refill|pharmacy|rx|dose|insulin)\b/) ||
    seed.situationType === "medical_event"
  ) {
    templates.push({
      category: "medical",
      title: "Confirm medication refill / pickup",
      description:
        "Verify prescription status and complete pharmacy pickup or refill before doses run out.",
      urgency: 70,
      riskImpact: 75,
      effort: 40,
      emotionalLoad: 35,
      uncertainty: beliefU,
    });
  }

  if (matches(/\b(discharge|hospital|admitted|admission|er\b|emergency room)\b/) ||
    seed.situationType === "emergency") {
    templates.push({
      category: "care_coordination",
      title: "Complete hospital discharge follow-through",
      description:
        "Confirm discharge instructions, follow-up appointments, and any new medications or equipment.",
      urgency: 80,
      riskImpact: 85,
      effort: 55,
      emotionalLoad: 55,
      uncertainty: Math.max(beliefU, 45),
    });
  }

  if (matches(/\b(insurance|denial|claim|coverage|prior auth|authorization)\b/) ||
    seed.situationType === "administrative") {
    templates.push({
      category: "financial",
      title: "Address insurance / benefits blocker",
      description:
        "Gather denial or coverage details and identify the next administrative step to restore access.",
      urgency: 60,
      riskImpact: 65,
      effort: 70,
      emotionalLoad: 50,
      uncertainty: Math.max(beliefU, 55),
    });
  }

  if (matches(/\b(lawyer|legal|guardianship|power of attorney|poa|conservator)\b/)) {
    templates.push({
      category: "legal",
      title: "Clarify legal / decision authority step",
      description:
        "Confirm who holds decision authority and what document or action is required next.",
      urgency: 55,
      riskImpact: 70,
      effort: 65,
      emotionalLoad: 60,
      uncertainty: Math.max(beliefU, 50),
    });
  }

  if (matches(/\b(fall|home safety|stairs|wheelchair|mobility|oxygen)\b/)) {
    templates.push({
      category: "home_safety",
      title: "Mitigate home safety risk",
      description:
        "Identify the immediate safety hazard and the single next mitigation step at home.",
      urgency: 65,
      riskImpact: 80,
      effort: 45,
      emotionalLoad: 40,
      uncertainty: beliefU,
    });
  }

  if (matches(/\b(transport|ride|drive|appointment|clinic visit)\b/)) {
    templates.push({
      category: "transportation",
      title: "Secure transportation for care activity",
      description:
        "Confirm how the care recipient will get to/from the appointment or facility.",
      urgency: 55,
      riskImpact: 50,
      effort: 50,
      emotionalLoad: 30,
      uncertainty: beliefU,
    });
  }

  if (matches(/\b(family|sibling|argue|conflict|disagree|won't help|blame)\b/)) {
    templates.push({
      category: "family_conflict",
      title: "Contain family coordination conflict",
      description:
        "Name the unresolved ownership or disagreement and choose one shared next step.",
      urgency: 50,
      riskImpact: 55,
      effort: 60,
      emotionalLoad: 80,
      uncertainty: Math.max(beliefU, 45),
    });
  }

  if (matches(/\b(monitor|vitals|check (on|in)|watch for|symptoms)\b/) ||
    seed.situationType === "follow_up" ||
    seed.situationType === "daily_routine") {
    templates.push({
      category: "monitoring",
      title: "Set clear monitoring checkpoint",
      description:
        "Define what to watch for next and when reassessment is required — not continuous vigilance.",
      urgency: 45,
      riskImpact: 50,
      effort: 35,
      emotionalLoad: 35,
      uncertainty: beliefU,
    });
  }

  // Always at least one knowledge/action demand for an active situation.
  if (templates.length === 0) {
    templates.push({
      category: seed.situationType === "uncertain_state" ? "monitoring" : "care_coordination",
      title: "Clarify next required care action",
      description:
        "Translate the active situation into one concrete next action the caregiver must take.",
      urgency: 50,
      riskImpact: 55,
      effort: 40,
      emotionalLoad: 40,
      uncertainty: Math.max(beliefU, seed.situationType === "uncertain_state" ? 70 : 45),
    });
  }

  const boost = urgencyBoost(seed.urgencyHint);
  return templates.map((t) => ({
    ...t,
    urgency: Math.min(100, t.urgency + boost),
    riskImpact: Math.min(100, t.riskImpact + (boost > 15 ? 10 : 0)),
  }));
}

/**
 * Auto-generate knowledge/action demands from a situation seed.
 * Idempotent by (situationId, title) — re-generation does not wipe completed history.
 */
export function generateDemandsFromSituation(
  seed: DemandGenerationSeed,
  nowIso = new Date().toISOString(),
): Demand[] {
  return pickTemplates(seed).map((t) =>
    withPressureScore({
      id: stableDemandId(seed.situationId, t.title),
      situationId: seed.situationId,
      title: t.title,
      description: t.description,
      category: t.category,
      status: "pending" as const,
      urgency: t.urgency,
      riskImpact: t.riskImpact,
      effort: t.effort,
      emotionalLoad: t.emotionalLoad,
      uncertainty: t.uncertainty,
      pressureScore: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
  );
}

export function generateDemandsFromSituations(
  seeds: readonly DemandGenerationSeed[],
  nowIso = new Date().toISOString(),
): Demand[] {
  return seeds.flatMap((s) => generateDemandsFromSituation(s, nowIso));
}
