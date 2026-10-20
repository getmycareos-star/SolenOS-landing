import {
  CONTINUITY_DOMAINS,
  UNIVERSAL_EDGE_TYPES,
  UNIVERSAL_NODE_TYPES,
} from "./contract-constants";

export type UniversalNodeType = (typeof UNIVERSAL_NODE_TYPES)[number];
export type UniversalEdgeType = (typeof UNIVERSAL_EDGE_TYPES)[number];
export type ContinuityDomain = (typeof CONTINUITY_DOMAINS)[number];

export type ContinuityNode = {
  id: string;
  graph_id: string;
  node_type: UniversalNodeType;
  label: string;
  timestamp: string | null;
  domain: ContinuityDomain;
  structured_data: Record<string, unknown>;
  source_event_id: string | null;
  source_document_id: string | null;
  confidence_level: "high" | "medium" | "low";
  resolved_status: "open" | "resolved" | "partially_resolved" | "unknown";
  created_at: string;
};

export type ContinuityEdge = {
  id: string;
  graph_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: UniversalEdgeType;
  note: string;
  confidence_level: "high" | "medium" | "low";
  created_at: string;
};

export type ContinuityGraph = {
  graph_id: string;
  scope_id: string;
  caregiver_id: string;
  case_id: string | null;
  nodes: ContinuityNode[];
  edges: ContinuityEdge[];
  updated_at: string;
};

export type CascadeChain = {
  chain_id: string;
  node_ids: string[];
  edge_ids: string[];
  summary: string;
  domain: ContinuityDomain;
};

export type ContextReasoningOutput = {
  known: string[];
  unknown: string[];
  confidence: "high" | "medium" | "low" | "insufficient";
  questions: string[];
  completeness_score: number;
};

export type ContinuityGraphResult = {
  graph: ContinuityGraph;
  new_nodes: ContinuityNode[];
  new_edges: ContinuityEdge[];
  cascade_chains: CascadeChain[];
  context_reasoning: ContextReasoningOutput;
};

export type IngestContinuityInputParams = {
  description: string;
  caregiver_id?: string;
  case_id?: string | null;
  source?: string;
  timestamp?: string;
  document_id?: string;
  metadata?: Record<string, unknown>;
};

export type ContinuityIntelligenceInsight = {
  insight_id: string;
  insight_type:
    | "cascade_chain"
    | "missing_obligation"
    | "unresolved_decision"
    | "dependency_gap";
  summary: string;
  node_ids: string[];
  domain: ContinuityDomain;
};

export type ContinuityGraphLayerPayload = {
  identity: string;
  thesis: string;
  graph_id: string;
  node_count: number;
  edge_count: number;
  cascade_chains: CascadeChain[];
  context_reasoning: ContextReasoningOutput;
  continuity_insights: ContinuityIntelligenceInsight[];
  moat: string;
};
