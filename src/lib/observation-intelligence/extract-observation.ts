import {
  assignSeverity,
  detectIntensityWords,
  detectSafetyRisk,
  detectUnsupervisedContext,
  extractFrequency,
  type SeverityContext,
} from "./assign-severity";
import {
  categoryForSignal,
  type ObservationCategory,
  type ObservationSignal,
  type StructuredObservation,
} from "./ontology";

type SignalPattern = {
  signal: ObservationSignal;
  patterns: RegExp[];
};

const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    signal: "repeated_questioning",
    patterns: [
      /\basked\b.*\b(where|who|what|when|why)\b/i,
      /\bkeeps?\s+asking\b/i,
      /\brepeated(ly)?\s+ask/i,
      /\basked\b.*\btimes?\b/i,
      /\bsame\s+question\b/i,
    ],
  },
  {
    signal: "forgetting_conversations",
    patterns: [
      /\bforgot\b.*\b(conversation|talk|discussion|what we said)\b/i,
      /\bforgot\b.*\b(what|that)\b/i,
      /\bdoesn'?t\s+remember\b/i,
      /\bno\s+memory\s+of\b/i,
      /\bmemory\s+(lapse|loss|problem)/i,
    ],
  },
  {
    signal: "misplacing_objects",
    patterns: [
      /\b(misplaced|lost|can'?t find)\b.*\b(keys|wallet|phone|glasses|purse|remote)\b/i,
      /\bkeeps?\s+losing\b/i,
      /\bput\b.*\b(can'?t find|nowhere)\b/i,
    ],
  },
  {
    signal: "recognition_failure",
    patterns: [
      /\bdidn'?t\s+recognize\b/i,
      /\bnot\s+recognize\b/i,
      /\bwho\s+are\s+you\b/i,
      /\bthought\s+i\s+was\b.*\b(someone|stranger)\b/i,
    ],
  },
  {
    signal: "getting_lost",
    patterns: [/\bgot\s+lost\b/i, /\bwandered\s+off\b/i, /\bcouldn'?t\s+find\s+(his|her|their|the)\s+way\b/i],
  },
  {
    signal: "confusion_about_date",
    patterns: [
      /\bconfused\b.*\b(day|date|year)\b/i,
      /\bthought\s+it\s+was\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4})\b/i,
      /\bwrong\s+day\b/i,
    ],
  },
  {
    signal: "confusion_about_location",
    patterns: [
      /\bconfused\b.*\b(where|home|house|room)\b/i,
      /\bthought\s+(he|she|they)\s+was\b.*\b(home|hospital|hotel)\b/i,
      /\bdoesn'?t\s+know\s+where\b/i,
    ],
  },
  {
    signal: "confusion_about_time",
    patterns: [
      /\bconfused\b.*\b(time|morning|evening|night)\b/i,
      /\bthought\s+it\s+was\b.*\b(morning|evening|night|noon)\b/i,
      /\bwrong\s+time\b/i,
    ],
  },
  {
    signal: "word_finding_difficulty",
    patterns: [
      /\bcan'?t\s+find\s+(the\s+)?word/i,
      /\bword\s+finding\b/i,
      /\bstruggles?\s+to\s+name\b/i,
      /\bforgot\s+the\s+word\b/i,
    ],
  },
  {
    signal: "stopping_mid_sentence",
    patterns: [
      /\bstopped\s+mid[\s-]?sentence\b/i,
      /\btrail(s|ed)?\s+off\b/i,
      /\blost\s+(his|her|their)\s+train\s+of\s+thought\b/i,
      /\bcan'?t\s+finish\s+(a\s+)?sentence\b/i,
    ],
  },
  {
    signal: "repeating_stories",
    patterns: [
      /\brepeat(s|ed|ing)?\s+(the\s+)?same\s+stor/i,
      /\btold\s+the\s+same\s+story\b/i,
      /\bkeeps?\s+retelling\b/i,
    ],
  },
  {
    signal: "comprehension_issue",
    patterns: [
      /\bdoesn'?t\s+understand\b/i,
      /\bcan'?t\s+follow\b/i,
      /\bcomprehension\b/i,
      /\bdidn'?t\s+get\s+what\s+i\s+said\b/i,
    ],
  },
  {
    signal: "anxiety",
    patterns: [/\banxious\b/i, /\bpanic(king)?\b/i, /\bworried\s+constantly\b/i, /\bcan'?t\s+relax\b/i],
  },
  {
    signal: "depression",
    patterns: [
      /\bdepressed\b/i,
      /\bwithdrawn\b/i,
      /\bno\s+interest\b/i,
      /\bcried\s+all\s+day\b/i,
      /\bhopeless\b/i,
    ],
  },
  {
    signal: "agitation",
    patterns: [
      /\bagitated\b/i,
      /\bemotional(ly)?\s+agitat/i,
      /\brestless\b/i,
      /\bpacing\b/i,
      /\bcan'?t\s+sit\s+still\b/i,
    ],
  },
  {
    signal: "irritability",
    patterns: [/\birritable\b/i, /\bsnappy\b/i, /\bshort\s+temper\b/i, /\blashed\s+out\b/i],
  },
  {
    signal: "emotional_withdrawal",
    patterns: [
      /\bwithdrew\b/i,
      /\bemotionally\s+withdrawn\b/i,
      /\bstopped\s+engaging\b/i,
      /\bwon'?t\s+talk\b/i,
    ],
  },
  {
    signal: "wandering",
    patterns: [
      /\bwander(ed|ing|s)?\b/i,
      /\broaming\b/i,
      /\bwalked\s+outside\b/i,
      /\bleft\s+the\s+house\b/i,
      /\bwent\s+outside\b/i,
    ],
  },
  {
    signal: "impulsivity",
    patterns: [
      /\bimpulsive\b/i,
      /\bwithout\s+thinking\b/i,
      /\bsuddenly\s+decided\b/i,
      /\brash\s+decision\b/i,
    ],
  },
  {
    signal: "paranoia",
    patterns: [
      /\bparanoi[ac]\b/i,
      /\bthinks?\s+(people|we|i)\s+are\s+(stealing|plotting|against)\b/i,
      /\baccused\s+me\b/i,
      /\bsuspicious\b/i,
    ],
  },
  {
    signal: "hallucinations",
    patterns: [
      /\bhallucinat/i,
      /\bseeing\s+things\b/i,
      /\bhearing\s+voices\b/i,
      /\btalked\s+to\s+someone\s+who\s+wasn'?t\s+there\b/i,
    ],
  },
  {
    signal: "repetitive_actions",
    patterns: [
      /\brepetitive\s+action/i,
      /\bkeeps?\s+(folding|pacing|opening|closing)\b/i,
      /\bover\s+and\s+over\b/i,
      /\bcan'?t\s+stop\b.*\b(doing|repeating)\b/i,
    ],
  },
  {
    signal: "medication_errors",
    patterns: [
      /\bmedication\s+error/i,
      /\bmissed\s+(his|her|their)\s+(pill|medication|dose)\b/i,
      /\btook\s+wrong\s+(pill|medication|dose)\b/i,
      /\bdouble\s+dose\b/i,
    ],
  },
  {
    signal: "financial_errors",
    patterns: [
      /\bfinancial\s+error/i,
      /\boverpaid\b/i,
      /\bwrong\s+amount\b/i,
      /\bscam(med)?\b/i,
      /\bgave\s+away\s+money\b/i,
    ],
  },
  {
    signal: "dressing_difficulty",
    patterns: [
      /\bdressing\s+difficult/i,
      /\bcan'?t\s+dress\b/i,
      /\bput\s+on\s+wrong\b/i,
      /\bclothes\s+on\s+backwards\b/i,
    ],
  },
  {
    signal: "eating_difficulty",
    patterns: [
      /\beating\s+difficult/i,
      /\bnot\s+eating\b/i,
      /\bforgot\s+to\s+eat\b/i,
      /\bweight\s+loss\b/i,
      /\brefused\s+food\b/i,
    ],
  },
  {
    signal: "hygiene_difficulty",
    patterns: [
      /\bhygiene\s+difficult/i,
      /\bnot\s+bathing\b/i,
      /\brefused\s+to\s+shower\b/i,
      /\bbody\s+odor\b/i,
      /\bskipped\s+hygiene\b/i,
    ],
  },
];

export type ExtractionResult = {
  structured: StructuredObservation[];
  frequency?: number;
  safetyRisk: boolean;
  supervisionRequired: boolean;
};

function buildSeverityContext(text: string, signal: ObservationSignal): SeverityContext {
  const frequency = extractFrequency(text);
  const safetyRisk = detectSafetyRisk(text);
  const unsupervisedContext = detectUnsupervisedContext(text);
  const intensityWords = detectIntensityWords(text);

  const wanderingBoost =
    signal === "wandering" && (safetyRisk || unsupervisedContext) ? true : undefined;

  return {
    frequency,
    safetyRisk: safetyRisk || wanderingBoost,
    unsupervisedContext: unsupervisedContext || wanderingBoost,
    intensityWords,
  };
}

/**
 * Extract structured observation(s) from caregiver natural language.
 * Heuristic MVP — maps language to ontology signals, never diagnoses.
 */
export function extractObservations(rawText: string): ExtractionResult {
  const text = rawText.trim();
  if (!text) {
    return { structured: [], safetyRisk: false, supervisionRequired: false };
  }

  const matched = new Map<ObservationSignal, StructuredObservation>();
  const frequency = extractFrequency(text);
  const safetyRisk = detectSafetyRisk(text);
  const supervisionRequired =
    safetyRisk ||
    /\bwander/i.test(text) ||
    /\bunsupervised\b/i.test(text) ||
    /\b2\s*am\b/i.test(text);

  for (const { signal, patterns } of SIGNAL_PATTERNS) {
    if (patterns.some((p) => p.test(text))) {
      const category = categoryForSignal(signal);
      const severity = assignSeverity(buildSeverityContext(text, signal));
      matched.set(signal, { category, signal, severity });
    }
  }

  return {
    structured: [...matched.values()],
    frequency,
    safetyRisk,
    supervisionRequired,
  };
}

export function formatCategoryLabel(category: ObservationCategory): string {
  return category.replace(/_/g, " ");
}
