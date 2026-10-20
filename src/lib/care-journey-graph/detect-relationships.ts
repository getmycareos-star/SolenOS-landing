import type {
  JourneyGraphEvent,
  JourneyRelationship,
  RelationshipType,
} from "./types";

function sharedTokens(a: string, b: string): string[] {
  const tokensA = new Set(
    a
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3),
  );
  const tokensB = b
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
  return tokensB.filter((t) => tokensA.has(t));
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function createRelId(): string {
  return `jr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function detectRelationships(
  newEvent: JourneyGraphEvent,
  existingEvents: JourneyGraphEvent[],
): JourneyRelationship[] {
  const relationships: JourneyRelationship[] = [];
  const sorted = [...existingEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  for (const prior of sorted.slice(0, 20)) {
    const days = daysBetween(newEvent.timestamp, prior.timestamp);
    if (days > 90) continue;

    let relType: RelationshipType | null = null;
    let note = "";

    // Causal chains: fall → emergency/hospital
    if (prior.event_type === "fall" && ["emergency_visit", "hospital_visit", "lab_result"].includes(newEvent.event_type)) {
      relType = "caused";
      note = "Emergency/hospital event may follow fall.";
    }

    if (prior.event_type === "diagnosis" && newEvent.event_type === "medication_started") {
      relType = "resulted_in";
      note = "Medication may follow diagnosis.";
    }

    if (
      prior.event_type === "medication_started" &&
      (newEvent.event_type === "symptom" || newEvent.event_type === "behaviour_change")
    ) {
      relType = "changed_due_to";
      note = "Symptom or behaviour change may relate to recent medication change.";
    }

    if (prior.event_type === "doctor_recommendation" && newEvent.event_type === "decision") {
      relType = "recommended";
      note = "Decision may follow doctor recommendation.";
    }

    // Continuation: same symptom/behaviour type
    if (
      prior.event_type === newEvent.event_type &&
      ["symptom", "behaviour_change", "caregiver_observation"].includes(newEvent.event_type)
    ) {
      const shared = sharedTokens(prior.description, newEvent.description);
      if (shared.length >= 1) {
        relType = "continued_from";
        note = `Continuing pattern: ${shared.slice(0, 3).join(", ")}.`;
      }
    }

    // Appetite / confusion continuity
    if (
      /\b(appetite|eating|confus\w*)\b/i.test(prior.description) &&
      /\b(appetite|eating|confus\w*)\b/i.test(newEvent.description)
    ) {
      relType = relType ?? "continued_from";
      note = note || "Similar concern recorded previously.";
    }

    // UTI → antibiotics → confusion pattern
    if (/\b(uti|urinary|infection)\b/i.test(prior.description) && newEvent.event_type === "medication_started") {
      relType = "resulted_in";
      note = "Treatment may follow infection diagnosis.";
    }

    if (/\b(antibiotic|medication)\b/i.test(prior.description) && /\b(confus\w*)\b/i.test(newEvent.description)) {
      relType = "related_to";
      note = "Confusion may relate to recent treatment — additional information needed.";
    }

    // Temporal follow
    if (!relType && days <= 7 && prior.timestamp < newEvent.timestamp) {
      const shared = sharedTokens(prior.description, newEvent.description);
      if (shared.length >= 2) {
        relType = "related_to";
        note = `Related to prior event (${shared.slice(0, 2).join(", ")}).`;
      }
    }

    if (relType) {
      relationships.push({
        id: createRelId(),
        journey_id: newEvent.journey_id,
        from_event_id: prior.id,
        to_event_id: newEvent.id,
        relationship_type: relType,
        note,
        created_at: newEvent.created_at,
      });
    }
  }

  // Deduplicate by from+to+type
  const seen = new Set<string>();
  return relationships.filter((r) => {
    const key = `${r.from_event_id}:${r.to_event_id}:${r.relationship_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function relatedEventIds(relationships: JourneyRelationship[], eventId: string): string[] {
  return [
    ...new Set(
      relationships
        .filter((r) => r.to_event_id === eventId)
        .map((r) => r.from_event_id),
    ),
  ];
}
