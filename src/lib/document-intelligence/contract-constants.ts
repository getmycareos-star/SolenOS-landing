/** Document Intelligence Layer — raw document → inference-ready knowledge graph nodes. */



export const DOCUMENT_INTELLIGENCE_LAYER_IDENTITY =

  "a deterministic document transformation layer that converts raw external document text into structured inference-ready knowledge graph nodes without reasoning, outcome decisions, or memory commits";



export const DOCUMENT_INTELLIGENCE_LAYER_ONE_LINE_TRUTH =

  "Documents are structured external reality inputs — extraction is truth, inference is separated, memory writes are proposals only.";



export const DOCUMENT_INTELLIGENCE_LAYER_PIPELINE_POSITION =

  "DOCUMENT INTELLIGENCE LAYER — after Action Generator; before Output Assembly";



export const DOCUMENT_INTELLIGENCE_LAYER_FORBIDDEN = [

  "change reasoning or decide outcomes",

  "influence interpretation before extraction",

  "inject assumptions during parsing",

  "merge extraction and inference fields",

  "auto-write memory from documents",

  "direct action execution from document content",

  "diagnose or validate medical conditions",

  "determine benefits eligibility",

  "interpret legal meaning as outcome",

] as const;



export const SOLENOS_DOCUMENT_TYPES = [

  "medical_document",

  "insurance_document",

  "benefits_document",

  "legal_document",

  "care_plan",

  "general_document",

] as const;



export const DOCUMENT_SIGNAL_URGENCY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;



/** Overall confidence below this threshold flags uncertainty and blocks decision assumptions. */

export const DOCUMENT_CONFIDENCE_THRESHOLD = 0.7;



export const DOCUMENT_EXTRACTION_FIELD_KEYS = [

  "dates",

  "instructions",

  "values",

  "conditions",

  "coverageStatements",

  "eligibilityCriteria",

  "legalClauses",

] as const;


