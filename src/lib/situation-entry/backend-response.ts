import type { SituationResponse } from "./types";

export type WorkspaceSituationResponse = SituationResponse & {
  ok?: boolean;
  message?: string;
  analysis_status?: "complete" | "partial";
  analysis_warning?: string | null;
  care_recipient_id?: string;
  total_events?: number;
  care_event_id?: string;
  evidence_id?: string;
  qwen_extraction_status?: "available" | "unavailable" | "not_applicable";
  qwen_candidates?: {
    observations?: Array<{ subject: string; observation: string; source_quote: string; review_status?: string }>;
    open_questions?: string[];
  } | null;
  qwen_review_required?: boolean;
  qwen_written_to_lcr?: boolean;
  events?: Array<{ id?: string; title?: string; description?: string | null; occurred_at?: string; evidence_ids?: string[] }>;
};

/**
 * Normalize the FastAPI capture response for the existing LCR presentation
 * builder. This fills absent presentation collections only; it never invents
 * events, observations, interpretations, IDs, or timestamps.
 */
export function normalizeBackendSituationResponse(raw: unknown): WorkspaceSituationResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The care-record service returned an invalid capture response.");
  }

  const serverResponse = raw as Partial<SituationResponse> & {
    ok?: boolean;
    message?: string;
    analysis_status?: "complete" | "partial";
    analysis_warning?: string | null;
    care_recipient_id?: string;
    total_events?: number;
    events?: unknown[];
  };
  const rawWhatChanged = (raw as { what_changed?: unknown }).what_changed;

  return {
    ...serverResponse,
    what_i_understood: serverResponse.what_i_understood ?? [],
    what_is_uncertain: serverResponse.what_is_uncertain ?? [],
    what_needs_clarification: serverResponse.what_needs_clarification ?? [],
    what_will_be_tracked: serverResponse.what_will_be_tracked ?? [],
    what_changed: Array.isArray(rawWhatChanged)
      ? rawWhatChanged.filter((item): item is string => typeof item === "string")
      : typeof rawWhatChanged === "string" && rawWhatChanged.trim()
        ? [rawWhatChanged]
        : [],
    what_merged_or_split: serverResponse.what_merged_or_split ?? [],
    events_created: serverResponse.events_created ?? (Array.isArray(serverResponse.events) ? serverResponse.events as SituationResponse["events_created"] : []),
    // FastAPI's turn is a minimal hydration projection, not the richer local
    // ActiveSituationTurn contract. Rebuild it from the persisted situation.
    active_care_situation_turn:
      serverResponse.ok === true ? undefined : serverResponse.active_care_situation_turn,
    analysis_status: serverResponse.analysis_status ?? "complete",
    analysis_warning: serverResponse.analysis_warning ?? null,
  } as WorkspaceSituationResponse;
}
