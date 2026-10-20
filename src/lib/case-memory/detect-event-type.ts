import type { CaseEventType } from "./types";

const EVENT_TYPE_PATTERNS: Array<{ type: CaseEventType; patterns: RegExp[] }> = [
  {
    type: "wandering",
    patterns: [
      /\bwander(?:ing|ed|s)?\b/i,
      /\bgot\s+lost\b/i,
      /\bnight(?:time)?\s+wandering\b/i,
      /\bwalked\s+(off|away)\b/i,
    ],
  },
  {
    type: "agitation",
    patterns: [/\bagitat(?:ed|ion)\b/i, /\brestless\b/i, /\bupset\b.*\b(night|evening)\b/i],
  },
  {
    type: "fall",
    patterns: [/\bfell\b/i, /\bfall(?:ing|s)?\b/i, /\bslip(?:ped)?\b/i],
  },
  {
    type: "sleep",
    patterns: [/\binsomnia\b/i, /\bcouldn'?t\s+sleep\b/i, /\bup\s+all\s+night\b/i, /\bsleep\s+disturb/i],
  },
  {
    type: "medication",
    patterns: [
      /\bmissed\s+(?:his|her|their|the)?\s*(?:dose|medication|meds)\b/i,
      /\bmedication\b/i,
      /\bmeds?\b/i,
      /\bpill\b/i,
    ],
  },
  {
    type: "appointment",
    patterns: [/\bappointment\b/i, /\bdoctor\s+visit\b/i, /\bclinic\b/i],
  },
  {
    type: "symptom",
    patterns: [/\bpain\b/i, /\bfever\b/i, /\bnause/i, /\bcough\b/i, /\bconfused\b/i],
  },
  {
    type: "behavior",
    patterns: [/\bbehavior\b/i, /\brefus(?:ed|ing)\b/i, /\baggressive\b/i],
  },
  {
    type: "condition_noted",
    patterns: [/\bhas\s+parkinson/i, /\bdiagnosed\b/i, /\balzheimer/i, /\bdementia\b/i],
  },
];

export function detectEventType(input: string): CaseEventType {
  for (const entry of EVENT_TYPE_PATTERNS) {
    if (entry.patterns.some((p) => p.test(input))) {
      return entry.type;
    }
  }
  return "general";
}

export function detectEventTags(input: string): string[] {
  const tags = new Set<string>();
  const lower = input.toLowerCase();
  const candidates = [
    "wandering",
    "nighttime",
    "night",
    "agitation",
    "blue towel",
    "towel",
    "grounding",
    "redirection",
    "medication",
    "sleep",
    "fall",
    "parkinson",
    "dementia",
  ];
  for (const c of candidates) {
    if (lower.includes(c)) tags.add(c.replace(/\s+/g, "_"));
  }
  if (/\bnight\b/i.test(input) || /\b2:?\d{2}\s*am\b/i.test(input)) {
    tags.add("nighttime");
  }
  return [...tags];
}
