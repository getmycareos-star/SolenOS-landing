import type { ExtractedFacts } from "./types";

/**
 * Step 1 — Extract facts only. Restate explicit user statements; no interpretation.
 */
export function extractFactsOnly(input: string): ExtractedFacts {
  const raw = input.trim();
  if (!raw) {
    return { explicit_statements: [], raw_input: "" };
  }

  const statements = raw
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (statements.length === 0) {
    return { explicit_statements: [raw], raw_input: raw };
  }

  return {
    explicit_statements: statements.map((s) => `You reported: ${s}.`),
    raw_input: raw,
  };
}

export function formatSituationSummary(facts: ExtractedFacts): string {
  if (facts.explicit_statements.length === 0) {
    return "No explicit caregiver input was provided.";
  }
  if (facts.explicit_statements.length === 1) {
    return facts.explicit_statements[0]!;
  }
  return facts.explicit_statements.join(" ");
}
