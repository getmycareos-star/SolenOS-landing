import { conceptFromQuery } from "./concept-patterns";
import type { ParsedMemoryQuery, ReconstructionType } from "./types";

const ONSET_PATTERNS = [
  /\bwhen did\b/i,
  /\bwhen was\b/i,
  /\bfirst (?:noted|observed|recorded|start)\b/i,
  /\bstart(?:ed)?\b/i,
  /\bbegin\b/i,
  /\bonset\b/i,
];

const PROGRESSION_PATTERNS = [
  /\bhow has\b/i,
  /\bhow have\b/i,
  /\bchanged over\b/i,
  /\bprogression\b/i,
  /\bover time\b/i,
  /\btrend\b/i,
  /\bgetting (?:worse|better)\b/i,
];

const CAUSALITY_PATTERNS = [
  /\bwhat (?:caused|led to|triggered)\b/i,
  /\bbecause of\b/i,
  /\bfollow(?:ing|ed) (?:the|a)\b/i,
  /\brelated to\b/i,
  /\bafter the\b/i,
];

const COMPARISON_PATTERNS = [
  /\bworse than\b/i,
  /\bbetter than\b/i,
  /\bcompared to\b/i,
  /\bis this (?:worse|better)\b/i,
  /\bmore than before\b/i,
];

const LAST_STATE_PATTERNS = [
  /\bmost recent\b/i,
  /\blast (?:known|status|time|recorded)\b/i,
  /\bcurrent status\b/i,
  /\bnow\b/i,
  /\brecently\b/i,
];

function detectReconstructionType(query: string): ReconstructionType {
  if (CAUSALITY_PATTERNS.some((p) => p.test(query))) return "causality";
  if (COMPARISON_PATTERNS.some((p) => p.test(query))) return "comparison";
  if (LAST_STATE_PATTERNS.some((p) => p.test(query))) return "last_known_state";
  if (PROGRESSION_PATTERNS.some((p) => p.test(query))) return "progression";
  if (ONSET_PATTERNS.some((p) => p.test(query))) return "event_onset";
  return "general_timeline";
}

function detectTemporalHint(
  query: string,
  type: ReconstructionType,
): ParsedMemoryQuery["temporal_hint"] {
  if (type === "event_onset") return "first";
  if (type === "last_known_state") return "recent";
  if (type === "progression") return "change";
  if (type === "causality") return "cause";
  if (type === "comparison") return "compare";
  return null;
}

export function parseMemoryQuery(rawQuery: string): ParsedMemoryQuery {
  const query = rawQuery.trim();
  const reconstruction_type = detectReconstructionType(query);
  const concepts = conceptFromQuery(query);

  return {
    raw_query: query,
    reconstruction_type,
    concepts,
    temporal_hint: detectTemporalHint(query, reconstruction_type),
  };
}
