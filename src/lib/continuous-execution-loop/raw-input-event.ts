import type { RawInputEvent, UnifiedInputType } from "./types";

function createId(): string {
  return `raw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildRawInputEvent(input: {
  caregiver_id: string;
  raw_text: string;
  input_type: UnifiedInputType;
  captured_at?: string;
  document_ids?: string[];
  target_event_id?: string | null;
}): RawInputEvent {
  return {
    id: createId(),
    caregiver_id: input.caregiver_id,
    raw_text: input.raw_text.trim(),
    input_type: input.input_type,
    captured_at: input.captured_at ?? new Date().toISOString(),
    document_ids: input.document_ids ?? [],
    target_event_id: input.target_event_id ?? null,
  };
}
