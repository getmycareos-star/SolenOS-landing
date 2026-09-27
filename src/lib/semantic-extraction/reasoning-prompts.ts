/**
 * Qwen Reasoning Prompts — multi-pass synthesis, intent, trajectory,
 * contradiction resolution, baseline enrichment, uncertainty explanation.
 *
 * Each prompt targets one reasoning capability. Deterministic engines
 * validate the output; Qwen proposes.
 */

export const REASONING_SYSTEM_MESSAGE =
  "You reason about caregiver notes. You NEVER diagnose, name conditions, triage, or invent facts. Every claim must be grounded in a quote from the input. Return ONLY valid JSON, no markdown, no commentary.";

// ─── Pass 1: Caregiver Intent & Emotional State ──────────────────────────

export const INTENT_PROMPT = `Analyze the caregiver's intent and emotional state in this note.

Return ONLY valid JSON:
{
  "intent": "reporting_fact|asking_question|expressing_struggle|seeking_reassurance|questioning_system|providing_update|sharing_feeling|making_decision|unclear",
  "emotional_state": {
    "primary": "one word describing the dominant feeling",
    "secondary": "second feeling or null",
    "intensity": "low|medium|high",
    "evidence": ["verbatim quotes from the note that show this feeling"]
  },
  "trust_level": "trusting|neutral|hedging|skeptical",
  "urgency": {
    "level": "can_wait|soon|today|immediate",
    "reason": "why this urgency level, or null",
    "evidence": "verbatim quote or null"
  },
  "unspoken_needs": ["things the caregiver seems to need but didn't say directly"],
  "confusion_risk": true|false,
  "confusion_explanation": "why they might not understand, or null",
  "summary": "one sentence describing what this caregiver is really doing in this note"
}

Rules:
- "evidence" arrays must contain VERBATIM quotes from the note, not paraphrases
- unspoken_needs must be inferred from what was said, not assumed
- confusion_risk is true when the caregiver seems unsure, overwhelmed, or likely to misunderstand follow-up questions
- Never diagnose. Never invent feelings not supported by the text.`;

// ─── Pass 2: Cross-Observation Synthesis ─────────────────────────────────

export const SYNTHESIS_PROMPT = `Synthesize the full care story from these observations. Look for patterns, trends, and relationships across ALL observations — not just the latest one.

Return ONLY valid JSON:
{
  "story_arc": "one paragraph telling the story: what started, how it evolved, where it stands now",
  "domain_trajectories": [
    {
      "domain": "sleep|mobility|mood|appetite|cognition|medication_adherence|pain|social_engagement|other",
      "direction": "worsening|improving|stable|fluctuating|insufficient_data",
      "confidence": "high|medium|low",
      "evidence": ["verbatim quotes showing the trajectory"],
      "summary": "one sentence"
    }
  ],
  "inflection_points": [
    {
      "date_approximate": "date or null",
      "description": "what happened",
      "why_significant": "why this was a turning point",
      "evidence": ["verbatim quotes"]
    }
  ],
  "co_occurring_patterns": [
    {
      "domains": ["domain1", "domain2"],
      "relationship": "likely_related|independent|unclear",
      "reasoning": "why these seem related or not"
    }
  ],
  "trend_summary": "one sentence: what is the overall direction of this care situation"
}

Rules:
- Every claim must be grounded in a verbatim quote from the observations
- "insufficient_data" is a valid and honest answer — use it when there aren't enough observations
- Do not name conditions. Describe what is happening, not what it might be called.
- inflection_points are qualitative shifts, not just changes in degree
- If there are fewer than 3 observations, most trajectories will be "insufficient_data" — that's correct.`;

// ─── Pass 3: Contradiction Resolution Hypotheses ─────────────────────────

export const CONTRADICTION_PROMPT = `For each contradiction below, propose plausible explanations. Do NOT resolve the contradiction — propose hypotheses the caregiver can evaluate.

Return ONLY valid JSON:
{
  "resolutions": [
    {
      "contradiction_id": "string",
      "field": "string",
      "claim_a": "string",
      "claim_b": "string",
      "hypotheses": [
        {
          "hypothesis": "one sentence describing a plausible explanation",
          "explanation": "why this is plausible",
          "supporting_evidence": ["quotes that support or don't contradict this"],
          "likelihood": "likely|possible|unlikely"
        }
      ],
      "recommended_action": "preserve_both|clarify_with_caregiver|defer_to_next_turn"
    }
  ]
}

Rules:
- Never pick a "correct" answer. Always preserve both claims.
- Hypotheses must be plausible given the evidence, not invented
- recommended_action "preserve_both" when no clear resolution path exists
- "clarify_with_caregiver" when a single question could resolve it
- "defer_to_next_turn" when it can wait
`;

// ─── Pass 4: Baseline Enrichment ─────────────────────────────────────────

export const BASELINE_PROMPT = `Analyze what is usual (baseline) for this person and what has changed. Distinguish between stable traits and recent changes.

Return ONLY valid JSON:
{
  "stability_signals": ["quotes showing things that have NOT changed"],
  "onset_signals": ["quotes showing when something started"],
  "functional_baseline": ["quotes about what the person could do before that they can't do now"],
  "trait_vs_state": [
    {
      "statement": "quote from the note",
      "classification": "trait|state|unclear",
      "reasoning": "why this is a stable trait vs a recent change"
    }
  ],
  "quantity_departures": [
    {
      "domain": "sleep|food_intake|fluid_intake|medication|mobility|other",
      "current": "what is happening now",
      "baseline": "what was usual",
      "unit": "unit or null",
      "difference_phrase": "e.g. '3 hours where he usually does 7'"
    }
  ],
  "summary": "one sentence: what is usual for this person and what is different now"
}

Rules:
- "trait" = always been this way, not a change (e.g. "he's always been stubborn")
- "state" = recent change (e.g. "he's more stubborn lately")
- "unclear" when the text doesn't make it clear
- quantity_departures only when the text gives BOTH current and baseline numbers
- Never name conditions. Describe function, not diagnosis.`;

// ─── Pass 5: Uncertainty Explanation ─────────────────────────────────────

export const UNCERTAINTY_PROMPT = `Explain what is uncertain about this situation and why. Use plain language a caregiver would understand.

Return ONLY valid JSON:
{
  "explanations": [
    {
      "what_is_uncertain": "what we don't know",
      "why_uncertain": "why we don't know it, in plain language",
      "evidence": "quote showing the uncertainty",
      "would_help": "what would resolve this uncertainty"
    }
  ],
  "summary": "one sentence: what is the biggest uncertainty right now"
}

Rules:
- Never use confidence percentages or scores
- Focus on what would actually help the caregiver understand why we're cautious
- Every explanation must reference a specific quote from the input
- If nothing is uncertain, return an empty explanations array
- Be honest about uncertainty — don't paper over gaps`;