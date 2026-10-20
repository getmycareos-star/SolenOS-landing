/** Context Weighting Engine — weights memory / documents / user inputs. */

export const CONTEXT_WEIGHTING_LAYER_IDENTITY =
  "a weighting layer that scores memory, documents, and user inputs by recency, relevance, and reliability — influence only, never truth";

export const CONTEXT_WEIGHTING_LAYER_ONE_LINE_TRUTH =
  "Context weights bias which inputs matter more under uncertainty — they never invent facts or decide actions.";

export const CONTEXT_WEIGHTING_LAYER_PIPELINE_POSITION =
  "CONTEXT WEIGHTING — after Input / Context assembly; before Situation Resolver and downstream Priority.";

export const CONTEXT_WEIGHTING_LAYER_FORBIDDEN = [
  "treat high reliability as verified medical fact",
  "generate actions from context weights alone",
  "merge into Decision History WHY or Timeline WHAT",
] as const;
