import type { CognitiveLoadState, InterpretedState } from "./domain/types";

/**
 * INTERPRETED_STATE → COGNITIVE_LOAD_STATE
 * Core differentiator — measures overload drivers.
 */
export function computeLoad(interpreted: InterpretedState): CognitiveLoadState {
  const text = interpreted.signal_text;
  const raw = interpreted.interpretation.meaning;

  let complexity = 0.2;
  if (interpreted.interpretation.entities.length >= 3) complexity += 0.2;
  if (interpreted.context.medications?.length) complexity += 0.15;
  if (interpreted.context.conditions?.length) complexity += 0.1;
  if (raw.split(/[.!?]/).length > 4) complexity += 0.15;
  complexity = Math.min(complexity, 1);

  let emotional = 0.1;
  if (/\b(overwhelm|exhaust|scared|terrified|panic|guilt|can't cope)\b/i.test(text)) {
    emotional += 0.35;
  }
  if (/\b(worried|anxious|stressed|frustrated)\b/i.test(text)) emotional += 0.2;
  emotional = Math.min(emotional, 1);

  let urgency = 0.1;
  if (/\b(emergency|911|unresponsive|severe|chest pain|stroke)\b/i.test(text)) {
    urgency += 0.7;
  } else if (/\b(fell|fall|worse|declin|missed med|hospital|discharge)\b/i.test(text)) {
    urgency += 0.4;
  } else if (/\b(soon|today|tonight|now|urgent)\b/i.test(text)) urgency += 0.2;
  urgency = Math.min(urgency, 1);

  const score = Math.round(
    (complexity * 0.35 + emotional * 0.35 + urgency * 0.3) * 100,
  );

  const drivers: string[] = [];
  if (complexity >= 0.5) drivers.push("high situation complexity");
  if (emotional >= 0.5) drivers.push("elevated emotional intensity");
  if (urgency >= 0.5) drivers.push("urgency pressure");
  if (interpreted.uncertain_elements) drivers.push("unresolved ambiguity");
  if (drivers.length === 0) drivers.push("manageable load from available signals");

  let level: CognitiveLoadState["load_level"];
  if (score >= 75) level = "critical";
  else if (score >= 55) level = "high";
  else if (score >= 30) level = "medium";
  else level = "low";

  const why =
    drivers.length > 0
      ? `Load driven by: ${drivers.join(", ")}.`
      : "No significant overload drivers detected.";

  return {
    complexity_score: Math.round(complexity * 100) / 100,
    emotional_intensity_score: Math.round(emotional * 100) / 100,
    urgency_pressure_score: Math.round(urgency * 100) / 100,
    load: { score, level, drivers },
    load_level: level,
    why,
  };
}
