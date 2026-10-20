/** Explicit sleep deprivation surface signals — <3-4 hours mentioned only. */
export const SLEEP_DEPRIVATION_SIGNALS = [
  /\b(?:only|just)\s+(?:1|2|3)\s+hours?\s+of\s+sleep\b/i,
  /\b(?:slept|sleep)\s+(?:only\s+)?(?:1|2|3)\s+hours?\b/i,
  /\b(?:less than|under)\s+4\s+hours?\s+(?:of\s+)?sleep\b/i,
  /\bhaven'?t\s+slept\s+(?:in\s+)?(?:days|a\s+day)\b/i,
  /\bno\s+sleep\s+(?:for|in)\s+(?:days|24\s+hours?)\b/i,
] as const;

/** Continuous caregiving load — explicit only. */
export const CONTINUOUS_CARE_LOAD_SIGNALS = [
  /\b24\s*\/\s*7\b/i,
  /\baround\s+the\s+clock\b/i,
  /\bno\s+break\b/i,
  /\bcontinuous(?:ly)?\s+car(?:ing|egiving)\b/i,
  /\bnever\s+(?:get|have)\s+a\s+break\b/i,
  /\bconstant(?:ly)?\s+(?:watching|monitoring|caregiving)\b/i,
] as const;

/** Explicit single-caregiver statements only. */
export const SINGLE_CAREGIVER_SIGNALS = [
  /\bno\s+one\s+else\s+helping\b/i,
  /\bonly\s+caregiver\b/i,
  /\bsole\s+caregiver\b/i,
  /\bi(?:'m|\s+am)\s+the\s+only\s+one\s+helping\b/i,
  /\bno\s+one\s+else\s+(?:to\s+)?help\b/i,
  /\balone\s+in\s+(?:this|caregiving|caring)\b/i,
  /\bonly\s+one\s+helping\b/i,
] as const;

/** Prolonged end-of-life presence — explicit only. */
export const END_OF_LIFE_PRESENCE_SIGNALS = [
  /\bhospice\b/i,
  /\bend[- ]of[- ]life\b/i,
  /\b(?:last|final)\s+days\b/i,
  /\bactively\s+dying\b/i,
  /\bdying\s+at\s+home\b/i,
  /\bdeath\s+vigil\b/i,
] as const;

/** Environmental dependency — emotional attachment to machines/signals or stability cues. */
export const ENVIRONMENTAL_DEPENDENCY_SIGNALS = [
  /\battached\s+to\s+(?:the\s+)?(?:monitor|machine|beep|alarm)\b/i,
  /\bcan'?t\s+leave\s+(?:the\s+)?(?:room|bedside|monitor)\b/i,
  /\bmonitor\s+beep(?:s|ing)?\b/i,
  /\brely\s+on\s+(?:the\s+)?(?:monitor|machine|alarm|vitals)\b/i,
  /\bwatching\s+(?:the\s+)?(?:monitor|vitals|numbers)\s+constantly\b/i,
  /\bneed\s+(?:the\s+)?(?:monitor|machine)\s+(?:to\s+)?(?:stay|feel)\s+(?:calm|safe|stable)\b/i,
  /\benvironmental\s+stability\b/i,
] as const;
