/**
 * Deterministic user-message assembly — no memory, no branching beyond context injection.
 */
export function buildSolenOSPrompt(input: string, context?: unknown): string {
  const trimmed = input.trim();
  let prompt = `USER INPUT:\n${trimmed}`;

  if (context !== undefined && context !== null) {
    prompt += `\n\nOPTIONAL CONTEXT:\n${formatOptionalContext(context)}`;
  }

  return prompt;
}

function formatOptionalContext(context: unknown): string {
  if (typeof context === "string") {
    return context.trim();
  }

  return stableStringify(context);
}

/** Stable JSON for identical object shapes across calls. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortKeys(record[key]);
  }
  return sorted;
}
