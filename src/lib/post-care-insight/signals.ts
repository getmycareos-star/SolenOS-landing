/** Explicit post-care surface signals — shallow keyword match only. */
export const POST_CARE_SIGNALS = [
  /\bafter discharge\b/i,
  /\bpost[- ]discharge\b/i,
  /\bpassed away\b/i,
  /\bfuneral\b/i,
  /\bno longer caring for\b/i,
  /\bcare ended\b/i,
  /\bcare is over\b/i,
  /\bstopped caregiving\b/i,
  /\bno longer (?:my|the) caregiver\b/i,
  /\bthey(?:'re| are) gone\b/i,
  /\blost (?:my|our) (?:mom|dad|mother|father|parent|loved one)\b/i,
] as const;

/** Ongoing care surface signals — default when present and no higher-priority match. */
export const ACTIVE_CARE_SIGNALS = [
  /\bcaring for\b/i,
  /\btaking care of\b/i,
  /\bmy (?:mom|dad|mother|father|parent|husband|wife|spouse)\b/i,
  /\b(?:her|his|their) (?:medication|dose|appointment|care plan)\b/i,
  /\bhome health\b/i,
  /\bcaregiver\b/i,
  /\blive[- ]in care\b/i,
  /\bhelping (?:her|him|them) (?:with|to)\b/i,
] as const;
