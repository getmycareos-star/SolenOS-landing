/**
 * Change Report Builder — composes existing care state into a structured
 * Change Report that surfaces: what changed, timeline, related history,
 * possible context, and questions worth discussing.
 *
 * Dementia Wedge Core Intelligence:
 * "Transform weeks of behavior into a decision-ready understanding."
 *
 * Integration points:
 * - detectRealityRecurrence() from care-reality-memory
 * - compareAgainstBaseline() from baseline-comparison-engine
 * - getCareRealityState() from care-reality-state
 * - summarizeCareRealityMemory() from care-reality-memory
 */

import type {
  ChangeReport,
  ChangeReportInput,
  ChangeReportTimelineItem,
  PossibleContextLink,
} from "./types";
import type { CareRealityMemoryObject } from "../care-reality-intelligence/care-reality-memory";

// ─── Domain detection helpers ────────────────────────────────────────────

const CARE_DOMAIN_PATTERNS: Array<{ domain: string; pattern: RegExp }> = [
  { domain: "cognition", pattern: /\b(?:confus|memory|forget|cognitive|recognition|aware)\b/i },
  { domain: "sleep", pattern: /\b(?:sleep|tired|fatigue|nap|rest|insomnia|awake)\b/i },
  { domain: "nutrition", pattern: /\b(?:eat|eating|appetite|food|meal|drink|swallow|weight)\b/i },
  { domain: "mobility", pattern: /\b(?:walk|mobility|fall|unsteady|balance|transfer|sit|stand)\b/i },
  { domain: "behavior", pattern: /\b(?:behavior|agitat|aggress|wander|mood|anxious|irritable)\b/i },
  { domain: "medical", pattern: /\b(?:medication|medicine|hospital|discharg|doctor|appointment|prescri)\b/i },
  { domain: "safety", pattern: /\b(?:wander|left (?:the )?(?:house|home)|leave home|stove|door|lock)\b/i },
  { domain: "communication", pattern: /\b(?:speak|talk|convers|question|repeat|understand|word)\b/i },
  { domain: "continence", pattern: /\b(?:bathroom|toilet|incontine|accident|wash|dress|hygiene)\b/i },
  { domain: "social", pattern: /\b(?:social|isolat|withdraw|friend|visit|activity|engage)\b/i },
];

function detectDomains(text: string): string[] {
  const domains: string[] = [];
  for (const d of CARE_DOMAIN_PATTERNS) {
    if (d.pattern.test(text)) domains.push(d.domain);
  }
  return [...new Set(domains)];
}

function sharedDomains(a: string[], b: string[]): string[] {
  return a.filter((d) => b.includes(d));
}

// ─── Clinician question generation ───────────────────────────────────────

const CLINICIAN_QUESTION_TEMPLATES: Record<string, string[]> = {
  cognition: [
    "Has there been a change in cognitive function that should be assessed?",
    "Are there new memory or confusion patterns that need clinical attention?",
  ],
  sleep: [
    "Is the sleep change related to the current care plan or medication?",
    "Should sleep patterns be discussed as part of the next review?",
  ],
  nutrition: [
    "Has there been a change in nutritional status or appetite?",
    "Is the eating change related to medication side effects or progression?",
  ],
  mobility: [
    "Has mobility changed in a way that requires a fall risk assessment?",
    "Does the change in mobility suggest a need for physical therapy or equipment?",
  ],
  behavior: [
    "Is the behavior change a new symptom or a response to environmental factors?",
    "Should this behavior pattern be discussed with a specialist?",
  ],
  medical: [
    "Is the timing of this change related to a recent medication adjustment?",
    "Should the current medication plan be reviewed in light of this change?",
  ],
  safety: [
    "Does this change suggest a need for a home safety assessment?",
    "Are current safety measures adequate given this change?",
  ],
};

function generateClinicianQuestions(
  domains: string[],
  isRecurring: boolean,
  hasMedicationContext: boolean,
): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();

  for (const domain of domains) {
    const templates = CLINICIAN_QUESTION_TEMPLATES[domain];
    if (!templates) continue;
    for (const tpl of templates) {
      if (!seen.has(tpl)) {
        questions.push(tpl);
        seen.add(tpl);
      }
    }
  }

  if (isRecurring) {
    questions.push("This pattern has occurred before — does the recurrence suggest a need to adjust the care approach?");
  }

  if (hasMedicationContext && !questions.some((q) => /medication/i.test(q))) {
    questions.push("Should the medication timing or dosage be reviewed?");
  }

  return questions.slice(0, 5);
}

// ─── Watch-for item generation ───────────────────────────────────────────

