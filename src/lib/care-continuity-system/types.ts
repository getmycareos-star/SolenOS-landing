import type { JourneyGraphEvent } from "../care-journey-graph/types";

/** Unified event view per core system spec. */
export type CareContinuityEvent = {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  structured_data: {
    description: string;
    category: string;
    clinical_importance: string;
    resolved_status: string;
    open_questions: string[];
    people_involved: string[];
    location: string | null;
  };
  relationships: string[];
  source_document_id: string | null;
  confidence_level: "high" | "medium" | "low";
};

export type CareContinuitySystemStatus = {
  identity: string;
  journey_event_count: number;
  relationship_count: number;
  open_questions_count: number;
  pillars: Record<string, boolean>;
  all_pillars_present: boolean;
};

export function journeyEventToContinuityEvent(event: JourneyGraphEvent): CareContinuityEvent {
  const docIds = event.evidence.document_ids ?? [];
  const confidence =
    event.clinical_importance === "high"
      ? "high"
      : event.clinical_importance === "moderate"
        ? "medium"
        : "low";

  return {
    id: event.id,
    timestamp: event.timestamp,
    type: event.event_type,
    title: event.title,
    structured_data: {
      description: event.description,
      category: event.category,
      clinical_importance: event.clinical_importance,
      resolved_status: event.resolved_status,
      open_questions: event.open_questions,
      people_involved: event.people_involved,
      location: event.location,
    },
    relationships: event.related_event_ids,
    source_document_id: docIds[0] ?? null,
    confidence_level: confidence,
  };
}
