import {
  HumanValidationSignalSchema,
  type HumanValidationSignal,
} from "./types";

/** Ephemeral in-memory signal buffer — metadata only, no user content. */
const signals = new Map<string, HumanValidationSignal>();

export function upsertValidationSignal(params: {
  response_id: string;
  helpful: boolean;
  reduced_confusion?: boolean | null;
}): HumanValidationSignal {
  const existing = signals.get(params.response_id);
  const entry = HumanValidationSignalSchema.parse({
    response_id: params.response_id,
    helpful: params.helpful,
    reduced_confusion:
      params.reduced_confusion !== undefined
        ? params.reduced_confusion
        : (existing?.reduced_confusion ?? null),
    timestamp: existing?.timestamp ?? new Date().toISOString(),
  });
  signals.set(params.response_id, entry);
  return entry;
}

export function getValidationSignal(
  response_id: string,
): HumanValidationSignal | undefined {
  return signals.get(response_id);
}

export function peekValidationSignals(): readonly HumanValidationSignal[] {
  return [...signals.values()];
}

export function clearValidationSignals(): void {
  signals.clear();
}