function generateWatchForItems(domains: string[], isRecurring: boolean): string[] {
  const items: string[] = [];

  if (domains.includes("cognition")) {
    items.push("Whether confusion or memory changes are becoming more frequent");
  }
  if (domains.includes("sleep")) {
    items.push("Whether sleep patterns continue to change or affect daytime function");
  }
  if (domains.includes("nutrition")) {
    items.push("Whether appetite or eating habits continue to change");
  }
  if (domains.includes("mobility")) {
    items.push("Whether walking or balance continues to change");
  }
  if (domains.includes("behavior")) {
    items.push("Whether the behavior pattern escalates or changes");
  }
  if (domains.includes("medical")) {
    items.push("Whether the change correlates with medication or treatment changes");
  }
  if (domains.includes("safety")) {
    items.push("Whether safety measures are still adequate");
  }

  if (isRecurring) {
    items.push("Whether this recurring pattern follows a consistent trigger or timing");
  }

  if (items.length === 0) {
    items.push("Whether the current change continues or additional changes appear");
  }

  return [...new Set(items)].slice(0, 5);
}

// ─── Decision context generation ─────────────────────────────────────────

function generateDecisionContext(domains: string[], hasCareData: boolean): string[] {
  const items: string[] = [];

  if (domains.includes("safety") || domains.includes("mobility")) {
    items.push("Consider whether the current living situation is still appropriate");
  }
  if (domains.includes("medical")) {
    items.push("Consider whether current treatments need review");
  }
  if (domains.includes("nutrition")) {
    items.push("Consider whether nutritional support is needed");
  }
  if (hasCareData && items.length === 0) {
    items.push("The current situation may need discussion with other family members or caregivers");
  }

  return items;
}

// ─── Next steps generation ────────────────────────────────────────────────

function generateNextSteps(domains: string[], hasCareData: boolean): string[] {
  const steps: string[] = [];

  if (domains.length > 0) {
    const domainList = domains.slice(0, 2).join(" and ");
    steps.push(`Continue monitoring ${domainList} changes — note when they occur and what surrounds them`);
  }
  if (hasCareData) {
    steps.push("Review the care record for similar patterns before deciding next steps");
  }
  steps.push("Share these observations with the clinician at the next appointment");

  return [...new Set(steps)].slice(0, 4);
}

// ─── Main builder ────────────────────────────────────────────────────────

/**
 * Build a Change Report from caregiver input + existing care state.
 *
 * This is the core Dementia Wedge intelligence function.
 * It transforms fragmented observations into decision-ready understanding.
 */
