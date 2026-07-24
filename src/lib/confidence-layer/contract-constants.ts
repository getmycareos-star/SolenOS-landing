export const CONFIDENCE_LAYER_IDENTITY =
  "Caregiver Confidence Score reassures whether enough is being done — derived over STATE + BELIEF, not a priority engine";

export const CONFIDENCE_LAYER_ONE_LINE_TRUTH =
  "Am I doing enough? Plain-English reassurance from critical action completion, crisis probability, and uncertainty — never priority jargon.";

export const CONFIDENCE_LAYER_PIPELINE_POSITION =
  "Decision Engine → Fail-Safe → Crisis Prevention → CONFIDENCE → Delegation → Human Trust → Safety → Output";

export const CONFIDENCE_LAYER_FORBIDDEN = [
  "replacing Priority Engine ranking",
  "persisting confidence as independent system of record",
  "showing Priority score or internal contract jargon to caregivers",
  "auto-executing actions based on confidence alone",
] as const;
