import { CLARIFICATION_SIGNAL_PATTERNS } from "./constants";

export function detectClarificationSignal(input: string): boolean {
  const text = input.trim();
  if (!text) return false;
  return CLARIFICATION_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = new Set(normalizeForComparison(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeForComparison(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

/** Hard signal — user asks essentially the same question again after output. */
export function detectRequerySignal(currentInput: string, priorInput?: string | null): boolean {
  if (!priorInput?.trim()) return false;

  const current = normalizeForComparison(currentInput);
  const prior = normalizeForComparison(priorInput);
  if (!current || !prior) return false;

  if (current === prior) return true;
  if (current.includes(prior) || prior.includes(current)) return true;

  return tokenOverlapRatio(currentInput, priorInput) >= 0.72;
}

export interface ReliefSignalSnapshot {
  requery_detected: boolean;
  clarification_detected: boolean;
  helpful_feedback: boolean | null;
  reduced_confusion: boolean | null;
}

export function createInitialReliefSignals(params: {
  input: string;
  priorInput?: string | null;
}): ReliefSignalSnapshot {
  return {
    requery_detected: detectRequerySignal(params.input, params.priorInput),
    clarification_detected: detectClarificationSignal(params.input),
    helpful_feedback: null,
    reduced_confusion: null,
  };
}
