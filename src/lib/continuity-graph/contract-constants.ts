/**
 * Universal Continuity Graph — domain-agnostic longitudinal dependency graph.
 * Caregiving is the first domain; the graph is NOT medical-specific.
 */

export const CONTINUITY_GRAPH_IDENTITY =
  "A temporal dependency graph for real-world human continuity under cognitive overload.";

export const CONTINUITY_GRAPH_THESIS =
  "Longitudinal continuity intelligence for any domain where humans manage evolving, interdependent real-world situations.";

export const CONTINUITY_GRAPH_MOAT =
  "Accumulated structured reality over time — not vertical AI or summaries.";

export const UNIVERSAL_NODE_TYPES = [
  "Person",
  "Entity",
  "Event",
  "Condition",
  "Action",
  "Decision",
  "Document",
  "Obligation",
  "Resource",
  "Constraint",
] as const;

export const UNIVERSAL_EDGE_TYPES = [
  "causes",
  "precedes",
  "follows",
  "modifies",
  "triggers",
  "depends_on",
  "resolves",
  "relates_to",
  "blocks",
] as const;

export const CONTINUITY_DOMAINS = [
  "care",
  "legal",
  "financial",
  "administrative",
  "family",
  "mixed",
] as const;
