import type { EscalationAssessment, ObservedBehavior } from "./types";

const ESCALATION_PATTERNS: { pattern: RegExp; trigger: string; action: string }[] = [
  { pattern: /\b(hallucinat\w*|seeing\s+things)\b/i, trigger: "Hallucinations causing distress", action: "Contact healthcare professional for review" },
  { pattern: /\b(refus\w*\s+(?:food|water|drink|eat))\b/i, trigger: "Refusal of food or fluids", action: "Seek clinical guidance if intake remains low" },
  { pattern: /\b(refus\w*\s+(?:med|pill|medicine))\b/i, trigger: "Refusal of essential medication", action: "Contact prescriber or pharmacist about safe alternatives" },
  { pattern: /\b(repeated\s+fall|fell\s+again|multiple\s+fall)\b/i, trigger: "Repeated falls", action: "Request fall-risk assessment from care team" },
  { pattern: /\b(severe\s+pain|uncontrolled\s+pain)\b/i, trigger: "Severe pain reported", action: "Contact healthcare professional" },
  { pattern: /\b(infection|fever|uti)\b/i, trigger: "Suspected infection", action: "Contact healthcare professional" },
  { pattern: /\b(sudden\s+change|overnight\s+change|much\s+worse)\b/i, trigger: "Sudden behavioral change", action: "Rule out delirium or acute illness with clinician" },
  { pattern: /\b(confus\w*\s+worsen|rapidly\s+confus)\b/i, trigger: "Rapidly worsening confusion", action: "Seek urgent clinical review" },
];

export function assessEscalation(
  observed: ObservedBehavior[],
  allEventText: string[],
  behavioralChangeDetected: boolean,
): EscalationAssessment {
  const triggers: string[] = [];
  const suggested_actions: string[] = [];

  const combined = allEventText.join(" ");
  for (const rule of ESCALATION_PATTERNS) {
    if (rule.pattern.test(combined)) {
      triggers.push(rule.trigger);
      suggested_actions.push(rule.action);
    }
  }

  if (behavioralChangeDetected) {
    triggers.push("Behavioral change compared with prior continuity");
    suggested_actions.push("Investigate reversible causes before assuming progression");
  }

  if (observed.some((b) => b.behavior_id === "fall_occurred")) {
    triggers.push("Safety incident recorded");
    suggested_actions.push("Document incident and review environment safety");
  }

  const uniqueTriggers = [...new Set(triggers)];
  const uniqueActions = [...new Set(suggested_actions)];

  let risk_elevation: EscalationAssessment["risk_elevation"] = "none";
  if (uniqueTriggers.length >= 2) risk_elevation = "high";
  else if (uniqueTriggers.length === 1) risk_elevation = "medium";

  return {
    escalation_recommended: uniqueTriggers.length > 0,
    triggers: uniqueTriggers,
    suggested_actions: uniqueActions,
    risk_elevation,
  };
}
