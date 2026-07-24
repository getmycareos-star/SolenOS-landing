import type { FinalOutputContract } from "../final-output-contract/types";
import type { DemandClassification } from "./types";

const SEARCH_REFUSAL_HAPPENING_WITH_RECORD =
  "This reads as a general information question. SolenOS holds this person's Living Care Record — it does not answer Medicare, cost, or program FAQs.";

const SEARCH_REFUSAL_HAPPENING_EMPTY =
  "SolenOS is the memory system for this person's care journey, not a general Q&A engine. Share what is happening for them and it will be held in the Living Care Record.";

/**
 * Search Demand must not produce FAQ / answer-engine output.
 * Redirect to continuity capture — questions are symptoms of missing memory, not a request for longer answers.
 */
export function applySearchDemandContinuityRedirect(params: {
  final_output: FinalOutputContract;
  demand: DemandClassification | null | undefined;
  has_care_events: boolean;
  what_changed?: string[];
}): { final_output: FinalOutputContract; refused_generic_search_answer: boolean } {
  if (params.demand?.demand_type !== "search_demand") {
    return {
      final_output: params.final_output,
      refused_generic_search_answer: false,
    };
  }

  const rememberedChange = params.what_changed?.find((l) => l.trim().length > 0)?.trim();

  return {
    refused_generic_search_answer: true,
    final_output: {
      ...params.final_output,
      what_is_happening: params.has_care_events
        ? SEARCH_REFUSAL_HAPPENING_WITH_RECORD
        : SEARCH_REFUSAL_HAPPENING_EMPTY,
      what_matters_now:
        rememberedChange ??
        "What helps next is recording what changed for this person — coverage and cost questions stay with their care team or benefits advisor.",
      what_to_ask_next:
        "What is happening with their care that you want held in the Living Care Record?",
      what_can_wait: "Generic program eligibility, cost, and FAQ-style answers.",
      follow_up_items: [],
      risk_level: "low",
    },
  };
}
