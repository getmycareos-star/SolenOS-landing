/** Deterministic pattern matchers — structural only, no semantic inference. */

export const ACTION_CRITICAL_PATTERN =
  /\b(medication|medicine|dose|dosage|mg|ml|tablet|pill|prescription|discharge instruction|discharge|give her|give him|take|administer|call (?:the )?doctor|call 911|escalat|trigger|must take|need to|caregiver|monitor|watch for|if (?:she|he|they) |instruction|ordered to|do not stop|hold dose|missed (?:her|his|their|the) (?:dose|medication))\b/i;

export const MEDICAL_FACTS_PATTERN =
  /\b(diagnos|symptom|vital|lab result|lab|hospice|treatment|bp|blood pressure|heart rate|fever|pain|oxygen|saturation|spo2|wound|iv\b|fall|unresponsive|non-responsive|nonresponsive|condition|hospital|nurse|doctor said|x-ray|mri|ct scan)\b/i;

export const TIME_SENSITIVE_PATTERN =
  /\b(today|tonight|this morning|this evening|this afternoon|now|right now|yesterday|sudden(?:ly)?|urgent|deteriorat|improv(?:ing|ed)|just happened|hours ago|minutes ago|last night|earlier today)\b/i;

export const UNCERTAINTY_PATTERN =
  /\b(not sure|don't know|dont know|unclear|unsure|maybe|might be|conflict|contradict|inconsistent|\?\?|\.\.\.)\b/i;

export const POSITIVE_STATE_PATTERN = /\b(fine|okay|ok|good|well|stable|better|improving)\b/i;

export const NEGATION_PATTERN =
  /\b(not|n't|never|no longer|unresponsive|nonresponsive|non-responsive|not responding|won't|cannot|can't)\b/i;

export const EMOTIONAL_PATTERN =
  /\b(overwhelmed|terrified|scared|worried|anxious|exhausted|frustrated|stressed|crying|guilt|hopeless|panick(?:ed|ing)|can't cope|cannot cope|breaking down|i feel|i am so|i'm so)\b/i;
