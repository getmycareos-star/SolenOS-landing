import type { BehaviorHypothesis, ObservedBehavior, UnmetNeed } from "./types";

const INTERPRETATION_MAP: Record<string, BehaviorHypothesis[]> = {
  repeated_questions: [
    { interpretation: "Anxiety", confidence: "high", supporting_event_ids: [], uncertainty_note: "Observable pattern — not a clinical label." },
    { interpretation: "Searching for familiarity", confidence: "high", supporting_event_ids: [], uncertainty_note: "May reflect disorientation to place or time." },
    { interpretation: "Time disorientation", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Confirm recent routine changes." },
    { interpretation: "Environmental overstimulation", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Check noise and visitor load." },
    { interpretation: "Fear", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Emotional distress may need validation first." },
  ],
  refuses_medication: [
    { interpretation: "Loss of autonomy / control", confidence: "high", supporting_event_ids: [], uncertainty_note: "Offer choices when safe." },
    { interpretation: "Side effect discomfort", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Investigate physical causes — do not assume." },
    { interpretation: "Forgot purpose of medication", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Orientation support may help." },
    { interpretation: "Fear or mistrust", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Validate before insisting." },
  ],
  agitation: [
    { interpretation: "Unmet physical need (pain, hunger, toileting)", confidence: "high", supporting_event_ids: [], uncertainty_note: "Check reversible causes first." },
    { interpretation: "Overstimulation", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Reduce noise and demands." },
    { interpretation: "Fear or confusion", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Avoid factual correction as first response." },
  ],
  wandering: [
    { interpretation: "Searching for familiar place", confidence: "high", supporting_event_ids: [], uncertainty_note: "Safety planning needed." },
    { interpretation: "Restlessness / unmet movement need", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Structured activity may help." },
    { interpretation: "Pain or discomfort driving movement", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Physical check recommended." },
  ],
  refuses_food: [
    { interpretation: "Difficulty swallowing or oral discomfort", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Professional review if persistent." },
    { interpretation: "Loss of appetite from fatigue", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Track intake over days." },
    { interpretation: "Need for autonomy at mealtimes", confidence: "high", supporting_event_ids: [], uncertainty_note: "Offer choices and unhurried setting." },
  ],
};

const DEFAULT_INTERPRETATIONS: BehaviorHypothesis[] = [
  { interpretation: "Unmet physical or emotional need", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Multiple explanations remain possible." },
  { interpretation: "Environmental mismatch", confidence: "medium", supporting_event_ids: [], uncertainty_note: "Recent routine or setting change may matter." },
  { interpretation: "Communication difficulty", confidence: "low", supporting_event_ids: [], uncertainty_note: "Behavior may be attempting to express something else." },
];

export function generateHypotheses(observed: ObservedBehavior[]): BehaviorHypothesis[] {
  const all: BehaviorHypothesis[] = [];

  for (const behavior of observed) {
    const templates = INTERPRETATION_MAP[behavior.behavior_id] ?? DEFAULT_INTERPRETATIONS;
    for (const template of templates) {
      all.push({
        ...template,
        supporting_event_ids: [behavior.source_event_id],
      });
    }
  }

  const seen = new Set<string>();
  return all.filter((h) => {
    const key = `${h.interpretation}:${h.supporting_event_ids.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deriveUnmetNeeds(hypotheses: BehaviorHypothesis[]): UnmetNeed[] {
  const needs = new Set<UnmetNeed>();

  for (const h of hypotheses) {
    const text = h.interpretation.toLowerCase();
    if (/anxiety|fear|reassur/.test(text)) needs.add("reassurance");
    if (/familiar|home|orient/.test(text)) needs.add("familiarity");
    if (/autonom|control|choice/.test(text)) needs.add("autonomy");
    if (/pain|discomfort|swallow/.test(text)) needs.add("pain_relief");
    if (/overstimul|noise/.test(text)) needs.add("reduced_stimulation");
    if (/restless|movement|boredom/.test(text)) needs.add("stimulation");
    if (/fatigue|sleep|rest/.test(text)) needs.add("rest");
    if (/orient|confus|time/.test(text)) needs.add("orientation_support");
    if (/lonely|compan/.test(text)) needs.add("companionship");
    if (/dignity|autonom/.test(text)) needs.add("dignity");
    if (/safety|wander|fall/.test(text)) needs.add("safety");
    if (/hunger|food|drink|hydrat/.test(text)) needs.add("hydration");
  }

  if (needs.size === 0) {
    needs.add("reassurance");
    needs.add("dignity");
  }

  return [...needs];
}