export function buildChangeReport(input: ChangeReportInput): ChangeReport {
  const now = new Date().toISOString();
  const crs = input.crs;
  const memory = input.memory_objects;
  const rawInput = input.raw_input.trim();

  // 1. Detect domains from the reported change
  const inputDomains = detectDomains(rawInput);

  // 2. Extract what changed from the input itself (structural patterns)
  const whatChanged: string[] = [];
  const changePatterns = [
    /\b(started|stopped|began)\s+(.+?)(?:\.|$)/gi,
    /\b(more|less|worse|better|increased|decreased)\s+(.+?)(?:\.|$)/gi,
    /\b(changed|different|not the same)\s+(.+?)(?:\.|$)/gi,
    /\b(no longer|doesn'?t|does not|won'?t)\s+(.+?)(?:\.|$)/gi,
    /\b(something\s+(?:is\s+)?(?:changed|different|wrong))\b/gi,
  ];
  for (const pat of changePatterns) {
    const matches = rawInput.matchAll(pat);
    for (const m of matches) {
      const change = m[0]?.trim().replace(/\.$/, "");
      if (change && change.length > 6 && !whatChanged.includes(change)) {
        whatChanged.push(change);
      }
    }
  }
  if (whatChanged.length === 0 && rawInput.length >= 12) {
    whatChanged.push(rawInput.slice(0, 200).replace(/\.$/, ""));
  }

  // 3. Extract baseline (what was normal before)
  const priorBaseline: string[] = [];
  if (crs?.current_understanding) {
    for (const line of crs.current_understanding) {
      if (
        /\b(?:usually|normally|typically|before|prior|used to|would)\b/i.test(line) &&
        !priorBaseline.includes(line)
      ) {
        priorBaseline.push(line);
      }
    }
  }

  // 4. Build relevant timeline
  const relevantTimeline: ChangeReportTimelineItem[] = [];
  for (const obj of memory) {
    if (obj.priority > 3) continue; // Only priority 1-3 items
    const domainMatch =
      inputDomains.length === 0 ||
      sharedDomains(inputDomains, detectDomains(obj.description)).length > 0;
    if (!domainMatch) continue;

    relevantTimeline.push({
      date: obj.last_seen_at?.slice(0, 10) ?? obj.first_seen_at?.slice(0, 10) ?? "unknown",
      description: obj.description.replace(/\.$/, ""),
      type: obj.type as "observation" | "event" | "decision",
      domain: detectDomains(obj.description).slice(0, 2).join(", "),
    });
  }
  relevantTimeline.sort((a, b) => b.date.localeCompare(a.date));
  const topTimeline = relevantTimeline.slice(0, 8);

  // 5. Find related history (same domain, previous occurrences)
  const relatedHistory: string[] = [];
  const recurrenceItems = memory.filter((m) => m.recurrence_count >= 2 && m.priority <= 3);
  for (const item of recurrenceItems) {
    const domainMatch =
      inputDomains.length === 0 ||
      sharedDomains(inputDomains, detectDomains(item.description)).length > 0;
    if (domainMatch && !relatedHistory.includes(item.description)) {
      relatedHistory.push(item.description);
    }
  }

  // 6. Detect recurrence
  const isRecurring = recurrenceItems.length > 0;
  const recurrenceCount = recurrenceItems.reduce((sum, item) => sum + item.recurrence_count, 0);

  // 7. Build possible context links (non-causal)
  const possibleContext: PossibleContextLink[] = [];

  // Link medical events to behavioral/cognitive changes
  const medicalEvents = memory.filter(
    (m) => m.type === "event" && /\b(?:medication|medicine|hospital|discharg|doctor)\b/i.test(m.description),
  );
  const symptomObservations = memory.filter(
    (m) =>
      (m.type === "observation" || m.type === "change") &&
      sharedDomains(inputDomains, detectDomains(m.description)).length > 0,
  );

  for (const med of medicalEvents.slice(0, 3)) {
    for (const obs of symptomObservations.slice(0, 3)) {
      if (med.id === obs.id) continue;
      const timeDiff =
        new Date(obs.last_seen_at).getTime() - new Date(med.last_seen_at).getTime();
      const daysDiff = Math.abs(timeDiff) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 30) {
        possibleContext.push({
          observation: obs.description.replace(/\.$/, ""),
          related_to: med.description.replace(/\.$/, ""),
          connection: "temporal_proximity",
        });
      }
    }
  }

  // Link recurring same-domain items
  if (recurrenceItems.length >= 2) {
    for (let i = 0; i < Math.min(recurrenceItems.length, 3); i++) {
      for (let j = i + 1; j < Math.min(recurrenceItems.length, 4); j++) {
        const a = recurrenceItems[i]!;
        const b = recurrenceItems[j]!;
        const da = detectDomains(a.description);
        const db = detectDomains(b.description);
        if (sharedDomains(da, db).length > 0) {
          possibleContext.push({
            observation: a.description.replace(/\.$/, ""),
            related_to: b.description.replace(/\.$/, ""),
            connection: "recurring_pattern",
          });
        }
      }
    }
  }

  // 8. Open uncertainties from CRS
  const openUncertainties = crs?.open_uncertainties ?? [];

  // 9. Generate clinician questions
  const hasMedicationContext = inputDomains.includes("medical") ||
    memory.some((m) => /\b(?:medication|medicine)\b/i.test(m.description));
  const questionsForClinician = generateClinicianQuestions(inputDomains, isRecurring, hasMedicationContext);

  // 10. Generate watch-for items
  const watchForItems = generateWatchForItems(inputDomains, isRecurring);

  // 11. Generate next steps
  const nextSteps = generateNextSteps(inputDomains, memory.length > 0);

  // 12. Generate information for other caregivers
  const infoForCaregivers: string[] = [];
  if (whatChanged.length > 0) {
    infoForCaregivers.push(`A change was noted: ${whatChanged.slice(0, 2).join("; ")}`);
  }
  if (isRecurring) {
    infoForCaregivers.push("This pattern has been observed before — context is available in the care record");
  }
  if (relevantTimeline.length > 0) {
    const latest = relevantTimeline[0];
    if (latest) {
      infoForCaregivers.push(`Last relevant observation (${latest.date}): ${latest.description}`);
    }
  }

  // 13. Generate decision context
  const decisionContext = generateDecisionContext(inputDomains, memory.length > 0);

  // 14. Determine confidence
  let confidence: "low" | "medium" | "high" = "low";
  if (whatChanged.length >= 2 && inputDomains.length >= 1 && memory.length >= 3) {
    confidence = "high";
  } else if (whatChanged.length >= 1 && inputDomains.length >= 1) {
    confidence = "medium";
  }

  return {
    reported_change: rawInput,
    care_recipient: input.care_recipient_label,
    what_changed: whatChanged.slice(0, 5),
    prior_baseline: priorBaseline.slice(0, 3),
    relevant_timeline: topTimeline,
    related_history: relatedHistory.slice(0, 5),
    is_recurring_pattern: isRecurring,
    recurrence_count: recurrenceCount,
    possible_context: possibleContext.slice(0, 5),
    open_uncertainties: openUncertainties.slice(0, 5),
    questions_for_clinician: questionsForClinician,
    what_to_watch_for: watchForItems,
    suggested_next_steps: nextSteps,
    information_for_caregivers: infoForCaregivers.slice(0, 4),
    decision_context: decisionContext.slice(0, 3),
    confidence,
    generated_at: now,
  };
}

