import type { ExtractedKnowledgeItem, KnowledgeRelationship } from "./types";

function createRelId(): string {
  return `kr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Detect relationships between extracted knowledge items within a document.
 */
export function detectKnowledgeRelationships(
  items: ExtractedKnowledgeItem[],
): KnowledgeRelationship[] {
  const relationships: KnowledgeRelationship[] = [];
  const legal = items.filter((i) => i.category === "legal_authority");
  const decisions = items.filter((i) => i.category === "decision");
  const responsibilities = items.filter((i) => i.category === "responsibility");
  const followUps = items.filter((i) => i.category === "appointment" || i.category === "follow_up_action");
  const people = items.filter((i) => i.category === "person");

  for (const auth of legal) {
    for (const person of people) {
      if (/\b(daughter|son|spouse|agent|attorney|guardian)\b/i.test(person.value)) {
        relationships.push({
          id: createRelId(),
          from_item_id: auth.id,
          to_item_id: person.id,
          relationship_type: "authorizes",
          note: "Legal authority may name a decision maker — verify in document.",
        });
      }
    }
    for (const decision of decisions) {
      relationships.push({
        id: createRelId(),
        from_item_id: auth.id,
        to_item_id: decision.id,
        relationship_type: "referenced_in",
        note: "Legal authority referenced alongside coverage or administrative decision.",
      });
    }
  }

  for (const resp of responsibilities) {
    for (const follow of followUps) {
      relationships.push({
        id: createRelId(),
        from_item_id: resp.id,
        to_item_id: follow.id,
        relationship_type: "requires",
        note: "Obligation may require follow-up action.",
      });
    }
  }

  const seen = new Set<string>();
  return relationships.filter((r) => {
    const key = `${r.from_item_id}:${r.to_item_id}:${r.relationship_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
