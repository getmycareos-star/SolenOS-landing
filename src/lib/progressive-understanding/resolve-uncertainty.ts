/**
 * Resolve open uncertainties when a new observation answers them —
 * or when the caregiver refuses a repeated ask ("I already told you").
 */

/** Caregiver pushback at being re-asked — never ignore this. */
export function isCaregiverQuestionPushback(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\bi (?:already |just )?(?:told|said|answered)\b/i.test(t) ||
    /\byou (?:already |just )?asked\b/i.test(t) ||
    /\bi (?:just )?said (?:that|this|i told)\b/i.test(t) ||
    /\bstop asking\b/i.test(t) ||
    /\bi already (?:said|told) you\b/i.test(t) ||
    /\bdon'?t ask (?:me )?(?:that|again)\b/i.test(t) ||
    /\byou keep asking\b/i.test(t)
  );
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "did",
  "does",
  "do",
  "she",
  "he",
  "they",
  "her",
  "his",
  "him",
  "their",
  "them",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "and",
  "or",
  "but",
  "from",
  "this",
  "that",
  "what",
  "when",
  "where",
  "how",
  "why",
  "who",
  "which",
  "still",
  "open",
  "question",
  "about",
  "any",
  "more",
  "context",
  "would",
  "help",
  "if",
  "you",
  "have",
  "has",
  "had",
  "it",
  "be",
  "been",
  "being",
  "can",
  "could",
  "should",
  "will",
  "new",
  "compared",
  "your",
  "loved",
  "one",
  "please",
  "tell",
  "know",
]);

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Yes/no style answers to yes/no style open asks. */
function answersYesNoStyle(question: string, answer: string): boolean {
  const ql = question.trim().toLowerCase();
  // Only true yes/no questions — never "What else…?" / "When…?" / "How…?"
  // Ending with "?" alone is not enough (false-positive on "has not" in care notes).
  const looksYn =
    /^(did|does|do|is|are|was|were|has|have|had|can|could|will|would|should)\b/.test(
      ql,
    );
  if (!looksYn) return false;
  // Short confirmatory answers only — not a full care note that happens to contain "has not".
  const trimmed = answer.trim();
  if (trimmed.length > 80) return false;
  return /\b(yes|no|nope|yeah|yep|nah|not sure|unsure|didn't|did not|doesn't|does not|hasn't|has not|haven't|have not|never|she did|he did|they did|she didn't|he didn't)\b/i.test(
    answer,
  );
}

/** Shared content between the open ask and new note — generic, not keyword quizzes. */
function contentOverlapsAsk(question: string, answer: string): boolean {
  const qTokens = significantTokens(question);
  if (qTokens.length === 0) return false;
  const aTokens = new Set(significantTokens(answer));
  const hits = qTokens.filter((t) => aTokens.has(t)).length;
  if (hits >= 2) return true;
  // Short asks ("hit head?") — one shared content word plus a substantive answer.
  return qTokens.length <= 3 && hits >= 1 && answer.trim().length >= 8;
}

export function resolveAnsweredUncertainties(params: {
  openQuestions: readonly string[];
  rawText: string;
}): { remaining: string[]; resolved: string[] } {
  const lower = params.rawText.toLowerCase();
  const resolved: string[] = [];
  const remaining: string[] = [];

  // Pushback clears every open ask — re-asking after this is a trust failure.
  if (isCaregiverQuestionPushback(params.rawText)) {
    return {
      remaining: [],
      resolved: [...params.openQuestions],
    };
  }

  for (const q of params.openQuestions) {
    const ql = q.toLowerCase();
    let answered = false;

    if (
      (ql.includes("unusual") ||
        ql.includes("before") ||
        ql.includes("previously") ||
        ql.includes("usually") ||
        ql.includes("new compared")) &&
      /\b(before|previously|happened before|usual|usually|always|again|not the first|new for|first time|normal)\b/i.test(
        lower,
      )
    ) {
      answered = true;
    }
    if (
      (ql.includes("fluid") || ql.includes("drink") || ql.includes("water")) &&
      /\b(fluid|drink|drinking|water|sips?|juice|tea|no drinks?|not drinking)\b/i.test(lower)
    ) {
      answered = true;
    }
    if (
      ql.includes("when") &&
      /\b(today|yesterday|this morning|last night|hour|minute|started|began)\b/i.test(lower)
    ) {
      answered = true;
    }
    if (
      (ql.includes("before this") || ql.includes("just before")) &&
      /\b(after|before|then|because|right after|following)\b/i.test(lower)
    ) {
      answered = true;
    }
    if (ql.includes("go home") && /go home|homesick/i.test(lower)) {
      answered = true;
    }
    if (ql.includes("sad") && /\bsad\b/i.test(lower)) {
      answered = true;
    }
    if (ql.includes("same time") && /\bsad\b|\bsame\b|\btogether\b/i.test(lower)) {
      answered = true;
    }

    if (!answered && answersYesNoStyle(q, params.rawText)) {
      answered = true;
    }
    if (!answered && contentOverlapsAsk(q, params.rawText)) {
      answered = true;
    }

    if (answered) resolved.push(q);
    else remaining.push(q);
  }

  return { remaining, resolved };
}

function dedupeQuestions(questions: readonly string[]): string[] {
  const out: string[] = [];
  for (const q of questions) {
    const t = q.trim();
    if (!t) continue;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
  }
  return out;
}

/** Known-unknowns for ACS/CRS: unanswered priors plus this turn's new UI asks. */
export function mergeKnownUnknowns(
  remaining: readonly string[],
  newAsks: readonly string[],
): string[] {
  return dedupeQuestions([...remaining, ...newAsks]).slice(0, 8);
}
