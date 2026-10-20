import type { ProcessSituationInput } from "../situation-entry/types";
import type { UnifiedInputType } from "./types";

export function classifyUnifiedInput(input: {
  raw_input: string;
  documents?: readonly { id: string }[];
  source?: ProcessSituationInput["source"];
  input_type?: UnifiedInputType;
  is_correction?: boolean;
  is_idle_refresh?: boolean;
}): UnifiedInputType {
  if (input.is_idle_refresh) return "idle_refresh";
  if (input.is_correction) return "correction";
  if (input.input_type) return input.input_type;
  if ((input.documents?.length ?? 0) > 0 && !input.raw_input.trim()) return "document";
  if (input.source === "document") return "document";
  return "situation";
}

export function classifyStateOperation(input_type: UnifiedInputType): "add" | "correct" | "link" {
  if (input_type === "correction") return "correct";
  if (input_type === "follow_up_answer") return "link";
  return "add";
}

export function resolveSystemMode(
  is_first_situation: boolean,
  event_count: number,
): "empty" | "bootstrap" | "continuous" {
  if (event_count === 0) return "empty";
  if (is_first_situation) return "bootstrap";
  return "continuous";
}
