import type { DomainTrigger, RequiredSignal } from "./types";

export const DOMAIN_TRIGGERS: DomainTrigger[] = [
  {
    domain: "fall_injury",
    triggerPattern: /\b(fell|fall|fallen|tripped|slipped|injur\w*|hurt\s+(?:her|him|them|self))\b/i,
    requiredSignals: [
      { id: "what_happened", label: "What happened during the fall or injury", pattern: /\b(fell|tripped|slipped|hit|landed|stairs|bathroom|ground)\b/i },
      { id: "when_occurred", label: "When it occurred", pattern: /\b(today|yesterday|last night|this morning|hours? ago|minutes? ago|\d{1,2}[/-]\d|just now|earlier)\b/i },
      { id: "injury_status", label: "Current injury status", pattern: /\b(bleed|bruise|cut|bump|swell|pain|broken|fracture|head|hit|conscious|responsive|awake|okay|fine|no injury)\b/i },
      { id: "medical_attention", label: "Whether medical attention was sought or needed", pattern: /\b(er|emergency|hospital|doctor|nurse|911|ambulance|urgent care|called|went to|didn't go|no doctor)\b/i },
    ],
  },
  {
    domain: "pain",
    triggerPattern: /\b(pain|hurts|aching|sore|throbbing|dizz\w*|nausea)\b/i,
    requiredSignals: [
      { id: "pain_location", label: "Pain location or type", pattern: /\b(chest|head|stomach|back|leg|arm|hip|knee|abdominal|sharp|dull|burning)\b/i },
      { id: "pain_severity", label: "Severity or change", pattern: /\b(severe|mild|moderate|worse|better|unbearable|\d\s*\/\s*10|scale)\b/i },
      { id: "pain_onset", label: "When pain started or changed", pattern: /\b(started|began|since|for\s+\d|hours?|days?|sudden|gradual|today|yesterday)\b/i },
    ],
  },
  {
    domain: "breathing",
    triggerPattern: /\b(breath|breathing|oxygen|wheez|gasp|chok)\b/i,
    requiredSignals: [
      { id: "breathing_status", label: "Current breathing status", pattern: /\b(shortness|can't breathe|labored|shallow|normal|better|worse|oxygen|o2|saturation)\b/i },
      { id: "breathing_onset", label: "When breathing issue started", pattern: /\b(started|since|today|sudden|hours?|minutes?|just now)\b/i },
    ],
  },
  {
    domain: "confusion_behavior",
    triggerPattern: /\b(confus\w*|disorient|agitat\w*|behavior|wander|memory|not herself|not himself|acting strange)\b/i,
    requiredSignals: [
      { id: "behavior_change", label: "What changed in behavior or cognition", pattern: /\b(confus\w*|forgot|agitat\w*|restless|wander|repeat|unusual|different|worse|better)\b/i },
      { id: "behavior_onset", label: "When the change started", pattern: /\b(started|since|today|yesterday|hours?|days?|sudden|gradual|this morning|last night)\b/i },
      { id: "current_status", label: "Current status right now", pattern: /\b(now|currently|right now|at the moment|still|improved|same|calm|alert)\b/i },
    ],
  },
  {
    domain: "medication",
    triggerPattern: /\b(medication|medicine|prescription|pill|dose|mg|refill|skipped|missed dose)\b/i,
    requiredSignals: [
      { id: "medication_name", label: "Which medication is involved", pattern: /\b(medication|medicine|pill|prescription|dose|mg|insulin|blood pressure|named drug|[A-Z][a-z]+(?:il|ine|pam|ol|ide)\b)/i },
      { id: "medication_issue", label: "What the medication issue is", pattern: /\b(missed|skipped|wrong|double|refill|side effect|reaction|stopped|started|changed|dose)\b/i },
    ],
  },
  {
    domain: "eating_drinking",
    triggerPattern: /\b(eat|drink|food|fluid|appetite|refus\w*|dehydrat)\b/i,
    requiredSignals: [
      { id: "intake_status", label: "Eating or drinking status", pattern: /\b(refus\w*|won't eat|not eating|not drinking|barely|nothing|some|fluids|meals)\b/i },
      { id: "intake_duration", label: "How long intake has been affected", pattern: /\b(today|yesterday|days?|hours?|since|all day|this week)\b/i },
    ],
  },
  {
    domain: "swelling",
    triggerPattern: /\b(swell|swollen|edema|puffiness)\b/i,
    requiredSignals: [
      { id: "swelling_location", label: "Where swelling is located", pattern: /\b(leg|ankle|foot|hand|arm|face|abdomen|feet)\b/i },
      { id: "swelling_change", label: "Whether swelling is new or changing", pattern: /\b(new|worse|better|sudden|since|today|yesterday|increased)\b/i },
    ],
  },
  {
    domain: "ambiguous_concern",
    triggerPattern: /\b(something (is )?wrong|not right|off today|seems worse|concerned|worried about|doesn't seem)\b/i,
    requiredSignals: [
      { id: "what_observed", label: "What specifically seems wrong", pattern: /\b(pain|confus\w*|breath|fall|eat|drink|swell|fever|weak|tired|dizz|vomit|cough)\b/i },
      { id: "when_started", label: "When it started", pattern: /\b(started|since|today|yesterday|hours?|days?|this morning|last night)\b/i },
      { id: "current_status", label: "Current status", pattern: /\b(now|currently|right now|still|same|worse|better)\b/i },
    ],
  },
];

export function signalPresent(text: string, signal: RequiredSignal): boolean {
  return signal.pattern.test(text);
}
