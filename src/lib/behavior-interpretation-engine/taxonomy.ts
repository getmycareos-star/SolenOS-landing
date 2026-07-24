import type { BehaviorTaxonomyGroup } from "./types";

export type TaxonomyEntry = {
  id: string;
  group: BehaviorTaxonomyGroup;
  label: string;
  /** Match against CareEvent raw_input — observable signal only. */
  patterns: RegExp[];
};

export const BEHAVIOR_TAXONOMY: TaxonomyEntry[] = [
  { id: "refuses_bathing", group: "personal_care", label: "Refuses bathing", patterns: [/\b(refus\w*\s+(?:to\s+)?(?:bathe|bath|shower))\b/i, /\bwon'?t\s+(?:take\s+a\s+)?(?:bath|shower)\b/i] },
  { id: "refuses_dressing", group: "personal_care", label: "Refuses dressing", patterns: [/\b(refus\w*\s+(?:to\s+)?dress)\b/i, /\bwon'?t\s+get\s+dressed\b/i] },
  { id: "refuses_grooming", group: "personal_care", label: "Refuses grooming", patterns: [/\b(refus\w*\s+(?:to\s+)?(?:brush|groom|shav))\b/i] },
  { id: "resists_assistance", group: "personal_care", label: "Resists assistance", patterns: [/\b(resist\w*|push\w*\s+away|won'?t\s+let\s+(?:me|us)\s+help)\b/i] },
  { id: "refuses_medication", group: "medication", label: "Refuses medication", patterns: [/\b(refus\w*\s+(?:to\s+)?(?:take|swallow)\s+(?:med|pill|medicine))\b/i, /\bwon'?t\s+take\s+(?:med|pill|medicine)\b/i, /\bmedication\s+refus\w*\b/i, /\brefus\w*.*\b(?:med|pill|medicine)\b/i] },
  { id: "hides_medication", group: "medication", label: "Hides medication", patterns: [/\b(hid\w*|hid\w+\s+(?:med|pill))\b/i] },
  { id: "spits_medication", group: "medication", label: "Spits medication out", patterns: [/\b(spit\w*\s+(?:out\s+)?(?:med|pill))\b/i] },
  { id: "forgot_medication", group: "medication", label: "Forgot medication", patterns: [/\b(forgot|missed|didn'?t\s+take)\s+(?:med|pill|medicine|dose)\b/i] },
  { id: "repeated_medication", group: "medication", label: "Takes medication repeatedly", patterns: [/\b(took\s+(?:med|pill).*(?:again|twice|multiple))\b/i] },
  { id: "agitation", group: "emotional_distress", label: "Agitation", patterns: [/\b(agitat\w*|restless|pacing|yelling)\b/i] },
  { id: "anxiety", group: "emotional_distress", label: "Anxiety", patterns: [/\b(anxious|anxiety|worried|nervous)\b/i] },
  { id: "anger", group: "emotional_distress", label: "Anger", patterns: [/\b(angry|yelling|shouting|hostile)\b/i] },
  { id: "fear", group: "emotional_distress", label: "Fear", patterns: [/\b(afraid|scared|frightened|terrified)\b/i] },
  { id: "crying", group: "emotional_distress", label: "Crying", patterns: [/\b(crying|sobbing|tearful|wept)\b/i] },
  { id: "verbal_aggression", group: "emotional_distress", label: "Verbal aggression", patterns: [/\b(verbal\s+aggress|insult|name.?call)\b/i] },
  { id: "wants_to_go_home", group: "orientation", label: "Wants to go home", patterns: [/\b(want\w*\s+to\s+go\s+home|take\s+me\s+home)\b/i] },
  { id: "wandering", group: "orientation", label: "Wandering", patterns: [/\b(wander\w*|elop\w*|left\s+(?:house|home|facility))\b/i] },
  { id: "gets_lost", group: "orientation", label: "Gets lost", patterns: [/\b(get\w*\s+lost|couldn'?t\s+find\s+(?:way|room))\b/i] },
  { id: "doesnt_recognize_surroundings", group: "orientation", label: "Doesn't recognize surroundings", patterns: [/\b(doesn'?t\s+recogni\w*\s+(?:place|room|house))\b/i] },
  { id: "doesnt_recognize_people", group: "orientation", label: "Doesn't recognize people", patterns: [/\b(doesn'?t\s+recogni\w*\s+(?:me|us|family|who))\b/i] },
  { id: "time_confusion", group: "orientation", label: "Time confusion", patterns: [/\b(confus\w*\s+(?:about\s+)?time|wrong\s+(?:day|date|time))\b/i] },
  { id: "night_wandering", group: "sleep", label: "Night wandering", patterns: [/\b(night\s+wander|up\s+all\s+night|awake\s+at\s+night)\b/i] },
  { id: "frequent_waking", group: "sleep", label: "Frequent waking", patterns: [/\b(wak\w*\s+(?:often|repeatedly|multiple))\b/i] },
  { id: "sleeping_all_day", group: "sleep", label: "Sleeping all day", patterns: [/\b(sleep\w*\s+all\s+day|slept\s+through\s+day)\b/i] },
  { id: "day_night_reversal", group: "sleep", label: "Day/night reversal", patterns: [/\b(day.?night\s+revers|up\s+at\s+night.*sleep\s+day)\b/i] },
  { id: "refuses_food", group: "eating_drinking", label: "Refuses food", patterns: [/\b(refus\w*\s+(?:to\s+)?eat|won'?t\s+eat|not\s+eating)\b/i] },
  { id: "refuses_water", group: "eating_drinking", label: "Refuses water", patterns: [/\b(refus\w*\s+(?:to\s+)?drink|won'?t\s+drink|dehydrat)\b/i] },
  { id: "difficulty_swallowing", group: "eating_drinking", label: "Difficulty swallowing", patterns: [/\b(difficult\w*\s+swallow|chok\w*\s+(?:on|when))\b/i] },
  { id: "weight_loss", group: "eating_drinking", label: "Weight loss", patterns: [/\b(los\w*\s+weight|not\s+gaining|losing\s+weight)\b/i] },
  { id: "isolation", group: "withdrawal", label: "Isolation", patterns: [/\b(isolat\w*|withdraw\w*|alone\s+in\s+room)\b/i] },
  { id: "silence", group: "withdrawal", label: "Silence", patterns: [/\b(stopped\s+talking|won'?t\s+speak|silent)\b/i] },
  { id: "reduced_engagement", group: "withdrawal", label: "Reduced engagement", patterns: [/\b(no\s+interest|stopped\s+participat|won'?t\s+engage)\b/i] },
  { id: "repeated_questions", group: "communication", label: "Repeated questions", patterns: [/\b(keep\w*\s+ask\w*|ask\w*\s+(?:same|again|repeatedly))\b/i, /\bwhen\s+(?:are\s+we|do\s+we)\s+leav/i, /\brepeated\s+question/i] },
  { id: "repeated_stories", group: "communication", label: "Repeated stories", patterns: [/\b(repeat\w*\s+(?:same\s+)?stor\w*)\b/i] },
  { id: "reassurance_seeking", group: "communication", label: "Constant reassurance seeking", patterns: [/\b(reassur\w*|keep\s+ask\w*\s+if\s+(?:i'?m|we'?re)\s+ok)\b/i] },
  { id: "fall_occurred", group: "safety_incident", label: "Fall occurred", patterns: [/\b(fell|fall|on\s+the\s+floor)\b/i] },
  { id: "coordination_breakdown", group: "coordination", label: "Care coordination breakdown", patterns: [/\b(no\s+one\s+followed\s+up|agency\s+didn'?t\s+show|handoff\s+failed|family\s+disagree)\b/i] },
];

export function matchBehaviorTaxonomy(text: string): TaxonomyEntry[] {
  return BEHAVIOR_TAXONOMY.filter((entry) => entry.patterns.some((p) => p.test(text)));
}
