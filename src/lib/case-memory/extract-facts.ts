import { detectEventTags, detectEventType } from "./detect-event-type";
import type { CaseEventType, CaseRiskLevel, ExtractedCaseFacts } from "./types";

const CONDITION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Parkinson's", pattern: /\bparkinson'?s?\b/i },
  { name: "Alzheimer's", pattern: /\balzheimer'?s?\b/i },
  { name: "Dementia", pattern: /\bdementia\b/i },
  { name: "Diabetes", pattern: /\bdiabetes\b|\bdiabetic\b/i },
  { name: "Hypertension", pattern: /\bhypertension\b|\bhigh\s+blood\s+pressure\b/i },
];

const MED_PATTERNS = [
  /\b(?:on|taking|started)\s+([A-Za-z][A-Za-z0-9-]{2,})(?:\s+(\d+\s*mg))?\b/i,
];

const PROVIDER_PATTERNS = [
  /\bdr\.?\s+([A-Z][a-z]+)/i,
  /\b(?:neurologist|cardiologist|primary\s+care|geriatrician)\b/i,
];

const FACILITY_PATTERNS = [
  /\b(?:hospital|snf|nursing\s+home|memory\s+care|clinic)\b/i,
];

const INTERVENTION_PATTERNS: Array<{
  label: string;
  technique?: string;
  pattern: RegExp;
  successCue?: RegExp;
}> = [
  {
    label: "blue towel grounding technique",
    technique: "blue towel",
    pattern: /\bblue\s+towel\b/i,
    successCue: /\b(worked|helped|stabiliz|calm(?:ed)?|success|reduced\s+agitation)\b/i,
  },
  {
    label: "redirection",
    technique: "redirection",
    pattern: /\bredirect(?:ion|ed|ing)?\b/i,
    successCue: /\b(worked|helped|calm)\b/i,
  },
  {
    label: "familiar grounding object",
    technique: "grounding object",
    pattern: /\bgrounding\s+object\b|\bfamiliar\s+(?:object|item)\b/i,
    successCue: /\b(worked|helped|calm)\b/i,
  },
];

function inferRisk(input: string, eventType: CaseEventType): CaseRiskLevel | undefined {
  if (/\b(emergency|911|unconscious|severe|fall)\b/i.test(input)) return "high";
  if (eventType === "wandering" || eventType === "fall" || eventType === "agitation") return "high";
  if (eventType === "medication" || eventType === "sleep" || eventType === "symptom") return "medium";
  if (/\bagain\b/i.test(input) && eventType !== "general") return "medium";
  return undefined;
}

/**
 * Extract structured facts from caregiver language — conditions, events, interventions.
 * Does NOT store conversation turns.
 */
export function extractFacts(input: string): ExtractedCaseFacts {
  const careRecipientHints: string[] = [];
  let relationshipHint: string | undefined;

  if (/\bdad\b|\bfather\b/i.test(input)) {
    careRecipientHints.push("Dad");
    relationshipHint = "Father";
  } else if (/\bmom\b|\bmother\b/i.test(input)) {
    careRecipientHints.push("Mom");
    relationshipHint = "Mother";
  }

  const conditions: ExtractedCaseFacts["conditions"] = [];
  for (const c of CONDITION_PATTERNS) {
    if (c.pattern.test(input) && /\b(has|have|with|diagnosed)\b/i.test(input)) {
      conditions.push({ name: c.name });
    } else if (c.pattern.test(input) && c.name === "Parkinson's") {
      // "Dad has Parkinson's" and bare mentions when paired with name cues
      if (/\bhas\b/i.test(input) || careRecipientHints.length > 0) {
        conditions.push({ name: c.name });
      }
    }
  }

  const medications: ExtractedCaseFacts["medications"] = [];
  for (const p of MED_PATTERNS) {
    const m = input.match(p);
    if (m?.[1] && !/^(the|his|her|their|and|for)$/i.test(m[1])) {
      medications.push({ name: m[1], dose: m[2] });
    }
  }

  const providers: ExtractedCaseFacts["providers"] = [];
  for (const p of PROVIDER_PATTERNS) {
    const m = input.match(p);
    if (m) {
      providers.push({
        name: m[1] ? `Dr. ${m[1]}` : m[0]!,
        role: /neurologist/i.test(input) ? "neurologist" : undefined,
      });
    }
  }

  const facilities: ExtractedCaseFacts["facilities"] = [];
  for (const p of FACILITY_PATTERNS) {
    if (p.test(input)) {
      const m = input.match(p);
      if (m?.[0]) facilities.push({ name: m[0] });
    }
  }

  const eventType = detectEventType(input);
  const tags = detectEventTags(input);
  const events: ExtractedCaseFacts["events"] = [];

  const looksLikeEvent =
    eventType !== "general" ||
    /\bagain\b/i.test(input) ||
    /\btonight\b/i.test(input) ||
    /\bhappening\b/i.test(input) ||
    tags.length > 0;

  if (looksLikeEvent && eventType !== "condition_noted") {
    events.push({
      eventType,
      summary: input.trim().slice(0, 280),
      tags,
      riskLevel: inferRisk(input, eventType),
      location: /\bhome\b/i.test(input) ? "home" : undefined,
    });
  }

  if (conditions.length > 0) {
    events.push({
      eventType: "condition_noted",
      summary: `Condition noted: ${conditions.map((c) => c.name).join(", ")}`,
      tags: conditions.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")),
      riskLevel: "low",
    });
  }

  const interventions: ExtractedCaseFacts["interventions"] = [];
  for (const entry of INTERVENTION_PATTERNS) {
    if (entry.pattern.test(input)) {
      const success = entry.successCue ? entry.successCue.test(input) : undefined;
      interventions.push({
        label: entry.label,
        technique: entry.technique,
        success,
        outcomeSummary:
          success === true
            ? `${entry.label} reduced agitation / stabilized episode`
            : success === false
              ? `${entry.label} did not resolve episode`
              : undefined,
      });
    }
  }

  return {
    careRecipientHints,
    relationshipHint,
    conditions,
    medications,
    providers,
    facilities,
    events,
    interventions,
  };
}
